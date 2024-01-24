import { FulfilledThenable, PendingThenable, RejectedThenable, Thenable } from 'shared/ReactTypes';

export const SuspenseException = new Error(
	'这不是真实的错误， 是Suspense工作的一部分， 如果你捕获到这个错误，请将他继续抛出'
);

let suspendedThenable: Thenable<any> | null = null;

// 获取use方法对应的thenable方法也就是传入use的Promise
export function getSuspenseThenable(): Thenable<any> {
	if (suspendedThenable === null) {
		throw new Error('应该存在suspendedThenable, 这是个bug');
	}
	const thenable = suspendedThenable;
	suspendedThenable = null;
	return thenable;
}

function noop() {}

/**
 *
 * @param thenable 是一个Promise
 * @returns
 */
export function trackUsedThenable<T>(thenable: Thenable<T>) {
	switch (thenable.status) {
		case 'fulfilled':
			// 证明第一次的use的Promise有了响应结果，并且重新render了整个fiber树，等到下次走到这里的时候直接返回上一次响应的结果
			// 只要这里返回那么就不会触发下方的throw抛出的错误，那么renderRoot的整个过程就不会捕获到错误
			return thenable.value;
		case 'rejected':
			throw thenable.reason;
		default:
			// Promise初始状态不具备status这个字段
			// 进入到这里有两种可能性，1是第一次进来，2是不是第一次进来，但是第一次的Promise暂时还没有响应结果
			if (typeof thenable.status === 'string') {
				// 进入这里证明是第二种情况，这个时候我们已经监听了第一个Promise，只需要等待第一次的Promise触发响应重新刷新即可
				// 当触发响应的时候证明status的状态不再是pending那么就不会进入default，只要是正常响应状态fulfilled就会返回一个value值回去
				// 这里不需要进行任何操作
				thenable.then(noop, noop);
			} else {
				// 进入这里意味着用户是第一次进来，证明当前还是属于untracked的状态
				// 设置为pending状态
				const pending = thenable as unknown as PendingThenable<T, void, any>;
				// 往Promise上添加添加status状态属性
				pending.status = 'pending';
				// 监听Promise的响应,更高status状态并保存正常与异常响应的值
				pending.then(
					(val) => {
						if (pending.status === 'pending') {
							// @ts-ignore
							const fulfilled: FulfilledThenable<T, void, any> = pending;
							// 改为正常结束状态
							fulfilled.status = 'fulfilled';
							// val是结果赋值给fulfilled.value,实际上也就是赋值给最初传入进来的Promise(thenable).value
							fulfilled.value = val;
						}
					},
					(err) => {
						if (pending.status === 'pending') {
							// @ts-ignore
							const rejected: RejectedThenable<T, void, any> = pending;
							// 改为为异常结束状态
							rejected.status = 'rejected';
							// 保存异常信息
							rejected.reason = err;
						}
					}
				);
			}
			break;
	}
	suspendedThenable = thenable;
	// 抛出错误,函数中一旦抛出错误意味着后面的逻辑都不会执行，也就说说use()方法后面的逻辑都因为错误而中断了原有的逻辑执行了
	// 在workLoop的renderRoot方法中，具有try catch捕获异常
	throw SuspenseException;
}
