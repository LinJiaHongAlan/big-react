import { ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	OffscreenProps,
	createFiberFromFragment,
	createFiberFromOffscreen,
	createWorkInProgress
} from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	Fragment,
	ContextProvider,
	SuspenseComponent,
	OffscreenComponent
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { ChildDeletion, DidCapture, NoFlags, Placement, Ref } from './filberFlags';
import { pushProvider } from './fiberContext';
import { pushSuspenseHandler } from './suspenseContext';

// 递归中的递阶段
// beginWork的工作流程
// 1.计算状态的最新值
// 2.创造子fiberNode
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	// 比较，返回子fiberNode
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		case ContextProvider:
			return updateContextProvider(wip);
		case SuspenseComponent:
			return updateSuspenseComponent(wip);
		case OffscreenComponent:
			return updateOffscreenComponent(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};

function updateSuspenseComponent(wip: FiberNode) {
	const current = wip.alternate;
	const nextProps = wip.pendingProps;

	// 我们需要一个变量用来判断当前是正常流程还是挂起流程
	// showFallback这个用来表示是否需要展示Fallback
	let showFallback = false;
	// 定义一个变量表示当前是不是挂起的状态,如果为true表示挂起
	// 这个变量受DidCapture影响，而DidCapture在遇到use报错之后发起的unwind流程中会找到最近的Suspense并标记上DidCapture
	const didSuspend = (wip.flags & DidCapture) !== NoFlags;

	console.log('didSuspend', didSuspend ? '挂起' : '正常', current);

	if (didSuspend) {
		// 进入这里表示是挂起状态,wip具备DidCapture标记，在这里将这个标记清除，并且设置showFallback为true表示需要展示Suspense的fallback的内容
		showFallback = true;
		wip.flags &= ~DidCapture;
	}

	// 这里表示OffScreen跟Fallback的两个子节点，也就是真实需要展示的两个内容
	const nextPrimaryChildren = nextProps.children;
	const nextFallbackChildren = nextProps.fallback;

	// 收集当前的节点在unwind流程上有作用
	pushSuspenseHandler(wip);

	// 这里根据current跟showFallback来判断是哪个阶段，哪一种处理，分为4种
	// 挂起跟正常的处理OffscreenProps.mode是不同的，这个会在completeWork阶段处理，会判断是否发生了变化从而添加Visibility标记
	// mount
	if (current === null) {
		if (showFallback) {
			// 挂起
			console.log('首次渲染挂起');
			return mountSuspenseFallbackChildren(wip, nextPrimaryChildren, nextFallbackChildren);
		} else {
			console.log('首次渲染正常');
			// 正常
			return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	} else {
		// update
		if (showFallback) {
			// 挂起
			console.log('更新时挂起');
			return updateSuspenseFallbackChildren(wip, nextPrimaryChildren, nextFallbackChildren);
		} else {
			// 正常
			console.log('更新时正常');
			return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	}
}

function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	const current = wip.alternate as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null = currentPrimaryChildFragment.sibling;

	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};

	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);

	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = null;
	wip.child = primaryChildFragment;

	if (currentFallbackChildFragment !== null) {
		const deletions = wip.deletions;
		if (deletions === null) {
			wip.deletions = [currentFallbackChildFragment];
			wip.flags |= ChildDeletion;
		} else {
			deletions.push(currentFallbackChildFragment);
		}
	}

	return primaryChildFragment;
}

// update时候渲染挂起节点
function updateSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};
	// 拿到旧的节点
	const current = wip.alternate as FiberNode;
	// 这个child就可以拿到旧的正常节点,类型为Offscreen的FiberNode
	const currentPrimaryChildFragment = current.child as FiberNode;
	// 正常节点通过兄弟节点就可以拿到挂起节点，但是有可能挂载时就是正常导致挂起节点为null
	const currentFallbackChildFragment: FiberNode | null = currentPrimaryChildFragment.sibling;
	// 复用之前的节点传入props，生成新的正常节点类型为Offscreen的FiberNode
	const primaryChildFragment = createWorkInProgress(currentPrimaryChildFragment, primaryChildProps);
	let fallbackChildFragment;

	if (currentFallbackChildFragment !== null) {
		// 如果不为null直接复用
		fallbackChildFragment = createWorkInProgress(currentFallbackChildFragment, fallbackChildren);
	} else {
		// 如果为null需要创建一个新的节点,并打上标记
		fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
		// Placement这个是移动或新增才有存在的标记,commit阶段会拿到FiberNode的真实节点以及兄弟节点来做对应的节点操作
		fallbackChildFragment.flags |= Placement;
	}
	fallbackChildFragment.return = wip;
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};

	// 这里因为挂载时就是正常节点所以没有必要先去渲染挂起节点fallbackChildFragment
	// 只需要先渲染正常节点primaryChildFragment，类型为Offscreen的FiberNode
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	// 与父节点建立链接
	wip.child = primaryChildFragment;
	primaryChildFragment.return = wip;
	// 返回正常节点
	return primaryChildFragment;
}

