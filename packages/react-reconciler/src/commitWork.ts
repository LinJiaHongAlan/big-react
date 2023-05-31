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

		if ((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child !== null) {
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
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}
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
