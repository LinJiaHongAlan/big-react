// 实现生成子节点以及标记Fibers的过程

import { Props, ReactElementType, Key } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFromElement,
	createWorkInProgress,
	createFiberFromFragment
} from './fiber';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { HostText, Fragment } from './workTags';
import { ChildDeletion, Placement } from './filberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

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
			// 将被移除的子节点
			returnFiber.deletions = [childToDelete];
			// 父节点中添加移除标记
			returnFiber.flags |= ChildDeletion;
		} else {
			returnFiber.deletions?.push(childToDelete);
		}
	}

	/**
	 * 标记删除的方法
	 * @param returnFiber 父节点
	 * @param currentFirstChild 将被删除的子节点
	 * @returns
	 */
	function deleteRemainingChildren(returnFiber: FiberNode, currentFirstChild: FiberNode | null) {
		// 是否追踪副作用
		if (!shouldTrackEffects) {
			return;
		}
		let childToDelete = currentFirstChild;
		// 循环移除兄弟节点
		while (childToDelete != null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
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
		// currentFiber也就是returnFiber的child子节点,如果是首次挂载的时候这个时候returnFiber由于还没有走到该方法下面的逻辑
		// 这意味着child还没有根据element生成并添加到child中，所以currentFiber === null,所以第一次加载的时候就不会复用FiberNode
		// 使得新返回出去的子节点的alternate为null
		while (currentFiber !== null) {
			// 如果旧的子节点FiberNode不为null，证明这个是update的情况
			if (currentFiber.key === key) {
				// key相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						let props = element.props;
						if (element.type === REACT_FRAGMENT_TYPE) {
							props = element.props.children;
						}
						// type也相同,可以复用
						const existing = useFiber(currentFiber, props);
						existing.return = returnFiber;
						// 当前节点可复用标记剩下的节点删除
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					}
					// type不同添加要删除的子节点并标记,并且要删掉所有旧的
					// 这里因为是在调用这个方法之前就判断了typeof element参数=== 'object'所以新的element不会是多个的情况
					deleteRemainingChildren(returnFiber, currentFiber);
					break;
				} else {
					// 如果ReactElementType不等于REACT_ELEMENT_TYPE类型就报错
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break;
					}
				}
			} else {
				// 如果key不相同，我们就删掉旧的，那么在下面就会创建新的
				// 添加要删除的子节点并标记
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}

		// 根据element创建Fiber
		let fiber;
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			fiber = createFiberFromElement(element);
		}
		// 将创建的fiber父节点指向returnFiber
		fiber.return = returnFiber;
		return fiber;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 类型没变，可以复用
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			}
			// 类型不一致需要删掉
			deleteChild(returnFiber, currentFiber);
			currentFiber = currentFiber.sibling;
		}
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	// 添加插入的标记
	function placeSingleChild(fiber: FiberNode) {
		// shouldTrackEffects表示需要追踪副作用
		// fiber代表着子节点的FiberNode,fiber.alternate === null,表示子节点是首次加载，否则表示是经过复用的，就不需要添加插入标记
		if (shouldTrackEffects && fiber.alternate === null) {
			// 按位或操作，添加插入标记
			fiber.flags |= Placement;
		}
		return fiber;
	}

	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFiberChild: FiberNode | null,
		newChild: any
	) {
		// 最后一个可复用fiber在current中的index
		let lastPlacedIndex = 0;
		// 创建的最后一个Fiber
		let lastNewFiber: FiberNode | null = null;
		// 创建的第一个Fiber
		let firstNewFiber: FiberNode | null = null;

		// 1.将current保存在map中
		const existingChildren: ExistingChildren = new Map();
		// currentFiberChild是旧的fiberNode他的结构是通过sibling这个来保存兄弟节点直接的关系，而newChild则是数组
		let current = currentFiberChild;
		// 遍历将FiberNode原本的链表形式保存到Map对象中
		while (current !== null) {
			// 如果存在key就有key最为键没有就用下标
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}

		// 循环ReactElement数组
		for (let i = 0; i < newChild.length; i++) {
			// 2.遍历newChild，寻找是否可复用
			const after = newChild[i];
			// updateFromMap这个方法大致就是根据after.key 或者是下标i在existingChildren中是否有相同类型的，有的话复用，没有的话返回新的
			// 同时会删除existingChildren中可复用的key，这意味着在当前的for循环走完之后，剩下的就是将要被删除的旧的fiber
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

			// 如果newFiber返回null就中断,目前文本节点就会返回不相同就会返回null
			if (newFiber === null) {
				continue;
			}

			// 3.标记移动还是插入
			// 给新节点中标记新的下标i
			newFiber.index = i;
			// 绑定父节点
			newFiber.return = returnFiber;
			if (lastNewFiber === null) {
				// 第一次的时候因为只有一个新旧节点都是一样的
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				// 当循环二次以上的时候lastNewFiber就是上一个节点标记为兄弟关系
				lastNewFiber.sibling = newFiber;
				// 将lastNewFiber指针指向新的节点
				lastNewFiber = lastNewFiber.sibling;
			}

			// 判断是否追踪副作用，不追追踪就结束
			if (!shouldTrackEffects) {
				continue;
			}
			// 获取新节点中的上一个节点,如果是复用节点那就current就会有值，否则就是mount
			const current = newFiber.alternate;
			if (current !== null) {
				// 拿出上一次节点的下标
				const oldIndex = current.index;
				if (oldIndex < lastPlacedIndex) {
					console.log('插入移动');
					// 移动
					newFiber.flags |= Placement;
				} else {
					console.log('不移动');
					// 不移动
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount,属于插入
				newFiber.flags |= Placement;
			}
		}
		// 4.将map中剩下的标记为删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});
		return firstNewFiber;
	}

	/**
	 * 从existingChildren的Map中判断是否存在可复用,不可复用则创建一个新的FiberNode返回同时删除existingChildren中可复用的的FiberNode
	 * @param returnFiber
	 * @param existingChildren
	 * @param index
	 * @param element 当结构为<ul><li>a</li><li>b</li>{arr}</ul>, element存在为数组的情况
	 * @returns
	 */
	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		// 如果element中没有key就是index
		const keyToUse = element.key !== null ? element.key : index;
		// 从Map中找到原有的Fiber
		let before;
		// 如果是textNode
		if (typeof element === 'string' || typeof element === 'number') {
			before = existingChildren.get(index);
			// HostText
			if (before) {
				// 如果fiber的类型是HostText证明是文本类型可以复用
				if (before.tag === HostText) {
					// 注意这里的delete是Map中的删除，从Map中删除这个信息，并不是添加删除的标记
					existingChildren.delete(index);
					// 返回复用的的fiber节点
					return useFiber(before, { content: element + '' });
				}
			}
		}

		// ReactElement
		if (typeof element === 'object' && element !== null) {
			// 处理element为数组的情况
			if (Array.isArray(element)) {
				// 处理Fragment
				/**
				 * element可能还是array 考虑如下，其中list是个array：
				 * <ul>
				 * 	<li></li>
				 * 	{list}
				 * </ul>
				 * 这种情况我们应该视element为Fragment
				 */
				before = existingChildren.get(index);
				// 通过updateFragment调用之后返回出去的就是Fragment类型的FiberNode节点
				// 如果element是数组的情况下就会返回一个Fragment类型的FiberNode，在begin阶段中就会往下遍历最终执行到这个Fragment类型的节点
				return updateFragment(returnFiber, before, element, index, existingChildren);
			}

			// 单一element节点
			before = existingChildren.get(keyToUse);
			// 处理element为单个节点的情况
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(returnFiber, before, element, index, existingChildren);
					}
					// element是标签节点
					if (before) {
						// type相同
						if (before.type === element.type) {
							// 这里同样也是删除Map中的数据，不是添加删除标记
							existingChildren.delete(keyToUse);
							// 返回一个复用的值
							return useFiber(before, element.props);
						}
					}
					// 如果类型不相同或者是旧的节点不存在， 就不可以复用，需要创建一个新的
					return createFiberFromElement(element);

					// TODO
					if (Array.isArray(element) && __DEV__) {
						console.warn('还未实现数组类型的child');
					}
			}
		}
		return null;
	}

	return function reconcileChildFibers(
		// 父节点的FiberNode
		returnFiber: FiberNode,
		// 当前节点的子节点的FiberNode
		currentFiber: FiberNode | null,
		// 子节点的ReactElement
		newChild?: any
	) {
		// 判断下Fragment
		// 对于类似 <ul><><li/><li/></></ul> 这样内部直接使用<>作为Fragment的情况
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;

		// 是否是Fragment
		if (isUnkeyedTopLevelFragment) {
			// 是的话往下取一层
			newChild = newChild?.props?.children;
		}

		// $$typeof除了文本节点不存在以外剩下的不管是组件还是普通节点或者是Fragment都为REACT_ELEMENT_TYPE
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					// 根据newChild生成一个新的FiberNode并且指向returnFiber，如果是首次渲染的话会直接给flags加上Placement标记
					// reconcileSingleElement方法返回的是currentFiber的子节点也就是currentFiber.child
					// placeSingleChild这里如果有追踪副作用的情况下会添加插入的标记Placement(给currentFiber.child添加)
					// 也就是说HostRoot的子节点在首次渲染的时候会添加Placement标记
					return placeSingleChild(reconcileSingleElement(returnFiber, currentFiber, newChild));
			}
			// 多节点的情况 ul > 3li
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild);
			}
		}
		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFiber, newChild));
		}

		// 兜底删除
		if (currentFiber !== null) {
			deleteRemainingChildren(returnFiber, currentFiber);
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

/**
 * 判断Fragment是否可复用，不可复用生成新的Fragment的FiberNode节点，并关联父级
 * @param returnFiber 父节点的FiberNode
 * @param current 旧得FiberNode首次加载为空
 * @param elements <ul><li>a</li><li>b</li>{arr}</ul>, element为数组的情况
 * @param key keyToUse存在key的情况下为key，否则为下标，当arr为数组的情况下，我们是将其看成为Fragment节点所以key为undefined
 * @param existingChildren 待处理的旧节点Map集合
 * @returns
 */
function updateFragment(
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) {
	let fiber;
	// 上一个节点不存在，或者不为Fragment类型
	if (!current || current.tag !== Fragment) {
		// 创建一个Fragment类型的FiberNode节点
		fiber = createFiberFromFragment(elements, key);
	} else {
		// 复用节点
		existingChildren.delete(key);
		fiber = useFiber(current, elements);
	}
	fiber.return = returnFiber;
	return fiber;
}

// 更新
export const reconcileChildFibers = ChildReconciler(true);
// 挂载
export const mountChildFibers = ChildReconciler(false);
