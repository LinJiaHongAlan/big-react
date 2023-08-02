import { Container, appendInitialChild, createInstance, createTextInstance } from 'hostConfig';
import { FiberNode } from './fiber';
import { FunctionComponent, HostComponent, HostRoot, HostText, Fragment } from './workTags';
import { NoFlags, Update } from './filberFlags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

function markUpdate(fiber: FiberNode) {
	// 添加更新标记
	fiber.flags |= Update;
}

export const completeWork = (wip: FiberNode) => {
	// 递归中的归

	const newProps = wip.pendingProps;
	// 这里那上一个值，新的值在begin阶段就已经更新好了
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			// current !== null证明当前节点是被复用过的
			if (current !== null && wip.stateNode) {
				// update
				// 1判断props是否变化
				// 如果变了打上Update flag
				// 这里暂时先直接改
				updateFiberProps(wip.stateNode, newProps);
			} else {
				// 1.构建真实DOM
				const instance = createInstance(wip.type, newProps);
				// 2.将DOM插入到DOM树中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			// flags冒泡
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				// 1.构建DOM
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			// flags冒泡
			bubbleProperties(wip);
			return null;
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			// flags冒泡
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip);
			}
			break;
	}
};

// 接收一个parent以及要插入的FiberNode wip
function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child;
	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			// 处理函数组件
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === wip) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

// 向上冒泡
// completeWork是向上遍历的过程，所以拿到的节点一定是当前最顶部的节点，而咋子beginWork的过程中我们标记了flags
// 我们为了不让更新时候再次产生整个树的深层递归，定义了一个subtreeFage标记了当前DOM树中子节点是否存在需要操作的标记
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
}
