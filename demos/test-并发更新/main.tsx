import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_LowPriority as LowPriority,
	unstable_IdlePriority as IdlePriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield,
	CallbackNode,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback
} from 'scheduler';

import './style.css';
const button = document.querySelector('button');
const root = document.querySelector('#root');

type Priority =
	| typeof IdlePriority
	| typeof LowPriority
	| typeof NormalPriority
	| typeof UserBlockingPriority
	| typeof ImmediatePriority;

[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach((priority) => {
	const btn = document.createElement('button');
	root?.appendChild(btn);
	btn.innerText = [
		'',
		'ImmediatePriority',
		'UserBlockingPriority',
		'NormalPriority',
		'LowPriority'
	][priority];
	btn.onclick = () => {
		workList.unshift({
			count: 100,
			priority: priority as Priority
		});
		schedule();
	};
});

interface Work {
	count: number;
	priority: Priority;
}

const workList: Work[] = [];
// 上一次的优先级，默认为IdlePriority
let prevPriority: Priority = IdlePriority;
// 保存当前的回调函数
let curCallback: CallbackNode | null = null;

function schedule() {
	// 获取当前正在调度的回调
	const cbNode = getFirstCallbackNode();
	// 找到优先级最高的额那个，数字越小优先级越高
	// 这里排序之后欧取取第一个，就是拿出优先级最高的那个
	const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];

	// 获取优先级
	const { priority: curPriority } = curWork;
	// 策略逻辑
	if (!curWork) {
		curCallback = null;
		// cancelCallback是取消回调
		cbNode && cancelCallback(cbNode);
		return;
	}

	if (curPriority === prevPriority) {
		return;
	}
	// 因为curPriority拿到的一定是curWork中最高的优先级，如果逻辑能走到这里证明curPriority > prevPriority
	// 取消之前的优先级回调
	cbNode && cancelCallback(cbNode);

	// 使用调度器在宏任务中调度perform
	curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

function perform(work: Work, didTimeout?: boolean) {
	/**
	 * 在这里我们要让whie循环可中断
	 * 1. 如果work就是同步优先级那么就不可中断 ImmediatePriority
	 * 2. 饥饿问题 didTimeout标记当前任务有没有过期，如果过期他就是同步的
	 * 3. 时间切片
	 */
	// 是否需要同步执行的变量
	const needSync = work.priority === ImmediatePriority || didTimeout;
	// shouldYield() === false 表示时间切片的时间没有用尽
	while ((needSync || !shouldYield()) && work.count) {
		work.count--;
		insertSpan(work.priority.toString());
	}

	// (执行完了 || 中断执行了)，就从workList中移除
	// 保存为上一次的优先级
	prevPriority = work.priority;
	if (!work.count) {
		const workIndex = workList.indexOf(work);
		workList.splice(workIndex, 1);
		// 如果当前的work执行完了,则还原为默认的IdlePriority
		prevPriority = IdlePriority;
	}

	const prevCallback = curCallback;
	schedule();
	const newCallback = curCallback;
	if (newCallback && prevCallback === newCallback) {
		return perform.bind(null, work);
	}
}

function insertSpan(content) {
	const span = document.createElement('span');
	span.innerHTML = content;
	span.className = `pri-${content}`;
	// 执行一个耗时的操作
	doSomeBuzyWork(10000000);
	root?.appendChild(span);
}

// 为了区分他们我们人为的降下速度
function doSomeBuzyWork(len: number) {
	let result = 0;
	while (len--) {
		result += len;
	}
}
