// 操作标记
export type Flags = number;

// 使用2进制来保存
export const NoFlags = 0b0000001;
export const Placement = 0b0000010;
export const Update = 0b0000100;
export const ChildDeletion = 0b0001000;

// 代表了mutation阶段需要执行的操作
export const MutationMask = Placement | Update | ChildDeletion;
