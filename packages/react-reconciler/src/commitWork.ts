import { Container, appendChildToContainer } from 'hostConfig';
import { FiberNode, fiberRootNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './filberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';

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
				commitMutationEffectsOnFiber(nextEffect);
				// 兄弟节点
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					nextEffect = sibling;
					break;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	if ((flags & Placement) !== NoFlags) {
		// 执行Placement操作
		commitPlacement(finishedWork);
		// 这个相当于删除的操作
		finishedWork.flags &= ~Placement;
	}
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}
	// parent DOM
	// 这里是拿到当前的fiberNode的父节点
	const hostParent = getHostParent(finishedWork);
	// 接下来找到finishedWork对应的DOM并且将DOM append 到 parentDOM中
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent);
	}
};

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

function appendPlacementNodeIntoContainer(finishedWork: FiberNode, hostParent: Container) {
	// 向下遍历
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		// 这里是将FiberNode的stateNode给插入到父级的DOM中，其实部分元素在completeWork已经插入，再调用一次的话等于将原来的DOM再插入一次，不会有任何变化，但貌似没有性能优化，这是一个没必要的操作
		// 只有在最后的当finishedWork = HostRootFiber的时候此时容器hostParent拿到的是挂载的节点#root这个时候就会挂载到界面上
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}
	// 到这里为组件类型，组件类型本身是不存在stateNode的所以我们需要取当前的FiberNode.child
	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
