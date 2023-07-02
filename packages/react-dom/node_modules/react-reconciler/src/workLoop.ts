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
	// workInProgress：触发更新后，正在reconciler中计算的fiberNode树
	// createWorkInProgress的作用是传入一个hostRootFiber（也是FiberNode类型）然后返回一个新的hostRootFiber,并将旧的信息保存到hostRootFiber.alternate里面
	// 保存到workInProgress中
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

// 从跟节点开始更新
function renderRoot(root: fiberRootNode) {
	// 初始化
	prepareFreshStack(root);
	// 执行递归流程
	do {
		try {
			workLoop();
			// 没有问题这里会直接跳出,到这个阶段的workInProgress已经遍历完，workInProgress会指向null
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误');
			}
			// 改变指针
			workInProgress = null;
		}
	} while (true);

	// root.current.alternate就是workInProgress最开始指向的根节点
	// 这个时候的root.current.alternate已经是调度完成了，所以finishedWork会有最新的stateNode，也会有需要更新的flags标记
	const finishedWork = root.current.alternate;
	// 保存到finishedWork
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
		console.log('commit阶段开始', finishedWork);
	}

	// 重置
	root.finishedWork = null;

	// 判断是否存在3个子阶段需要执行得到操作
	// 需要判断root本身的flags以及root的subtreeFlags
	// 这里是按位与操作subtreeHasEffect !== NoFlags标识存在子节点需要更新操作
	const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	// rootHasEffect标识根节点存在需要更新的操作
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
	// 但completeUnitOfWork中循环到最上层的时候workInProgress则为null就会中断这一层方法内的while循环
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// beginWork会拿到下一层得到子FiberNode
	const next = beginWork(fiber);
	// 更新Props的值，memoizedProps这个值其实就是对于的ReactElement的Props，里面有后续节点的信息
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
