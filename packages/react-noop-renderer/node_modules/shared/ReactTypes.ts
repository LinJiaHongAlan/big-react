export type Type = any;
export type Key = any;
export type Ref = { current: any } | ((instance: any) => void);
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
	// 这一个组件跟Elementd的类型是一样的，都属于节点类型
	$$typeof: symbol | number;
	// 这里是区分组件跟Element类型的地方,跟vue的h函数的第一个参数概念是一样的
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
	__mark: string;
}

// 表示Action是一个State对象或者是一个接收State对象的函数并且返回一个对象
export type Action<State> = State | ((prevState: State) => State);

export type ReactContext<T> = {
	$$typeof: symbol | number;
	Provider: ReactProviderType<T> | null;
	_currentValue: T;
};

export type ReactProviderType<T> = {
	$$typeof: symbol | number;
	_context: ReactContext<T>;
};
