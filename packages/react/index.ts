import { DisPatcher, resolveDispatcher } from './src/currentDispatcher';
import currentDispatcher from './src/currentDispatcher';
import currentBatchConfig from './src/currentBatchConfig';
import { jsxDEV, jsx, isValidElement as isValidElementFn } from './src/jsx';
import { Usable } from 'shared/ReactTypes';
export { REACT_FRAGMENT_TYPE as Fragment } from 'shared/ReactSymbols';
export { REACT_SUSPENSE_TYPE as Suspense } from 'shared/ReactSymbols';
export { createContext } from './src/context';

export const useState: DisPatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

export const useEffect: DisPatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useEffect(create, deps);
};

export const useRef: DisPatcher['useRef'] = (initialValue) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useRef(initialValue);
};

export const useContext: DisPatcher['useContext'] = (context) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useContext(context);
};

export const use: DisPatcher['use'] = <T>(useable: Usable<T>) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.use(useable);
};

export const useTransition: DisPatcher['useTransition'] = () => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useTransition();
};

// 内部数据共享层
export const __SECRET_INTERNELS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '0.0.0';
export const createElement = jsx;
export const isValidElement = isValidElementFn;
