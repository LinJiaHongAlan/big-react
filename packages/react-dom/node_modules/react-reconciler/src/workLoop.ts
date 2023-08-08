// 这个是完整的工作循环的文件
import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, createWorkInProgress, fiberRootNode } from './fiber';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighesPriorityLane,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { MutationMask, NoFlags } from './filberFlags';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';

// 我们这里需要一个全局的指针来指向当前工作的FiberNode
let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;

// 初始化workInProgress
function prepareFreshStack(root: fiberRootNode, lane: Lane) {
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
	markRootUpdateed(root, lane);
	// 调用renderRoot开始跟新
	ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: fiberRootNode) {
	// 从待处理的Lanes集合中获取优先级最高的Lane
	const updateLane = getHighesPriorityLane(root.pendingLanes);
	if (updateLane === NoLane) {
		// 结束更新
		return;
	}
	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度，优先级：', updateLane);
		}
		// scheduleSyncCallback是收集函数方法得函数,每触发一次更新就会多一次回调
		// [performSyncWorkOnRoot, performSyncWorkOnRoot, performSyncWorkOnRoot]
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		// 执行3次scheduleMicroTask方法是异步任务flushSyncCallbacks是异步任务的回调函数
		// 这意味着在同步执行当前函数的时候flushSyncCallbacks方法不会执行当执行的时候意味着同步任务已经添加完毕
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级 用宏任务调度
	}
}

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

// 从跟节点开始更新
function performSyncWorkOnRoot(root: fiberRootNode, lane: Lane) {
	const nextLane = getHighesPriorityLane(root.pendingLanes);
	if (nextLane !== SyncLane) {
		// 其他比Synclane低的优先级
		// NoLane
		// 为了保险可以再调用一次
		ensureRootIsScheduled(root);
		return;
	}
	// 初始化
	prepareFreshStack(root, lane);
	// 执行递归流程
	do {
		try {
			workLoop();
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

	// root.current.alternate就是workInProgress最开始指向的根节点
	// 这个时候的root.current.alternate已经是调度完成了，所以finishedWork会有最新的stateNode，也会有需要更新的flags标记
	const finishedWork = root.current.alternate;
	// 保存到finishedWork
	root.finishedWork = finishedWork;
	root.finishedLane = lane;
	wipRootRenderLane = NoLane;

	// 这里就可以根据fiberNode树 书中的flags
	commitRoot(root);
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

	// 移除
	markRootFinished(root, lane);

	// 判断是否存在3个子阶段需要执行得到操作
	// 需要判断root本身的flags以及root的subtreeFlags
	// 这里是按位与操作subtreeHasEffect !== NoFlags标识存在子节点需要更新操作
	const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	// rootHasEffect标识根节点存在需要更新的操作
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation Placement
		commitMutationEffects(finishedWork);
		root.current = finishedWork;

		// layout
	} else {
		root.current = finishedWork;
	}
}

function workLoop() {
	// 只要指针不等于null就能一直循环下去,这里也就是递归中的递
	// 但completeUnitOfWork中循环到最上层的时候workInProgress则为null就会中断这一层方法内的while循环
	while (workInProgress !== null) {
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
