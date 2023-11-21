import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
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

// jsx方法是通过内部的babel转换来的，babel的type的转换规则为开头是小写明确没有.则为普通element，则type为字符串，如果开头是大写则视为组件那么type是一个变量
// 例如<Abc> 会编译为 jsx(Abc(变量), { children: [] })   如果是<abc> = jsx('abc', { children: [] }) 如果存在点也会编译为变量
// 例如<abc.n>=jax(abc.n, { children: [] }) context.Provider 实际上就是编译成 jsx(context.Provider, {})
export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {
	// 特殊处理key: Key = null;
	let key: Key = null;
	const props: Props = {};
	// @ts-ignore
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

export const Fragment = REACT_FRAGMENT_TYPE;

export const jsxDEV = (type: ElementType, config: any, maybeKey: Key) => {
	const props: Props = {};
	// @ts-ignore
	let ref: Ref = null;

	// key的默认值是null
	let key = null;
	if (maybeKey !== undefined) {
		// 格式化为字符串
		key = '' + maybeKey;
	}

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
