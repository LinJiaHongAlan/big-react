import { Container, Instance, appendChildToContainer, commitUpdate, removeChild } from 'hostConfig';
import { FiberNode, fiberRootNode } from './fiber';
import { ChildDeletion, MutationMask, NoFlags, Placement, Update } from './filberFlags';
import { FunctionComponent, HostComponent, HostRoot, HostText } from './workTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		// 向下遍历
		const child: FiberNode | null = nextEffect.child;

		// 这里这么做的原因，是找到最下级的需要操作的子节点，从当前子节点开始往上遍历之后再调用commitMutationEffectsOnFiber开始每个操作
		if ((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child !== null) {
			// 若存在子节点需要更新的操作则向下继续遍历
			nextEffect = child;
		} else {
			// 证明要找的子节点不包含subtreeFlags
			// 向上遍历DFS
			while (nextEffect !== null) {
				// 这里是处理节点的核心
				commitMutationEffectsOnFiber(nextEffect);
				// 兄弟节点
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					// 如果存在兄弟节点，我们先处理兄弟节点，直到没有再向上找父级
					nextEffect = sibling;
					break;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

// commit节点向上递归开始处理标记的方法
const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	if ((flags & Placement) !== NoFlags) {
		// 执行Placement这个是插入或者移动标记
		// 会将finishedWork插入到父级的上一层，如果父级是HostRoot则直接插入到容器里面
		commitPlacement(finishedWork);
		// 去除标记
		finishedWork.flags &= ~Placement;
	}

	if ((flags & Update) !== NoFlags) {
		// 执行Update操作
		commitUpdate(finishedWork);
		// 去除标记
		finishedWork.flags &= ~Update;
	}

	if ((flags & ChildDeletion) !== NoFlags) {
		// 删除操作
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			// deletions是一个数组
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete);
			});
		}
		// 去除标记
		finishedWork.flags &= ~ChildDeletion;
	}
};

/**
 * 当出现<><div>1</div><div>2</div></>这种情况的时候由于Fragment不是一个真实存在的节点所以不能用来执行removeDom的操作
 * 考虑删除Fragment后，子树的根Host节点可能存在多个
 * @param childrenToDelete
 * @param unmountFiber
 */
function recordHostChildrenToDelete(childrenToDelete: FiberNode[], unmountFiber: FiberNode) {
	// 1.找到第一个root host节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1];
	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			// 是否与第一个被收集的节点是兄弟节点，是的话一并添加到childrenToDelete待删除
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
	// 2.没找到一个 host 节点，判断下这个节点是不是 1 找到那个节点的兄弟节点
}

function commitDeletion(childToDelete: FiberNode) {
	// 当前正在处理的FiberNode的根
	const rootChildrenToDelete: FiberNode[] = [];

	// 递归子树
	commitNestedUnmounts(childToDelete, (unmountFiber) => {
		// 当前方法会递归节点childToDelete下所有的子节点
		// 当出现 <div>
		//   <>
		//      <p>xxx</p>
		//      <p>yyy</p>
		//   </>
		// </div> 的时候由于<></>不是一个真实的节点所以不能添加到rootChildrenToDelete中
		// Fragment节点在当前switch中不会被处理,所以当childToDelete节点为Fragment的时候第一个被处理的节点是Fragment的非Fragment类型的子节点
		// 考虑删除Fragment后，子树的根Host节点可能存在多个,我们需要recordHostChildrenToDelete方法来收集第一个节点有可能存在多个节点的可能
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				// TODO 解绑ref
				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				// TODO useEffect unmount的处理
				return;
		}
	});

	// 移除rootHostComponent的DOM
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent);
			});
		}
	}
	childToDelete.return = null;
	childToDelete.child = null;
}

/**
 * 递归子树的方法
 * @param root 接收一个递归子树的根节点
 * @param onCommitUnmount 接收到的当前点递归的回调函数
 */
