import { DisPatcher, resolveDispatcher } from './src/currentDispatcher';
import currentDispatcher from './src/currentDispatcher';
import { jsxDEV } from './src/jsx';

export const useState: DisPatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();
	dispatcher.useState(initialState);
};

// 内部数据共享层
export const __SECRET_INTERNELS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

export default {
	version: '0.0.0',
	createElement: jsxDEV
};
