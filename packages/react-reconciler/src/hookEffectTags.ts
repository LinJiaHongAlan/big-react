// 对于effect hook, Passive代表[useEffect对应的effect]
// Passive代表useEffect
export const Passive = 0b0001;
// 如果不仅包含Passive还包含了HookHasEffect,代表了不仅是useEffect，而且本次更新还存在了副作用
export const HookHasEffect = 0b0001;
