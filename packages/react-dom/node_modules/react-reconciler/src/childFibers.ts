// 实现生成子节点以及标记Fibers的过程

import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode, createFiberFromElement } from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { Placement } from './filberFlags';

// shouldTrackEffects是否应该追踪副作用false代表不需要
function ChildReconciler(shouldTrackEffects: boolean) {
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 根据element创建Fiber
		const fiber = createFiberFromElement(element);
		// 将创建的fiber父节点指向returnFiber
		fiber.return = returnFiber;
		return fiber;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	// 插入单一的节点(性能优化)
	function placeSingleChild(fiber: FiberNode) {
		// 在首屏渲染的情况下
		if (shouldTrackEffects && fiber.alternate === null) {
			// 安慰或操作
			fiber.flags |= Placement;
		}
		return fiber;
	}

	return function reconcileChildFibers(
		// 父节点的FiberNode
		returnFiber: FiberNode,
		// 当前节点的子节点的FiberNode
		currentFiber: FiberNode | null,
		// 子节点的ReactElement
		newChild?: ReactElementType
	) {
		// 判断当前fiber的类型
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(reconcileSingleElement(returnFiber, currentFiber, newChild));
				default:
					if (__DEV__) {
						console.warn('未实现的reconcile类型', newChild);
					}
					break;
			}
		}
		// 多节点的情况 ul > 3li
		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFiber, newChild));
		}
		// 如果以上都没有
		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild);
		}
		return null;
	};
}

// 更新
export const reconcileChildFibers = ChildReconciler(true);
// 挂载
export const mountChildFibers = ChildReconciler(false);
