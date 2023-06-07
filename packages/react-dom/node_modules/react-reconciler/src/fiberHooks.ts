import { FiberNode } from './fiber';

// 当前正在render的FiberNode
let currentlyRenderingFiber: FiberNode | null = null;

export function renderWithHooks(wip: FiberNode) {
	// 赋值操作
	currentlyRenderingFiber = wip;

	// 如果传入的是一个函数组件，那么FiberNode的type就是方法图
	const Component = wip.type;
	const props = wip.pendingProps;
	// 函数返回的就是children
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	return children;
}
