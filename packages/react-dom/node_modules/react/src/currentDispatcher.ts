import { Action } from 'shared/ReactTypes';

// 当前使用的hooks的集合
export interface DisPatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
	useEffect: <T>(callback: (() => void) | void, deps: any[] | void) => void;
	useTransition: () => [boolean, (callback: () => void) => void];
	useRef: <T>(initialValue: T) => { current: T };
}

export type Dispatch<State> = (action: Action<State>) => void;

const currentDispatcher: { current: DisPatcher | null } = {
	current: null
};

// 获取dispatcher的方法
export const resolveDispatcher = () => {
	const dispatcher = currentDispatcher.current;
	if (dispatcher === null) {
		throw new Error('hook只能在函数组件中执行');
	}
	return dispatcher;
};

export default currentDispatcher;
