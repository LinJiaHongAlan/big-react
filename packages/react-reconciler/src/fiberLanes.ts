// lane 可以作为update的优先级

import ReactCurrentBatchConfig from 'react/src/currentBatchConfig';
import { fiberRootNode } from './fiber';
import {
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_getCurrentPriorityLevel
} from 'scheduler';

export type Lane = number;
export type Lanes = number;

// 同步优先级
export const SyncLane = 0b00001;
export const NoLane = 0b00000;
export const NoLanes = 0b00000;
// 连续的输入
export const InputContinuousLane = 0b00010;
export const DefaultLane = 0b00100;
export const TransitionLane = 0b01000;
export const IdleLane = 0b10000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

export function requestUpdateLane() {
	// 如果此时在Transition方法中则返回Transition的优先级
	const isTransition = ReactCurrentBatchConfig.transition !== null;
	if (isTransition) {
		return TransitionLane;
	}
	// 从上下文环境中获取Scheduler优先级
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	// 拿到lane
	const lane = schedulerPriorityToLane(currentSchedulerPriority);
	return lane;
}

// 返回优先级最高的Lane
export function getHighesPriorityLane(lanes: Lanes): Lane {
	// 数字越小优先级越高
	// 返回数字越小的的哪一个
	return lanes & -lanes;
}

export function isSubsetOfLanes(set: Lanes, subset: Lane) {
	return (set & subset) === subset;
}

export function markRootFinished(root: fiberRootNode, lane: Lane) {
	// 移除
	root.pendingLanes &= ~lane;
}

// 从lane转成调度器的优先级
export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighesPriorityLane(lanes);

	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}
	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}
	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}
	return unstable_IdlePriority;
}

// 从调度器转成lane的优先级
function schedulerPriorityToLane(schedulerPriority: number) {
	if (schedulerPriority === unstable_ImmediatePriority) {
		return SyncLane;
	}
	if (schedulerPriority === unstable_UserBlockingPriority) {
		return InputContinuousLane;
	}
	if (schedulerPriority === unstable_NormalPriority) {
		return DefaultLane;
	}
	return NoLane;
}
