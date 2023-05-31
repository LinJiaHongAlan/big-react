// 描述宿主环境方法的文件
// 这里在tsconfig.json上配置一个paths,不需要直接通过引入
// 因为直接引入就会限制在react-reconciler中，但是实际上我们对于不同的宿主环境都要实现hostConfig
// 比如react-dom的包的话他的实现就是在react-dom包下面
export type Container = Element;
export type Instance = Element;

// 暂时先把props去掉
export const createInstance = (type: string, props: any): Instance => {
	// TODO 处理props
	const element = document.createElement(type);
	return element;
};

export const appendInitialChild = (parent: Instance | Container, child: Instance) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;
