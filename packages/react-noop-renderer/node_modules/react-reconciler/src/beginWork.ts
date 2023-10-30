import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import { FunctionComponent, HostComponent, HostRoot, HostText, Fragment } from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { Ref } from './filberFlags';

// 递归中的递阶段
// beginWork的工作流程
// 1.计算状态的最新值
// 2.创造子fiberNode
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	// 比较，返回子fiberNode
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};

function updateFragment(wip: FiberNode) {
	// 在Fragment中pendingProps就是被包裹的子节点，在childFiber.ts中updateFragment方法中调用createFiberFromFragment产生的Fragment类型的节点
	const nextChildren = wip.pendingProps;
	// 拿到节点之后就会继续往下执行
	reconileChildren(wip, nextChildren);
	return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	// renderWithHooks方法就是执行函数组件wip的方法
	// 当执行完内部的函数方法之后，就会再次调用到useState,那么就会走到update生命周期的hook,会消费上一次dispatch传入的action,最终返回函数组件内部的返回的ReactElementType
	const nextChildren = renderWithHooks(wip, renderLane);
	reconileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	// 取出的pending就是Update对象
	// Update的对象里面包含action，action的值是传进来的ReactElementType对象
	const pending = updateQueue.shared.pending;
	// 清空原有对象中的pending
	updateQueue.shared.pending = null;
	// renderLane是本地消费的优先级，会循环updateQueue中的所有Update优先级相同的Update消费并更新baseState
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
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
	// 绑定ref
	markRef(wip.alternate, wip);
	reconileChildren(wip, nextChildren);
	return wip.child;
}

// 这个方法整体就是传入FiberNode以及当前子节点的ReactElementType
// 然后比较FiberNode子节点与ReactElementType生成新的子节点FiberNode并添加上操作标记
// 将FiberNode从新与当前父节点的FiberNode保存起来
function reconileChildren(wip: FiberNode, children?: ReactElementType) {
	// 目前只有HostRootFiber是有alternate的
	const current = wip.alternate;

	if (current !== null) {
		// update
		// 比较子节点的current与子节点的ReactElementType
		// wip是当前的FiberNode父节点, current.child是上一个FiberNode子节点, children是当前的ReactElementType子节点
		// 目前的方法是根据children直接生成新的FiberNode,并将return指向wip,并加上flags标记
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		// 不追踪副作用
		wip.child = mountChildFibers(wip, null, children);
	}
}

/**
 * 在beginWork中标记Ref的方法
 * @param current 上一次的FiberNode
 * @param workInProgress 当前新的工作中的FiberNode
 */
function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	// 这里实际上就是从FiberNode节点上拿到ref的属性的值，也就是我们通常在标签上绑定的那个ref属性,而ref属性就是通过useRef返回的一个带有current属性的一个对象
	const ref = workInProgress.ref;

	// current为null意味着是mount时
	if ((current === null && ref !== null) || (current !== null && current.ref !== ref)) {
		workInProgress.flags |= Ref;
	}
}
