// 抛出错误的时候在这个文件中处理

import { Wakeable } from 'shared/ReactTypes';
import { fiberRootNode } from './fiber';
import { Lane } from './fiberLanes';
import { ensureRootIsScheduled, markRootUpdateed } from './workLoop';

export function throwException(root: fiberRootNode, value: any, lane: Lane) {
	// Error Boundray

	// thenable
	if (value !== null && typeof value === 'object' && typeof value.then === 'function') {
		// thenable跟wakeable的区别
		// 其实他们都是用户传进来的Promise，但传入进来的时候我们就将Promise包装成thenable
		// 但如果最终的目的是为了在resover的时候ping一个数据的话我们就认为他是一个wakeable
		// wakeable就是唤醒的意思，此时就是要唤醒一次新的更新
		// 所以wakeable跟thenable都是包装好的Promise，只是应用在不同的场景
		const wakeable: Wakeable<any> = value;
		attachPingListener(root, wakeable, lane);
	}
}

function attachPingListener(root: fiberRootNode, wakeable: Wakeable<any>, lane: Lane) {
	// 获取ping缓存
	let pingCache = root.pingCache;
	// 线程id
	let threadIDs: Set<Lane> | undefined;

	if (pingCache === null) {
		threadIDs = new Set<Lane>();
		pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
		pingCache.set(wakeable, threadIDs);
	} else {
		threadIDs = pingCache.get(wakeable);
		if (threadIDs === undefined) {
			// 没有换成
			threadIDs = new Set<Lane>();
			pingCache.set(wakeable, threadIDs);
		}
	}

	if (!threadIDs.has(lane)) {
		// 第一次进入
		threadIDs.add(lane);
		// eslint-disable-next-line no-inner-declarations
		function ping() {
			if (pingCache !== null) {
				// 将缓存移除
				pingCache.delete(wakeable);
			}
			// 添加优先级（相同优先级更新不会引起变化）
			markRootUpdateed(root, lane);
			// 调用renderRoot开始跟新
			ensureRootIsScheduled(root);
		}
		wakeable.then(ping, ping);
	}
}
