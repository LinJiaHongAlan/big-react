// 这个是完整的工作循环的文件
import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, PendingPassiveEffects, createWorkInProgress, fiberRootNode } from './fiber';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighesPriorityLane,
	markRootFinished,
	mergeLanes,
	lanesToSchedulerPriority
} from './fiberLanes';
import { MutationMask, NoFlags, PassiveMask } from './filberFlags';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
// 安装的调度器
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

// 我们这里需要一个全局的指针来指向当前工作的FiberNode
let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
// 定义这个变量用来阻止多次调用的情况
let rootDoesHasPassiveEffects = false;
// 当前Root阶段render退出时候的状态
type RootExitStatus = number;
// 代表中断执行
const RootInComplete: RootExitStatus = 1;
// 代表执行完了
const RootCompleted: RootExitStatus = 2;

// 初始化workInProgress
function prepareFreshStack(root: fiberRootNode, lane: Lane) {
	root.finishedLane = NoFlags;
	root.finishedWork = null;
	// root.current也就是hostRootFiber
	// workInProgress：触发更新后，正在reconciler中计算的fiberNode树
	// createWorkInProgress的作用是传入一个hostRootFiber（也是FiberNode类型）然后返回一个新的hostRootFiber,并将旧的信息保存到hostRootFiber.alternate里面
	// 保存到workInProgress中
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

// 连接Container以及renderRoot的方法
// 在Fiber调度Update
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// TODO 调度功能
	// 拿到根节点fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	// 添加优先级（相同优先级更新不会引起变化）
	markRootUpdateed(root, lane);
	// 调用renderRoot开始跟新
	ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: fiberRootNode) {
	// 从待处理的Lanes集合中获取优先级最高的Lane
	const updateLane = getHighesPriorityLane(root.pendingLanes);
	const existingCallback = root.callbackNode;

	if (updateLane === NoLane) {
		// 如果优先级是NoLane证明没有需要调度的方法了
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}
		root.callbackNode = null;
		root.callbackPriority = NoLane;
		// 结束更新
		return;
	}

	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;
	// 如果优先级相同则意味着,上一次的更新被中断，还未执行完不再产生新的调度
	if (curPriority === prevPriority) {
		return;
	}
	// 判断existingCallback是否有值，若为null则证明当前没有调度的方法
	if (existingCallback !== null) {
		// 若不为null证明有更高得到优先级打断，需要中断当前得到调度方法
		unstable_cancelCallback(existingCallback);
	}
	let newCallbackNode = null;

	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度，优先级：', updateLane);
		}
		// scheduleSyncCallback是收集函数方法的函数想数组syncQueue添加一个performSyncWorkOnRoot
		// [performSyncWorkOnRoot, performSyncWorkOnRoot, performSyncWorkOnRoot]
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		// scheduleMicroTask是异步任务，flushSyncCallbacks是消费syncQueue的函数
		// 因此performSyncWorkOnRoot执行的次数也是跟当前函数执行的次数是一样的
		// 也就是说flushSyncCallbacks方法执行意味着performSyncWorkOnRoot也会执行
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级 用宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane);
		// @ts-ignore
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}
	// 更新callbackNode跟callbackPriority，如果是同步调度的话则newCallbackNode = null
	root.callbackNode = newCallbackNode;
	root.callbackPriority = curPriority;
}

