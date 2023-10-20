import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatch } from 'react/src/currentDispatcher';
import { DisPatcher } from 'react/src/currentDispatcher';
import { Flags, PassiveEffect } from './filberFlags';
import {
	Update,
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { HookHasEffect, Passive } from './hookEffectTags';

const { currentDispatcher } = internals;

// 当前正在render的FiberNode
let currentlyRenderingFiber: FiberNode | null = null;
// 当前正在处理的hook
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
	baseState: any;
	baseQueue: Update<any> | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

// 函数组件执行的方法
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作
	currentlyRenderingFiber = wip;
	// memoizedState这里是指向hook的链表
	wip.memoizedState = null;
	// 重置effect链表
	wip.updateQueue = null;
	// 接下来执行的时候我们需要创建这个链表
	renderLane = lane;

	const current = wip.alternate;
	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount，将mount阶段的hook集合塞进去，这样在函数执行的时候就可以成功调用到hooks
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	// 如果传入的是一个函数组件，那么FiberNode的type就是方法体
	const Component = wip.type;
	const props = wip.pendingProps;
	// 函数返回的就是children
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;
	return children;
}

// 挂载时的hooks集合
const HooksDispatcherOnMount: DisPatcher = {
	useState: mountState,
	useEffect: mountEffect
};

const HooksDispatcherOnUpdate: DisPatcher = {
	useState: updateState,
	useEffect: updateEffect
};

/**
 * 挂载的时候的useEffect方法
 * @param create useEffect第一个参数也就是回调函数
 * @param deps 依赖项
 */
function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// mountWorkInProgresHook这个方法就是生成一个hook对象，并且在hook链表中多添加一个
	const hook = mountWorkInProgresHook();
	const nextDeps = deps === undefined ? null : deps;
	// useEffect在初始化的时候需要执行create的回调函数所以我们要往flags添加一个PassiveEffect标记
	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
	// 往hook添加一个memoizedState,memoizedState在不同的hook中数据结构都不同，在useState中保存的是数据的状态
	// pushEffect是在useEffect的hook.memoizedState保存一个next，指向下一个useEffect的hook，形成一个环状链表
	hook.memoizedState = pushEffect(Passive | HookHasEffect, create, undefined, nextDeps);
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 这个是函数组件第一个调用的时候生成的hooks链表，同时会返回当前的hook对象
	const hook = updateWorkInProgresHook();
	// 依赖项
	const nextDeps = deps === undefined ? null : deps;
	// 上一次create返回的方法
	let destroy: EffectCallback | void;
	// 当前的hook跟updateWorkInProgresHook放回的hook算是同一个hook，只是updateWorkInProgresHook返回的hook是浅拷贝的对象,只保留了memoizedState跟updateQueue
	if (currentHook !== null) {
		// 这个是当前useEffect返回的hook.memoizedState中的effect对象
		const prevEffect = currentHook.memoizedState as Effect;
		// 在上一次的调度中，会执行commitHookEffectListCreate时候就会保存create的返回值destroy方法
		destroy = prevEffect.destroy;
		// 如果存在依赖项，则进行浅比较如果相等则中断pushEffect的操作
		if (nextDeps !== null) {
			// 浅比较依赖
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				// 依赖没有变
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}
		// 浅比较后不相等，标记PassiveEffect表示具有useEffect副作用
		(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
		hook.memoizedState = pushEffect(Passive | HookHasEffect, create, destroy, nextDeps);
	}
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}

/**
 * 生成effect环形链表，并将环形链表保存到updateQueue的lastEffect中
 * 将updateQueue保存到当前的fiber中意味着在fiber对象可以拿到当前的整个环状链表
 * @param hookFlags effect的类型(是否包含PassiveEffect)
 * @param create 创建的回调函数
 * @param destroy 销毁的回调函数
 * @param deps 依赖项
 * @returns 返回effect对象
 */
