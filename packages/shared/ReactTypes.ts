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

// hook->use接收的类型，一共有两种类型
// Thenable是包装过的Promise
export type Usable<T> = Thenable<T> | ReactContext<T>;

export interface Wakeable<Result> {
	then(onFulfilled: () => Result, onRejected: () => Result): void | Wakeable<Result>;
}

// 这里其实描述的就是一个Promise包装后的对象，ThenableImpl是一个积累，后面有4中状态继承这个基类
// untracked还没有最终到的状态
// pending
// fulfilled -> reslve
// rejected -> reject
export interface ThenableImpl<T, Result, Err> {
	then(
		onFulfilled: (value: T) => Result,
		onRejected: (error: Err) => Result
	): void | Wakeable<Result>;
}

export interface UntrackedThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
	status?: void;
}

export interface PendingThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
	status: 'pending';
}

export interface FulfilledThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
	status: 'fulfilled';
	value: T;
}

export interface RejectedThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
	status: 'rejected';
	reason: Err;
}

export type Thenable<T, Result = void, Err = any> =
	| UntrackedThenable<T, Result, Err>
	| PendingThenable<T, Result, Err>
	| FulfilledThenable<T, Result, Err>
	| RejectedThenable<T, Result, Err>;