// 添加优先级
function markRootUpdateed(root: fiberRootNode, lane: Lane) {
	// mergeLanes是按位或操作，合并集合
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 向上遍历拿到fiberRootNode
export function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

// 并发更新
function performConcurrentWorkOnRoot(root: fiberRootNode, didTimeout: boolean): any {
	// 先拿到当前的callbackNode方法也就是调度performSyncWorkOnRoot的方法
	const curCallback = root.callbackNode;
	// 保证之前的useEffect已经执行了,因为在useEffect执行的过程中有可能会调用setState导致再次触发调度函数，这个时候如果有优先级更高的方法的时候需要打断当前的执行
	// 因此在执行getHighesPriorityLane方法之前，我们需要确保执行完所有的useEffect,并返回是否执行了回调的值didFlushPassiveEffect
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
	if (didFlushPassiveEffect) {
		// 如果执行了副作用，则判断调度方法是否一直,如果不一致证明存在useEffect调度了更高优先级的更新
		if (root.callbackNode !== curCallback) {
			return null;
		}
	}

	const lane = getHighesPriorityLane(root.pendingLanes);
	const curCallbackNode = root.callbackNode;
	if (lane === NoLane) {
		return null;
	}
	/**
	 * 在这里我们要让whie循环可中断
	 * 1. 如果work就是同步优先级那么就不可中断 ImmediatePriority
	 * 2. 饥饿问题 didTimeout标记当前任务有没有过期，如果过期他就是同步的, scheduleCallback会自动带上这个参数在UserBlockingPriority的时候当一定次数之后didTimeout会为true,ImmediatePriority则didTimeout一开始就为true
	 * 3. 时间切片
	 */
	// 是否需要同步执行的变量，如果needSync为true，那么没得商量一定是等待while执行完毕
	const needSync = lane === SyncLane || didTimeout;
	// render阶段返回优先级，exitStatus返回值是renderRoot之后的推出状态
	const exitStatus = renderRoot(root, lane, !needSync);

	// 重新调用调度一次，ensureRootIsScheduled方法如果优先级一样是不会重新调度的
	ensureRootIsScheduled(root);

	// RootInComplete是中断执行也就是未结束的状态
	if (exitStatus === RootInComplete) {
		// 看中断后并重新调度之后的回调跟当前的回调是否是同一个，如果不是同一个则取消操作
		if (root.callbackNode !== curCallbackNode) {
			return null;
		}
		// 如果是同一个则返回当前的方法，那么调度器会继续调用这个方法
		return performConcurrentWorkOnRoot.bind(null, root);
	}
	// 已经更新完了
	if (exitStatus === RootCompleted) {
		// 进入这里表示退出的状态是以完成
		// root.current.alternate就是workInProgress最开始指向的根节点
		// 这个时候的root.current.alternate已经是调度完成了，所以finishedWork会有最新的stateNode，也会有需要更新的flags标记
		const finishedWork = root.current.alternate;
		// 保存到finishedWork
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		wipRootRenderLane = NoLane;

		// 这里就可以根据fiberNode树 书中的flags
		commitRoot(root);
	} else if (__DEV__) {
		console.log('还未实现同步更新结束状态');
	}
}

/**
 * 从跟节点开始更新
 * @param root 根节点fiberRootNode
 * @returns
 */
function performSyncWorkOnRoot(root: fiberRootNode) {
	// 获取下一个节点,这里开始执行调度挂载,当执行到commit阶段的时候会调用markRootFinished将当前最高的优先级去除掉
	// 去除掉之后这里再次获取就不会获取到重复的优先级没有的话就会中断后面的执行
	// 由于performSyncWorkOnRoot是异步所有在前面的时候，会执行所有的同步调度ensureRootIsScheduled那么同个优先级的update也都会被添加进去
	const nextLane = getHighesPriorityLane(root.pendingLanes);
	if (nextLane !== SyncLane) {
		// 其他比Synclane低的优先级
		// NoLane
		// 为了保险可以再调用一次
		ensureRootIsScheduled(root);
		return;
	}

	const exitStatus = renderRoot(root, nextLane, false);
	if (exitStatus === RootCompleted) {
		// 进入这里表示退出的状态是以完成
		// root.current.alternate就是workInProgress最开始指向的根节点
		// 这个时候的root.current.alternate已经是调度完成了，所以finishedWork会有最新的stateNode，也会有需要更新的flags标记
		const finishedWork = root.current.alternate;
		// 保存到finishedWork
		root.finishedWork = finishedWork;
		root.finishedLane = nextLane;
		wipRootRenderLane = NoLane;

		// 这里就可以根据fiberNode树 书中的flags
		commitRoot(root);
	} else if (__DEV__) {
		console.log('还未实现同步更新结束状态');
	}
}

function renderRoot(root: fiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
	}

	// 同步更新中有可能会有中断再继续的情况，这个时候不需要初始化
	if (wipRootRenderLane !== lane) {
		// 初始化
		prepareFreshStack(root, lane);
	}
	// 执行递归流程
	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			// 没有问题这里会直接跳出,到这个阶段的workInProgress已经遍历完，workInProgress会指向null
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误');
			}
			// 改变指针
			workInProgress = null;
		}
	} while (true);

	// (执行完了 || 中断执行了)，就从workList中移除
	if (shouldTimeSlice && workInProgress !== null) {
		// 还没执行完
		return RootInComplete;
	}
	// render阶段执行完
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error('render阶段结束时不应该不为null');
	}
	// TODO 报错
	return RootCompleted;
}