function commitNestedUnmounts(root: FiberNode, onCommitUnmount: (fiber: FiberNode) => void) {
	let node = root;
	while (true) {
		onCommitUnmount(node);
		if (node.child !== null) {
			// 向下遍历
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) {
			// 终止条件
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			// 向上归
			node = node.return;
		}
		// 存在兄弟节点
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

// 这里是处理Placement标记的函数
const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.log('执行Placement操作', finishedWork);
	}
	// parent DOM
	// 这里是拿到当前的fiberNode的父节点的宿主环境Container
	const hostParent = getHostParent(finishedWork);

	// 找出当前节点的下一个没有添加Placement的兄弟节点，如果是最后一个就返回null
	const sibling = getHostSibling(finishedWork);
	// 接下来找到finishedWork对应的DOM并且将DOM append 到 parentDOM中
	if (hostParent !== null) {
		// 如果sibling为null调用appendChild插入到最后，如果不为null则插入到sibling之前
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		// 这里是考虑到当前节点为组件的根节点的时候我们的相邻节点其实是组件的节点，所以要通过return取到上一级组件节点的相邻节点
		// <Component><div>当前为组件根节点相邻节点是当前fiberNode.return.siblint</div></Component><div></div>
		while (node.sibling === null) {
			// 当前节点若不存在兄弟节点则往上获取父级
			const parent = node.return;

			// 判断是否是组件
			if (parent === null || parent.tag === HostComponent || parent.tag === HostRoot) {
				return null;
			}
			// 如果是组件继续往上找
			node = parent;
		}

		// 如果下一级兄弟节点存在，改变兄弟节点的父级指向,并将当前指正指向兄弟节点
		node.sibling.return = node.return;
		node = node.sibling;

		// 这里处理兄弟节点是组件的情况，如果是组件我们应该插入到组件的根节点
		// <div></div><Component><div>我是兄弟节点的组件插入到我的前面</div></Component>
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历
			if ((node.flags & Placement) !== NoFlags) {
				// 判断下组件的根节点时候是不移动类型，如果同样是有Placement标记的花我们应该跳出当前循环继续往下寻找
				continue findSibling;
			}
			// 如果组件类型为null同样跳出
			if (node.child === null) {
				continue findSibling;
			} else {
				// 如果存在并且不为移动类型，则将指针指向当前节点继续再while循环中判断
				node.child.return = node;
				node = node.child;
				// 这里为何不直接跳出是还有组件内继续还是组件的可能性
			}
		}

		// 这里找到下一个最近的不移动的节点
		// 13245 -> 21354
		// 那么需要移动的就是134
		// 1的下一个不移动节点是5，插入到5的前面变成32415
		// 3的下一个不移动节点是5，插入到前面变成24135  -----> 这里由于1跟3前面都是5所以先执行移动的必定再后执行移动的左边，因此符合新节点的顺序
		// 4的不存在下一个不移动节点，插入最后21354
		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
		// 如果当前节点是也是被打上Placement标记结束当前循环继续往下
	}
}

// 获得父级的宿主环境的节点
function getHostParent(fiber: FiberNode): Container | null {
	// 执行一个向上遍历的过程
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;
		// 那种环境下parentTag才对呀的是宿主环境下的父级节点呢
		// HostComponent HostRoot
		if (parentTag === HostComponent) {
			return parent.stateNode;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as fiberRootNode).container;
		}
		parent = parent.return;
		if (__DEV__) {
			console.warn('未找到host: parent');
		}
	}

	return null;
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before: Instance
) {
	// 向下遍历
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		// 这里是将FiberNode的stateNode给插入到父级的DOM中，其实部分元素在completeWork已经插入,目前的话这里只有HostRoot的时候才会在HostRoot.child上面添加上插入标记
		// 只有在最后的当finishedWork = HostRootFiber的时候此时容器hostParent拿到的是挂载的节点#root这个时候就会挂载到界面上
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			console.log('后面插入', hostParent, finishedWork.stateNode);
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}
		return;
	}
	// 到这里为组件类型，组件类型本身是不存在stateNode的所以我们需要取当前的FiberNode.child
	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent, before);
		let sibling = child.sibling;

		// 组件内有可能是多个根节点
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent, before);
			sibling = sibling.sibling;
		}
	}
}

// 在已有子节点之前插入新的子节点
export function insertChildToContainer(child: Instance, container: Container, before: Instance) {
	// document的原生方法，将child插入到container内部的before节点之前
	container.insertBefore(child, before);
}
