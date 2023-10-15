import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane, NoLane, isSubsetOfLanes } from './fiberLanes';

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
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	// ReturnType是获取函数放回值的类型
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState,
		baseQueue: null
	};
	if (pendingUpdate !== null) {
		// 第一个update,因为是环状链表
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;

		// 最后一个没有被跳过的值后续逻辑中会赋值，初始化为传进来的值
		let newBaseState = baseState;
		let newBaseQueueFirst: Update<State> | null = null;
		let newBaseQueueLast: Update<State> | null = null;
		// 代表每次计算计算出来的结果
		let newState = baseState;

		// pending !== first循环一圈刚好就是遍历了一整条链表
		do {
			// 获取当前Update的优先级
			const updateLane = pending.lane;
			// 判断优先级是否足够
			if (!isSubsetOfLanes(renderLane, updateLane)) {
				// 优先级不够陪 被跳过
				// 先克隆一个被跳过的Update
				const clone = createUpdate(pending.action, pending.lane);
				// 判断是不是第一个被跳过的update
				if (newBaseQueueFirst === null) {
					newBaseQueueFirst = clone;
					newBaseQueueLast = clone;
					// 这里就是最后一个没有被跳过的值
					newBaseState = newState;
				} else {
					(newBaseQueueLast as Update<State>).next = clone;
					newBaseQueueLast = clone;
				}
			} else {
				// 优先级足够
				// 判断之前有没有被跳过的update
				if (newBaseQueueLast !== null) {
					// 如果之前有被跳过那么将当前的update保存到newBaseQueue中,并将优先级变为NoLane
					// 因为进入到当前的else判断中，证明当前的update优先级是足够的，NoLane在下一次重新计算的时候一定不会被跳过
					const clone = createUpdate(pending.action, NoLane);
					(newBaseQueueLast as Update<State>).next = clone;
					newBaseQueueLast = clone;
				}
				// 去除update的action循环更新得出最新的baseState
				// baseState 1 update (x) => 4x -> memoizedState 4
				const action = pendingUpdate?.action;
				if (action instanceof Function) {
					newState = action(baseState);
				} else {
					// baseState 1 update 2 -> memoizedState 2
					newState = action;
				}
				// if (__DEV__) {
				// 	console.error('不应该进入updateLane !== renderLane这个逻辑');
				// }
			}
			pending = pending?.next as Update<any>;
		} while (pending !== first);

		if (newBaseQueueLast === null) {
			// 代表本次计算没有update被跳过
			newBaseState = newState;
		} else {
			// 否则将BaseQueue合成一个环状链表
			newBaseQueueLast.next = newBaseQueueFirst;
		}
		// 从新赋值回给memoizedState
		result.memoizedState = newState;
		result.baseState = newBaseState;
		result.baseQueue = newBaseQueueLast;
	}
	return result;
};
