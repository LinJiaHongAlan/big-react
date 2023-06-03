import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import { HostComponent, HostRoot, HostText } from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';

// 递归中的递阶段
// beginWork的工作流程
// 1.计算状态的最新值
// 2.创造子fiberNode
export const beginWork = (wip: FiberNode) => {
	// 比较，返回子fiberNode
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};

function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	// 取出的pending就是Update对象
	// Update的对象里面包含action，action的值是传进来的ReactElementType对象
	const pending = updateQueue.shared.pending;
	// 清空原有对象中的pending
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending);
	// 从目前上看这里是拿到了ReactElementType对象并且保存到memoizedState
	wip.memoizedState = memoizedState;
	// 这是更新后的ReactElementType
	const nextChildren = wip.memoizedState;
	// 比较子节点赋值回新的child
	reconileChildren(wip, nextChildren);
	// 返回子节点
	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconileChildren(wip, nextChildren);
	return wip.child;
}

// 这个方法整体就是传入FiberNode以及当前子节点的ReactElementType
// 然后比较FiberNode子节点与ReactElementType生成新的子节点FiberNode
function reconileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate;

	if (current !== null) {
		// update
		// 比较子节点的current与子节点的ReactElementType
		// wip是当前的FiberNode父节点, current.child是上一个FiberNode子节点, children是当前的ReactElementType子节点
		// 目前的方法是根据children直接生成新的FiberNode,并将return指向wip,并加上flags标记
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
}
