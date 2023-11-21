import { FulfilledThenable, PendingThenable, RejectedThenable, Thenable } from 'shared/ReactTypes';

export const SuspenseException = new Error(
	'这不是真实的错误， 是Suspense工作的一部分， 如果你捕获到这个错误，请将他继续抛出'
);

let suspendedThenable: Thenable<any> | null = null;

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
			return thenable.value;
		case 'rejected':
			throw thenable.reason;
		default:
			// Promise初始状态不具备status这个字段
			if (typeof thenable.status === 'string') {
				// 第一次用户传入一个普通得到Promise的时候是不具有status的
				// 此时意味着已经包装过了，所以可以什么都不干
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
	throw SuspenseException;
}
