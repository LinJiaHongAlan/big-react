import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatch } from 'react/src/currentDispatcher';
import { DisPatcher } from 'react/src/currentDispatcher';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

const { currentDispatcher } = internals;

// 当前正在render的FiberNode
let currentlyRenderingFiber: FiberNode | null = null;
// 当前正在处理的hook
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

// 函数组件执行的方法
export function renderWithHooks(wip: FiberNode) {
	// 赋值操作
	currentlyRenderingFiber = wip;
	// memoizedState这里是指向hook的链表
	wip.memoizedState = null;
	// 接下来执行的时候我们需要创建这个链表

	const current = wip.alternate;
	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount，将mount阶段的hook集合塞进去，这样在函数执行的时候就可以成功调用到hooks
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	// 如果传入的是一个函数组件，那么FiberNode的type就是方法图
	const Component = wip.type;
	const props = wip.pendingProps;
	// 函数返回的就是children
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	return children;
}

// 挂载时的hooks集合
const HooksDispatcherOnMount: DisPatcher = {
	useState: mountState
};

const HooksDispatcherOnUpdate: DisPatcher = {
	useState: updateState
};

// initialState就是函数组件调用useState传入得到值
function updateState<State>(): [State, Dispatch<State>] {
	// 这个是函数组件第一个调用的时候生成的hooks链表，同时会返回当前的hook对象
	const hook = updateWorkInProgresHook();

	// 实现updateState中[计算新的state的逻辑]
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(hook.memoizedState, pending);
		hook.memoizedState = memoizedState;
	}

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
	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null
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
	// 创建一个update
	const update = createUpdate(action);
	// 绑定update
	enqueueUpdate(updateQueue, update);
	// 执行调度,会重新调用renderRoot
	scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgresHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
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
