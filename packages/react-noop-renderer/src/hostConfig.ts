// 描述宿主环境方法的文件
// 这里在tsconfig.json上配置一个paths,不需要直接通过引入
// 因为直接引入就会限制在react-reconciler中，但是实际上我们对于不同的宿主环境都要实现hostConfig

import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';

// 比如react-dom的包的话他的实现就是在react-dom包下面
export interface Container {
	rootID: number;
	children: (Instance | TextInstance)[];
}
export interface Instance {
	id: number;
	type: string;
	children: (Instance | TextInstance)[];
	parent: number;
	props: Props;
}
export interface TextInstance {
	text: string;
	id: number;
	parent: number;
}

let instanceCounter = 0;

// 暂时先把props去掉
export const createInstance = (type: string, props: Props): Instance => {
	// TODO 处理props
	const instance = {
		id: instanceCounter++,
		type,
		children: [],
		parent: -1,
		props
	};
	return instance;
};

export const appendInitialChild = (parent: Instance | Container, child: Instance) => {
	const prevParentID = child.parent;
	const parentID = 'rootID' in parent ? parent.rootID : parent.id;

	if (prevParentID !== -1 && prevParentID !== parentID) {
		throw new Error('不能重复挂载child');
	}
	child.parent = parentID;
	parent.children.push(child);
};

export const createTextInstance = (content: string) => {
	const instance = {
		text: content,
		id: instanceCounter++,
		parent: -1
	};
	return instance;
};

export const appendChildToContainer = (parent: Container, child: Instance) => {
	const prevParentID = child.parent;

	if (prevParentID !== -1 && prevParentID !== parent.rootID) {
		throw new Error('不能重复挂载child');
	}
	child.parent = parent.rootID;
	parent.children.push(child);
};

export const insertChildToContainer = (child: Instance, container: Container, before: Instance) => {
	const index = container.children.indexOf(child);
	if (index !== -1) {
		container.children.splice(index, 1);
	}
	const beforeIndex = container.children.indexOf(before);
	if (beforeIndex === -1) {
		throw new Error('before不存在');
	}
	container.children.splice(beforeIndex, 0, child);
};

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memoizedProps.content;
			return commitTextUpdate(fiber.stateNode, text);
		default:
			if (__DEV__) {
				console.warn('未实现的Update类型', fiber);
			}
			break;
	}
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
	textInstance.text = content;
}

export function removeChild(child: Instance | TextInstance, container: Container) {
	const index = container.children.indexOf(child);

	if (index === -1) {
		throw new Error('child不存在');
	}
	container.children.splice(index, 1);
}

export const scheduleMicroTask =
	typeof queueMicrotask === 'function'
		? queueMicrotask
		: typeof Promise === 'function'
		? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
		: setTimeout;
