import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import { FunctionComponent, HostComponent, WorkTag, Fragment } from './workTags';
import { Flags, NoFlags } from './filberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';

/**
 * @tag 表示FiberNode是什么类型的节点
 */
export class FiberNode {
	// 这个就是ReactElementType的type值，当为组件的时候type就是方法体，如果为普通节点type就是'div'之类的字符串，跟vue的h函数的第一个参数一个概念
	type: any;
	// 这里也是也是区分不同节点类型的一个地方,在根据ReactElementType创建FiberNode的时候有做判断，唯独多了一个HostRoot的类型，是ReactElementType没有的
	tag: WorkTag;
	pendingProps: Props;
	key: Key;
	stateNode: any;
	ref: Ref;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	memoizedProps: Props | null;
	memoizedState: any;
	// 用于FiberNode和另外一个FiberNode之间切换
	alternate: FiberNode | null;
	// 保存操作标记
	flags: Flags;
	// 代表子树中包含的flags
	subtreeFlags: Flags;
	updateQueue: unknown;
	deletions: FiberNode[] | null;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// 实例
		this.tag = tag;
		this.key = key || null;
		// stateNode比如对于HostComponent来说 <div> div DOM
		this.stateNode = null;
		// 对于FunctionComponent来说 type是 () => {}
		this.type = null;

		// 除了作为一个实例还有一个字段来表示节点关系
		// 构成树状结构
		// 指向父fiberNode
		this.return = null;
		// 指向兄弟fiberNode
		this.sibling = null;
		// 指向子fiberNode
		this.child = null;
		// <ul><li></li></ul>
		this.index = 0;
		this.ref = null;

		// 作为工作单元
		// 刚开始工作的时候的props是什么
		this.pendingProps = pendingProps;
		// 工作完之后的props是什么,也就是确定下来的props是什么
		this.memoizedProps = null;
		this.memoizedState = null;
		this.alternate = null;
		this.updateQueue = null;
		// 副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;
	}
}

export interface PendingPassiveEffects {
	// 在commit阶段的ChildDeletion标记的时候收集的回调
	unmount: Effect[];
	// 在commit阶段的PassiveEffect标记的时候收集的回调
	update: Effect[];
}

// 实现根节点fiberRootNode
export class fiberRootNode {
	// 宿主环境的dom挂载的节点
	// 但是我们不能直接定义为rootElement，因为对于其他环境就不是Element,我们需要一个更加抽象的名字
	container: Container;
	// 这个指向hostRootFiber
	current: FiberNode;
	// 这个指向我们更新完成以后的hostRootFiber
	finishedWork: FiberNode | null;
	// 代表所有没有被消费的Lane的集合
	pendingLanes: Lanes;
	// 本次更新消费的Lane
	finishedLane: Lane;
	// effect回调方法储存的地方，在commit阶段通过commitPassiveEffect去收集回调
	pendingPassiveEffects: PendingPassiveEffects;
	callbackNode: CallbackNode | null;
	callbackPriority: Lane;

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
		this.finishedLane = NoLanes;
		this.pendingLanes = NoLane;
		this.callbackNode = null;
		this.callbackPriority = NoLane;
		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
	}
}

// current也就是hostRootFiber
// 这里用到了双缓存技术，
export const createWorkInProgress = (current: FiberNode, pendingProps: Props): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		// 对于首屏渲染wip就是null
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.type = current.type;
		wip.stateNode = current.stateNode;

		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		// 将副作用东西全部清除
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;
	wip.ref = current.ref;

	return wip;
};

// 根据element创建fiber
export function createFiberFromElement(element: ReactElementType): FiberNode {
	const { type, key, props, ref } = element;
	// 根据不同的type来返回不同的FiberNode
	let fiberTag: WorkTag = FunctionComponent;
	if (typeof type === 'string') {
		// <div> type 'div'
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	fiber.ref = ref;
	return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
}