function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};
	// currentlyRenderingFiber是当前正在处理的FiberNode
	const fiber = currentlyRenderingFiber as FiberNode;
	let updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue === null) {
		updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		// 插入effect
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

/**
 * 组件更新的时候的useState
 * @returns
 */
function updateState<State>(): [State, Dispatch<State>] {
	// 拿到组件上一次的hook信息
	const hook = updateWorkInProgresHook();

	// 实现updateState中[计算新的state的逻辑]
	const queue = hook.updateQueue as UpdateQueue<State>;
	// 上一次最后一个没有被更新的值,初始化的时候为null
	const baseState = hook.baseState;

	// 本次调用的时候产生的新的待更新的update
	const pending = queue.shared.pending;
	// currentHook表示当前的hook是updateWorkInProgressHook方法内赋值的，跟updateWorkInProgressHook放回的hook是一样的,只是hook是从生成的一个新的对象并且next不赋值
	const current = currentHook as Hook;
	let baseQueue = current.baseQueue;

	if (pending !== null) {
		// 这里显然第一次的时候baseQueue是为null,将pendingQueue跟baseQueue合并成一个新的环状链表作为这次整体的更新
		if (baseQueue !== null) {
			// 将baseQueue跟pendingQueue合成一个环状链表
			// baseQueue b2 -> b0 -> b1 -> b2
			// pengdingQueue p2 -> p0 -> p1 -> p2
			// b0
			const baseFirst = baseQueue.next;
			// p0
			const pendingFirst = pending.next;
			// b2 -> p0
			baseQueue.next = pendingFirst;
			// p2 -> b0
			pending.next = baseFirst;
			// p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
		}
		// 在这里将baseQueue赋值为pending
		baseQueue = pending;
		// 保存在current中
		current.baseQueue = pending;
		// 保存在current之后就可以置空,因为之后未被更新的updateQueue会被保存到currentHook中
		queue.shared.pending = null;
	}
	// 如果合并后的baseQueue都为null的话则终止更新
	if (baseQueue !== null) {
		// 如果上一个组件有调用dispatch更改值的话，那么pending也就是传入的上一个调用dispatch的时候添加进得update
		/**
		 * processUpdateQueue消费update
		 * 传进去的参数
		 * baseState上一次最后一个没有被更新的值,如果是第一次则是null
		 * baseQueue这个给是将上次被调过的updateQueue跟需要更新的pendingQueue(如果在更新的过程中有调用新的setState则会产生新的更新)合并的一个对象
		 * renderLane本次更新的优先级
		 * 返回的参数
		 * memoizedState当前更新后的值（有可能是中间值）
		 * baseState表示本次更新没有被调过的最后一个的值
		 * baseQueue是被调过的update链表
		 */
		const {
			memoizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(baseState, baseQueue, renderLane);
		// 将最新的结果更新到hook中
		hook.memoizedState = memoizedState;
		hook.baseState = newBaseState;
		hook.baseQueue = newBaseQueue;
	}
	// 再将当前的新的hook结果返回出去
	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function updateWorkInProgresHook(): Hook {
	// TODO render阶段触发的更新
	let nextCurrentHook: Hook | null;

	if (currentHook === null) {
		// 这是这个FC update时的第一个hook
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
			nextCurrentHook = current?.memoizedState;
		} else {
			nextCurrentHook = null;
		}
	} else {
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		// mount/update u1 u2 u3
		// update       u1 u2 u3 u4
		throw new Error(`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`);
	}

	currentHook = nextCurrentHook as Hook;
	// 浅拷贝只取出需要的两个值memoizedState跟updateQueue，不能直接将currentHook赋值给workInProgressHook
	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
	};

	// 当前没有在操作的hook，表示这个阶段是第一次进来函数的时候执行的第一个hook
	if (workInProgressHook === null) {
		// 判断一下当前是否是在hooks的执行上下文中如果等于null则表示不是，那么就不是在函数组件中
		// mount时 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = newHook;
			// 当前的FiberNode.memoizedState指向该hook链表，因为其余的hook都在第一个hook的next中，所以第一个创建的hooks其实就包含所有的hook
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount时 后续的hook
		// 将后续生成的hook指向上一个hooks的next
		workInProgressHook.next = newHook;
		// 将当前的指针指向新的hook，这样下次调用就可以继续生成新的hook被当前的next所指向
		workInProgressHook = newHook;
	}
	return workInProgressHook;
}

function mountWorkInProgresHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null,
		baseQueue: null,
		baseState: null
	};
	// 当前没有在操作的hook，表示这个阶段是第一次进来函数的时候执行的第一个hook
	if (workInProgressHook === null) {
		// 判断一下当前是否是在hooks的执行上下文中如果等于null则表示不是，那么就不是在函数组件中
		// mount时 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = hook;
			// 当前的FiberNode.memoizedState指向该hook链表，因为其余的hook都在第一个hook的next中，所以第一个创建的hooks其实就包含所有的hook
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount时 后续的hook
		// 将后续生成的hook指向上一个hooks的next
		workInProgressHook.next = hook;
		// 将当前的指针指向新的hook，这样下次调用就可以继续生成新的hook被当前的next所指向
		workInProgressHook = hook;
	}
	return workInProgressHook;
}

// initialState就是函数组件调用useState传入得到值
function mountState<State>(initialState: (() => State) | State): [State, Dispatch<State>] {
	// 这个是函数组件第一个调用的时候生成的hooks链表，同时会返回当前的hook对象
	const hook = mountWorkInProgresHook();
	// 处理useState传入的值
	let memoizedState;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}
	// 给当前的hooks赋值一个updateQueue跟传入的值的处理结果memoizedState
	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memoizedState = memoizedState;

	// 锁定参数,为了dispatch能脱离当前点额函数调用
	// 将当前点额函数组件的FiberNode=currentlyRenderingFiber传递给dispatch以及当前的queue
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	// 将dispatch保存起来(暂时没看到一定要保存起来的必要)
	queue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

/**
 * 这个就是useState调用修改值的dispatch方法
 * @param fiber
 * @param updateQueue
 * @param action 传入的对象
 */
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	// 获取当前最高优先级的Lane在合成事件中，在合成事件中事件的回调方法会赋值对应的优先级,在事件的回调方法中会调用setState那么就会进入到这个方法
	// 所以requestUpdateLane就能拿到当前需要更新的优先级
	const lane = requestUpdateLane();

	// 创建一个update,将当前任务的优先级lane添加进去
	const update = createUpdate(action, lane);
	// 绑定update,enqueueUpdate方法支持多次添加会形成一个环状链表的结构,但更新多次调用的时候updateQueue会形成一个链表
	// 这里的updateQueue其实是保存在hooks中的，当调用scheduleUpdateOnFiber会调度方法重新渲染，之后会从新执行useState的update方法，每部会消费掉当前的updateQueue
	enqueueUpdate(updateQueue, update);
	// 执行调度,会重新调用renderRoot
	scheduleUpdateOnFiber(fiber, lane);
}
