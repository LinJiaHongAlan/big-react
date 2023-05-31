export type Type = any;
export type Key = any;
export type Ref = any;
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
	$$typeof: symbol | number;
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
	__mark: string;
}

// 表示Action是一个State对象或者是一个接收State对象的函数并且返回一个对象
export type Action<State> = State | ((prevState: State) => State);
