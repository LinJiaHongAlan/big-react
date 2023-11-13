export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText
	| typeof Fragment
	| typeof ContextProvider
	| typeof SuspenseComponent
	| typeof OffscreenComponent;

export const FunctionComponent = 0;
// 项目挂载的根节点
// 011
export const HostRoot = 3;
// <div>
// 0101
export const HostComponent = 5;
// 文本节点
// 0110
export const HostText = 6;
export const Fragment = 7;
export const ContextProvider = 8;
export const SuspenseComponent = 13;
export const OffscreenComponent = 14;
