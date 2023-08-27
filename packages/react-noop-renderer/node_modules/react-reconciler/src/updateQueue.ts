import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

// Update是代表更新的数据结构
export interface Update<State> {
	// this.state(action就是接收的这个action)
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}

// 消费Update的数据结构，一个UpdateQueue里面有个shared.pending 指向Update
export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

// 实现创建update实例的方法createUpdate
export const createUpdate = <State>(action: Action<State>, lane: Lane): Update<State> => {
	// 返回update的实例
	return {
		action,
		lane,
		next: null
	};
};

// 实现创建UpdateQueue实例的方法
// UpdateQueue是一个保存Update的数据结构
export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

// 往UpdateQueue里增加Update
export const enqueueUpdate = <State>(updateQueue: UpdateQueue<State>, update: Update<State>) => {
	const pending = updateQueue.shared.pending;
	// 这里会形成一个环状链表
	if (pending === null) {
		// a -> a
		update.next = update;
	} else {
		// pending = b -> a -> b
		// pending = c -> a -> b -> c
		update.next = pending.next;
		pending.next = update;
	}
	updateQueue.shared.pending = update;
};

// enqueueUpdate消费Update的方法
// 接收一个初始的状态baseState以及要消费的Update pendingUpdate
// 返回值是全新的状态memoizeState
// Update为一个链表.next就是下一个Update
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	// ReturnType是获取函数放回值的类型
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};
	if (pendingUpdate !== null) {
		// 第一个update,因为是环状链表
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;
		// pending !== first循环一圈刚好就是遍历了一整条链表
		do {
			// 获取当前Update的优先级
			const updateLane = pending.lane;
			// 判断当前消费的优先级是否相等
			if (updateLane === renderLane) {
				// 去除update的action循环更新得出最新的baseState
				// baseState 1 update (x) => 4x -> memoizedState 4
				const action = pendingUpdate?.action;
				if (action instanceof Function) {
					baseState = action(baseState);
				} else {
					// baseState 1 update 2 -> memoizedState 2
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.error('不应该进入updateLane !== renderLane这个逻辑');
				}
			}
			pending = pending?.next as Update<any>;
		} while (pending !== first);
	}
	// 从新赋值回给memoizedState
	result.memoizedState = baseState;
	return result;
};
