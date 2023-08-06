import { Container } from 'hostConfig';
import { FiberNode, fiberRootNode } from './fiber';
import { HostRoot } from './workTags';
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate } from './updateQueue';
import { ReactElementType } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { requestUpdateLane } from './fiberLanes';

// 实现mount时调用的api
export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	const root = new fiberRootNode(container, hostRootFiber);
	hostRootFiber.updateQueue = createUpdateQueue();
	return root;
}

// 执行render方法后内部调用的api
export function updateContainer(element: ReactElementType | null, root: fiberRootNode) {
	const hostRootFiber = root.current;
	const lane = requestUpdateLane();
	// 创建一个新的额Update
	// element也就是render传进来的ReactElementType
	const update = createUpdate<ReactElementType | null>(element, lane);
	// UpdateQueue是保存Update的数据结构
	// enqueueUpdate是将Update保存进UpdateQueue
	// 这里会将{ action: ReactElementType }结构数据保存金hostRootFiber.updateQueue.shared.padding里面
	enqueueUpdate(hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>, update);
	// 然后执行调度
	scheduleUpdateOnFiber(hostRootFiber, lane);
	return element;
}
