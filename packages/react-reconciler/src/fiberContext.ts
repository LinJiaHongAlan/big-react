import { ReactContext } from 'shared/ReactTypes';

// 这两个方法主要考虑到多层嵌套的时候如果跳出当前的context节点则context的值取更外层的value

// 定义一个保存上一次的值的变量
let prevContextValue: any = null;
// 考虑到context有多层嵌套的问题我们需要一个数组来保存
const prevContextValueStack: any[] = [];

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
	// 将上一次的值先添加到数组
	prevContextValueStack.push(prevContextValue);
	// 将现在的值保存起来待后续继续添加
	prevContextValue = context._currentValue;
	// 赋值到当前的context对象中
	context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
	// 将上一个context的值赋值回来
	context._currentValue = prevContextValue;
	// 从数组中取出上上个值保存起来
	prevContextValue = prevContextValueStack.pop();
}
