// 实现生成子节点以及标记Fibers的过程

import { Props, ReactElementType } from 'shared/ReactTypes';
import { FiberNode, createFiberFromElement, createWorkInProgress } from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './filberFlags';

// shouldTrackEffects是否应该追踪副作用false代表不需要
function ChildReconciler(shouldTrackEffects: boolean) {
	/**
	 * 添加并标记要删除旧的子节点
	 * @param returnFiber 父节点的FiberNode
	 * @param childToDelete 子节点的FiberNode
	 * @returns
	 */
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			// 如果不同追踪副作用的话直接return
			return;
		}
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			returnFiber.deletions?.push(childToDelete);
		}
	}

	// 通过ReactElementType生成新的FiberNode并建立父子的FiberNode的关系
	// 返回的是子FiberNode
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		if (currentFiber !== null) {
			// 如果旧的子节点FiberNode不为null，证明这个是update的情况
			work: if (currentFiber.key === key) {
				// key相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// type也相同,可以复用
						const existing = useFiber(currentFiber, element.props);
						existing.return = returnFiber;
						return existing;
					}
					// type不同添加要删除的子节点并标记
					deleteChild(returnFiber, currentFiber);
					break work;
				} else {
					// 如果ReactElementType不等于REACT_ELEMENT_TYPE类型就报错
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break work;
					}
				}
			} else {
				// 如果key不相同，我们就删掉旧的，那么在下面就会创建新的
				// 添加要删除的子节点并标记
				deleteChild(returnFiber, currentFiber);
			}
		}

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
		if (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 类型没变，可以复用
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				return existing;
			}
			// 类型不一致需要删掉
			deleteChild(returnFiber, currentFiber);
		}
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	// 插入单一的节点(性能优化)
	// 打上标记
	function placeSingleChild(fiber: FiberNode) {
		// 在首屏渲染的情况下
		if (shouldTrackEffects && fiber.alternate === null) {
			// 按位或操作
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
					// 根据newChild生成一个新的FiberNode并且指向returnFiber，如果是首次渲染的话会直接给flags加上Placement标记
					// reconcileSingleElement方法返回的是currentFiber的子节点也就是currentFiber.child
					// placeSingleChild这里如果有追踪副作用的情况下会添加插入的标记Placement(给currentFiber.child添加)
					// 也就是说HostRoot的子节点在首次渲染的时候会添加Placement标记
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

		// 兜底删除
		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber);
		}

		// 如果以上都没有
		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild);
		}
		return null;
	};
}

// 复用的方法
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	// 克隆一个fiber
	const clone = createWorkInProgress(fiber, pendingProps);
	// 索引赋值为0
	clone.index = 0;
	// 兄弟节点为null
	clone.sibling = null;
	return clone;
}

// 更新
export const reconcileChildFibers = ChildReconciler(true);
// 挂载
export const mountChildFibers = ChildReconciler(false);
