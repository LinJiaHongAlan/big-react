// 描述宿主环境方法的文件
// 这里在tsconfig.json上配置一个paths,不需要直接通过引入
// 因为直接引入就会限制在react-reconciler中，但是实际上我们对于不同的宿主环境都要实现hostConfig

import { FiberNode } from 'react-reconciler/src/fiber';
import { HostComponent, HostText } from 'react-reconciler/src/workTags';
import { updateFiberProps, DOMElement } from './SyntheticEvent';
import { Props } from 'shared/ReactTypes';

// 比如react-dom的包的话他的实现就是在react-dom包下面
export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

// 暂时先把props去掉
export const createInstance = (type: string, props: Props): Instance => {
	// TODO 处理props
	const element = document.createElement(type) as unknown;
	updateFiberProps(element as DOMElement, props);
	return element as DOMElement;
};

export const appendInitialChild = (parent: Instance | Container, child: Instance) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memoizedProps.content;
			return commitTextUpdate(fiber.stateNode, text);
		case HostComponent:
			return updateFiberProps(fiber.stateNode, fiber.memoizedProps);
		default:
			if (__DEV__) {
				console.warn('未实现的Update类型', fiber);
			}
			break;
	}
}

// 在已有子节点之前插入新的子节点
export function insertChildToContainer(child: Instance, container: Container, before: Instance) {
	// document的原生方法，将child插入到container内部的before节点之前
	container.insertBefore(child, before);
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
	textInstance.textContent = content;
}

export function removeChild(child: Instance | TextInstance, container: Container) {
	container.removeChild(child);
}

export const scheduleMicroTask =
	typeof queueMicrotask === 'function'
		? queueMicrotask
		: typeof Promise === 'function'
		? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
		: setTimeout;

// 隐藏
export function hideInstance(instance: Instance) {
	const style = (instance as HTMLElement).style;
	style.setProperty('displat', 'none', 'important');
}

export function unhideInstance(instance: Instance) {
	const style = (instance as HTMLElement).style;
	style.display = '';
}

export function hideTextInstance(textInstance: Instance) {
	textInstance.nodeValue = '';
}

export function unhideTextInstance(textInstance: Instance, text: string) {
	textInstance.nodeValue = text;
}