// 挂载时需要挂起
function mountSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	// 这里的思路，先生成两个节点一个fallback变量内的节点用Fragment包裹租
	// 另外一个是包裹主要的业务性质的子节点
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};

	// 正常节点，类型为Offscreen的FiberNode
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	// 挂起节点，类型为Fragment的FiberNode
	const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
	// 标记为需要操作的对象
	fallbackChildFragment.flags |= Placement;

	// 两个节点都指向父级
	primaryChildFragment.return = wip;
	fallbackChildFragment.return = wip;
	// 将正常子节点的兄弟节点指向挂起的节点fallbackChildFragment
	primaryChildFragment.sibling = fallbackChildFragment;
	// 父节点的子节点指向fallbackChildFragment
	wip.child = primaryChildFragment;

	// 返回挂起的节点，这样beWork阶段下一个节点就会处理挂起的节点Fragment
	return fallbackChildFragment;
}

function updateOffscreenComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconileChildren(wip, nextChildren);
	return wip.child;
}

// 处理useContext
function updateContextProvider(wip: FiberNode) {
	// 这里的type值就是context.Provider在react的包下的context.ts中可以看到
	// { $$typeof: REACT_PROVIDER_TYPE, _context: context }
	const providerType = wip.type;
	// 通过_context可以拿到context对象,context对象通过Provider又可以拿回providerType这是一个双向结构
	// { $$typeof: REACT_CONTEXT_TYPE, Provider: null, _currentValue: defaultVaule }
	const context = providerType._context;
	// 传入进来的props
	const newProps = wip.pendingProps;
	// 拿到value属性，调用pushProvider，pushProvider会将value值保存到context._currentValue中
	// 因为这里是beginWork所以经过的时候如果是context节点的时候必定是进入这个节点的阶段，相反如果是completeWork阶段必定是跳出这个节点的阶段
	pushProvider(context, newProps.value);
	// 拿到子节点
	const nextChildren = newProps.children;
	// 拿到节点之后就会继续往下执行
	reconileChildren(wip, nextChildren);
	return wip.child;
}

function updateFragment(wip: FiberNode) {
	// 在Fragment中pendingProps就是被包裹的子节点，在childFiber.ts中updateFragment方法中调用createFiberFromFragment产生的Fragment类型的节点
	const nextChildren = wip.pendingProps;
	// 拿到节点之后就会继续往下执行
	reconileChildren(wip, nextChildren);
	return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	// renderWithHooks方法就是执行函数组件wip的方法
	// 当执行完内部的函数方法之后，就会再次调用到useState,那么就会走到update生命周期的hook,会消费上一次dispatch传入的action,最终返回函数组件内部的返回的ReactElementType
	const nextChildren = renderWithHooks(wip, renderLane);
	reconileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	// 取出的pending就是Update对象
	// Update的对象里面包含action，action的值是传进来的ReactElementType对象
	const pending = updateQueue.shared.pending;
	// 清空原有对象中的pending
	updateQueue.shared.pending = null;
	// renderLane是本地消费的优先级，会循环updateQueue中的所有Update优先级相同的Update消费并更新baseState
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	// 从目前上看这里是拿到了ReactElementType对象并且保存到memoizedState
	wip.memoizedState = memoizedState;
	// 这是更新后的ReactElementType
	const nextChildren = wip.memoizedState;
	// 比较子节点赋值回新的child
	reconileChildren(wip, nextChildren);
	// 返回子节点
	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	// 绑定ref
	markRef(wip.alternate, wip);
	reconileChildren(wip, nextChildren);
	return wip.child;
}

// 这个方法整体就是传入FiberNode以及当前子节点的ReactElementType
// 然后比较FiberNode子节点与ReactElementType生成新的子节点FiberNode并添加上操作标记
// 将FiberNode从新与当前父节点的FiberNode保存起来
function reconileChildren(wip: FiberNode, children?: ReactElementType) {
	// 目前只有HostRootFiber是有alternate的
	const current = wip.alternate;

	if (current !== null) {
		// update
		// 比较子节点的current与子节点的ReactElementType
		// wip是当前的FiberNode父节点, current.child是上一个FiberNode子节点, children是当前的ReactElementType子节点
		// 目前的方法是根据children直接生成新的FiberNode,并将return指向wip,并加上flags标记
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		// 不追踪副作用
		wip.child = mountChildFibers(wip, null, children);
	}
}

/**
 * 在beginWork中标记Ref的方法
 * @param current 上一次的FiberNode
 * @param workInProgress 当前新的工作中的FiberNode
 */
function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	// 这里实际上就是从FiberNode节点上拿到ref的属性的值，也就是我们通常在标签上绑定的那个ref属性,而ref属性就是通过useRef返回的一个带有current属性的一个对象
	const ref = workInProgress.ref;

	// current为null意味着是mount时
	if ((current === null && ref !== null) || (current !== null && current.ref !== ref)) {
		workInProgress.flags |= Ref;
	}
}
