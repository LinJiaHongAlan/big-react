import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';

// Update是代表更新的数据结构
export interface Update<State> {
	// this.state(action就是接收的这个action)
	action: Action<State>;
}

// 消费Update的数据结构，一个UpdateQueue里面有个shared.pending 指向Update
export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

// 实现创建update实例的方法createUpdate
export const createUpdate = <State>(action: Action<State>): Update<State> => {
	// 返回update的实例
	return {
		action
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
	updateQueue.shared.pending = update;
};

// enqueueUpdate消费Updated的方法
// 接收一个初始的状态baseState以及要消费的UpdatependingUpdate
// 返回值是全新的状态memoizeState
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null
): { memoizedState: State } => {
	// ReturnType是获取函数放回值的类型
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};
	if (pendingUpdate !== null) {
		// baseState 1 update (x) => 4x -> memoizedState 4
		const action = pendingUpdate?.action;
		if (action instanceof Function) {
			result.memoizedState = action(baseState);
		} else {
			// baseState 1 update 2 -> memoizedState 2
			result.memoizedState = action;
		}
	}
	return result;
};
