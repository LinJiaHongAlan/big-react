import {
	Container,
	Instance,
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	Fragment,
	ContextProvider,
	OffscreenComponent,
	SuspenseComponent
} from './workTags';
import { NoFlags, Ref, Update, Visibility } from './filberFlags';
import { popProvider } from './fiberContext';
import { popSuspenseHandler } from './suspenseContext';

function markRef(fiber: FiberNode) {
	fiber.flags |= Ref;
}

function markUpdate(fiber: FiberNode) {
	// 添加更新标记
	fiber.flags |= Update;
}

export const completeWork = (wip: FiberNode) => {
	// 递归中的归

	const newProps = wip.pendingProps;
	// 这里拿上一个值，新的值在begin阶段就已经更新好了
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			// current !== null证明当前节点是被复用过的
			if (current !== null && wip.stateNode) {
				// update
				// 1判断props是否变化
				// 如果变了打上Update flag
				// 这里暂时先直接改
				// updateFiberProps(wip.stateNode, newProps);
				// 直接加上Update标记，在commit阶段会通过commitUpdate处理
				markUpdate(wip);
				// 标记Ref
				if (current.ref !== wip.ref) {
					markRef(wip);
				}
			} else {
				// 1.构建真实DOM
				const instance = createInstance(wip.type, newProps);
				// 2.将DOM插入到DOM树中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
				// 标记Ref
				if (wip.ref !== null) {
					markRef(wip);
				}
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
		case OffscreenComponent:
			// flags冒泡
			bubbleProperties(wip);
			return null;
		case ContextProvider:
			// 拿到当前节点的context对象
			const context = wip.type._context;
			// 因为这里是completeWork所以经过的时候如果是context节点的时候必定是跳出这个节点的阶段，相反如果是beginWork阶段必定是进入这个节点的阶段
			// 因此这里需要调用popProvider，如果存在多层嵌套那么就会取到上一层的值赋值回当前的context._currentValue中,如果不存在就是赋值null
			popProvider(context);
			bubbleProperties(wip);
			return null;
		case SuspenseComponent:
			popSuspenseHandler();
			// 比较的逻辑应该放在这里，因为如果一直是挂起状态的话completeWork是不会经过OffscreenComponent
			const offscreenFiber = wip.child as FiberNode;
			const isHidden = offscreenFiber.pendingProps.mode === 'hidden';
			const currentOffscreenFiber = offscreenFiber.alternate;

			if (currentOffscreenFiber !== null) {
				// update流程
				const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden';
				// 这个地方判断offscreenFiber的状态是否发生了变化
				if (isHidden !== wasHidden) {
					// 如果发生了变化添加Visibility标记
					offscreenFiber.flags |= Visibility;
					// 冒泡的是子组件
					bubbleProperties(offscreenFiber);
				}
			} else if (isHidden) {
				offscreenFiber.flags |= Visibility;
				// 冒泡的是自组件
				bubbleProperties(offscreenFiber);
			}
			// SuspenseComponent是offscreenFiber的父节点上面将offscreenFiber完成了冒泡，其实就是冒泡到SuspenseComponent，完成以后SuspenseComponent自己也要冒泡一下
			bubbleProperties(wip);
			return;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip);
			}
			break;
	}
};

// 接收一个parent以及要插入的FiberNode wip
function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
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
