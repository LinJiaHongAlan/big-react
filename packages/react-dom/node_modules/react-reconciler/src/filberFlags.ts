// 操作标记
export type Flags = number;

// 使用2进制来保存
export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

// 代表当前fiber上本次更新存在需要触发UseEffect的情况
// 对于fiber, 新增PassiveEffect,代表[当前fiber本次更新存在副作用]
// 至于本次更新存在哪一种副作用需要通过hookEffectTags下的tag来决定
export const PassiveEffect = 0b000100000;
export const Ref = 0b0001000000;
export const Visibility = 0b0010000000;

// 代表了mutation阶段需要执行的操作
export const MutationMask = Placement | Update | ChildDeletion | Ref | Visibility;
export const LayoutMask = Ref;

// 代表了本次更新要出发useEffect
export const PassiveMask = PassiveEffect | ChildDeletion;
