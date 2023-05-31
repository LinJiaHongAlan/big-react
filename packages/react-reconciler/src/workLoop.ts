// 这个是完整的工作循环的文件
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, createWorkInProgress, fiberRootNode } from './fiber';
import { MutationMask, NoFlags } from './filberFlags';
import { HostRoot } from './workTags';

// 我们这里需要一个全局的指针来指向当前工作的FiberNode
let workInProgress: FiberNode | null = null;

// 初始化workInProgress
function prepareFreshStack(root: fiberRootNode) {
	// root.current也就是hostRootFiber
	workInProgress = createWorkInProgress(root.current, {});
}

// 连接Container以及renderRoot的方法
// 在Fiber调度Update
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// TODO 调度功能
	// 拿到根节点fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	// 调用renderRoot开始跟新
	renderRoot(root);
}

// 向上遍历拿到fiberRootNode
export function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

// 假设我们最终执行的方法叫
function renderRoot(root: fiberRootNode) {
	// 初始化
	prepareFreshStack(root);
	// 执行递归流程
	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误');
			}
			// 改变指针
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	// 这里就可以根据fiberNode树 书中的flags
	commitRoot(root);
}

function commitRoot(root: fiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}

	// 重置
	root.finishedWork = null;

	// 判断是否存在3个子阶段需要执行得到操作
	// 需要判断root本身的flags以及root的subtreeFlags
	const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation Placement
		commitMutationEffects(finishedWork);
		root.current = finishedWork;

		// layout
	} else {
		root.current = finishedWork;
	}
}

function workLoop() {
	// 只要指针不等于null就能一直循环下去,这里也就是递归中的递
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// beginWork会拿到下一层得到子FiberNode
	const next = beginWork(fiber);
	fiber.memoizedProps = fiber.pendingProps;
	// 判断是否有下一层的FiberNode
	if (next === null) {
		// 不存在调用归
		completeUnitOfWork(fiber);
	} else {
		// 存在则指针指向下一层
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		// 执行递归中的归
		completeWork(node);
		// 拿到兄弟节点

		const sibling = node.sibling;
		if (sibling) {
			// 如果兄弟节点存在则指针指向兄弟节点
			workInProgress = sibling;
			return;
		}

		// 如果兄弟节点不存在则拿父级节点
		node = node.return;
		// 改变指针指向父级
		workInProgress = node;
	} while (node !== null);
}
