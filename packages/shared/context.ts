import { ReactContext } from 'shared/ReactTypes';
import { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE } from 'shared/ReactSymbols';

export function createContext<T>(defaultVaule: T): ReactContext<T> {
	const context: ReactContext<T> = {
		$$typeof: REACT_CONTEXT_TYPE,
		Provider: null,
		_currentValue: defaultVaule
	};
	context.Provider = {
		$$typeof: REACT_PROVIDER_TYPE,
		_context: context
	};
	return context;
}