function commitRoot(root: fiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.log('commit阶段开始', finishedWork);
	}

	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedWork不应该是NoLane');
	}

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	// 移除优先级,当调用performSyncWorkOnRoot的时候,经过begin跟complete阶段最终会到commitRoot
	// 移除之后后续的performSyncWorkOnRoot这不会继续经过这3个阶段
	markRootFinished(root, lane);

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		// 进入到这里代表当前的fiber树种存在需要执行userEffect回调
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true;
			// 调度副作用
			// scheduleCallback是调度的方法，NormalPriority这个是优先级，这里可以理解为是setTimeOut方法
			scheduleCallback(NormalPriority, () => {
				// 这里因为调度是异步，所以会在commit节点完成以后再执行
				// 而收集任务回调的的实际在commit的同步节点也就是commitWork的commitPassiveEffect方法中
				// 当前方法执行时意味着保存在fiberRootNode中的pendingPassiveEffects对象收集完毕
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在3个子阶段需要执行得到操作
	// 需要判断root本身的flags以及root的subtreeFlags
	// 这里是按位与操作subtreeHasEffect !== NoFlags标识存在子节点需要更新操作
	const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	// rootHasEffect标识根节点存在需要更新的操作
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
	// 这里subtreeHasEffect的判断是是否存在需要操作的MutationMask标记,当useState的dispatch调用的时候如果前后值没有改变
	// 那么意味着组件返回对应的fiberNode不会变，那么是不会通过该判断
	// 因此在useEffect(() => { setNum(0) })这种改变固定的值的时候当第二次执行useEffect的时候，不会通过判断，就不会在commit阶段收集回调
	// 那么pendingPassiveEffects就不存在相关的回调函数也就不会执行
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation Placement
		commitMutationEffects(finishedWork, root);
		root.current = finishedWork;

		// layout
	} else {
		root.current = finishedWork;
	}
	rootDoesHasPassiveEffects = false;
	// ensureRootIsScheduled(root);
}

/**
 * 执行回调
 * @param pendingPassiveEffects 收集回调的对象
 */
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffect = false;
	// 这里的effect全都是effect链表内部会循环整个链表

	// unmount是在commit阶段的ChildDeletion标记添加上的,当内部方法执行的时候意味着组件需要销毁，销毁的操作是不需要执行create方法的
	// 因此commitHookEffectListUnmount方法内部会删除HookHasEffect标记得到tag，那么下面的update方法就不会执行
	// 这里内部也是执行了destroy方法
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true;
		// 在这里的时候组件其实已经销毁了
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	// HookHasEffect代表了hook中存在副作用需要执行这个是保存在hooks中的memoizedState中的Effect的tag中
	// PassiveEffect是保存咋子fiberNode中代表有useEffect需要处理
	// pendingPassiveEffects.update只有标识了PassiveEffect才会被添加进来
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		// 执行destroy方法，在mount阶段也拿不到destroy方法，所以无法执行，只有当执行了create之后从返回值中才能拿到destroy方法
		// commitHookEffectListDestroy方法内部会拿到effect的destroy方法并且执行
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		// commitHookEffectListCreate方法内部会拿到create的方法然后执行并且将返回值保存到effect.destroy上面
		// 当重复调度的时候，每次都会重新赋值新的effect.destroy方法，留着下一次使用
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];
	// 在useEffect的回调里面还有可能再次更新，所以我们需要再次执行回调方法
	// 这里我不是很理解，其实在回调中如果调用useState的dispaly,方法内部其实也会执行一个调度最终还是会执行这个方法的，经过试验地铁注释掉这个方法照样可以执行
	flushSyncCallbacks();
	return didFlushPassiveEffect;
}

function workLoopSync() {
	// 只要指针不等于null就能一直循环下去,这里也就是递归中的递
	// 但completeUnitOfWork中循环到最上层的时候workInProgress则为null就会中断这一层方法内的while循环
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopConcurrent() {
	// 只要指针不等于null就能一直循环下去,这里也就是递归中的递
	// 但completeUnitOfWork中循环到最上层的时候workInProgress则为null就会中断这一层方法内的while循环
	while (workInProgress !== null && unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// beginWork会拿到下一层得到子FiberNode
	const next = beginWork(fiber, wipRootRenderLane);
	// 更新Props的值，memoizedProps这个值其实就是对于的ReactElement的Props，里面有后续节点的信息
	fiber.memoizedProps = fiber.pendingProps;
	// 判断是否有下一层的FiberNode
	if (next === null) {
		// 不存在调用归
		completeUnitOfWork(fiber);
	} else {
		// 存在则指针指向下一层
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		// 执行递归中的归
		completeWork(node);
		// 拿到兄弟节点

		const sibling = node.sibling;
		if (sibling) {
			// 如果兄弟节点存在则指针指向兄弟节点
			workInProgress = sibling;
			return;
		}

		// 如果兄弟节点不存在则拿父级节点
		node = node.return;
		// 改变指针指向父级
		workInProgress = node;
	} while (node !== null);
}
