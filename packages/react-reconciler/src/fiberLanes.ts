// lane 可以作为update的优先级

import { fiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

// 同步优先级
export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

export function requestUpdateLane() {
	return SyncLane;
}

// 返回优先级最高的Lane
export function getHighesPriorityLane(lanes: Lanes): Lane {
	// 数字越小优先级越高
	// 返回数字越小的的哪一个
	return lanes & -lanes;
}

export function markRootFinished(root: fiberRootNode, lane: Lane) {
	// 移除
	root.pendingLanes &= ~lane;
}
