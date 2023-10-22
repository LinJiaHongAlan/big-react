import { Container } from 'hostConfig';
import { FiberNode, fiberRootNode } from './fiber';
import { HostRoot } from './workTags';
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate } from './updateQueue';
import { ReactElementType } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { requestUpdateLane } from './fiberLanes';
import { unstable_ImmediatePriority, unstable_runWithPriority } from 'scheduler';

// 实现mount时调用的api
export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	const root = new fiberRootNode(container, hostRootFiber);
	hostRootFiber.updateQueue = createUpdateQueue();
	return root;
}

// 执行render方法后内部调用的api
export function updateContainer(element: ReactElementType | null, root: fiberRootNode) {
	unstable_runWithPriority(unstable_ImmediatePriority, () => {
		const hostRootFiber = root.current;
		// 获取当前的优先级，这里由于是初始化那么方法内部调用的unstable_getCurrentPriorityLevel拿到的是默认值unstable_NormalPriority
		// 默认值unstable_NormalPriority转换为Lane是DefaultLane也就是4,因此我们需要在执行逻辑之前先使用unstable_runWithPriority方法设置一个默认值，让其变成同步更新
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
	});
}
