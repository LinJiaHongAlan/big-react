import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { Type, Key, Ref, Props, ReactElementType, ElementType } from 'shared/ReactTypes';

// ReactElement

const ReactElement = function (type: Type, key: Key, ref: Ref, props: Props): ReactElementType {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props,
		__mark: 'linjiahong'
	};

	return element;
};

// 是否是一个合法的Element
export function isValidElement(object: any) {
	return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
}

export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {
	// 特殊处理key: Key = null;
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	// 处理config
	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		// 如果是config上的属性
		if ({}.hasOwnProperty.call(config, prop)) {
			// 则添加
			props[prop] = val;
		}
	}

	const maybeChildrenLength = maybeChildren.length;
	if (maybeChildrenLength) {
		// 如果数组长度为0，直接拿第一个
		if (maybeChildrenLength === 1) {
			props.children = maybeChildren[0];
		} else {
			props.children = maybeChildren;
		}
	}
	return ReactElement(type, key, ref, props);
};

export const jsxDEV = (type: ElementType, config: any, key: Key) => {
	// 特殊处理key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	// 处理config
	for (const prop in config) {
		const val = config[prop];
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		// 如果是config上的属性
		if ({}.hasOwnProperty.call(config, prop)) {
			// 则添加
			props[prop] = val;
		}
	}

	return ReactElement(type, key, ref, props);
};
