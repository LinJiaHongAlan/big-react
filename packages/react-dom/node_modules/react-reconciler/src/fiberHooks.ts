import { FiberNode } from './fiber';

export function renderWithHooks(wip: FiberNode) {
	// 如果传入的是一个函数组件，那么FiberNode的type就是方法图
	const Component = wip.type;
	const props = wip.pendingProps;
	// 函数返回的就是children
	const children = Component(props);
	return children;
}
