// 对于一个dom需要在某个属性上对于的element的props

import { Container } from 'hostConfig';
import {
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_runWithPriority
} from 'scheduler';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

type EventCallback = (e: Event) => void;
interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

const validEventTypeList = ['click'];

// 初始化事件,这里的container接收的是root的容器
export function initEvent(container: Container, eventType: string) {
	if (!validEventTypeList.includes(eventType)) {
		console.warn('当前不支持', eventType, '事件');
	}
	if (__DEV__) {
		console.log('初始化事件', eventType);
	}
	container.addEventListener(eventType, (e) => {
		// 当触发事件的时候
		dispatchEvent(container, eventType, e);
	});
}

/**
 * 构造合成事件
 * @param e 实际触发时间段额event对象
 * @returns
 */
function createSyntheticEvent(e: Event) {
	// 这个作为合成事件的对象
	const syntheticEvent = e as SyntheticEvent;
	// 定义一个默认值,这个是是否阻止冒泡的标记。默认false为不阻止
	syntheticEvent.__stopPropagation = false;
	// e.stopPropagation 这个是阻止事件冒泡的方法
	const originStopPropagation = e.stopPropagation;

	// 为合成事件对象添加多一个阻止事件冒泡的方法
	syntheticEvent.stopPropagation = () => {
		// 内部调用原来的e.stopPropagation，多做的一步操作是将__stopPropagation标记为true
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			// 执行原始的主治冒泡的方法
			originStopPropagation();
		}
	};
	// 将对象返回
	return syntheticEvent;
}

/**
 * 这里是实际事件触发的地方
 * @param container 容器
 * @param eventType 事件类型
 * @param e event对象
 * @returns
 */
function dispatchEvent(container: Container, eventType: string, e: Event) {
	// 这里是触发事件的实际的target,也就是真正触发事件的目标对象
	const targetElement = e.target;
	if (targetElement === null) {
		console.warn('事件不存在target', e);
		return;
	}
	// 1.收集沿途的事件，意思就是从当前点击的节点到react的root中如果有注册过onClick事件都会被收集
	const { bubble, capture } = collectPaths(targetElement as DOMElement, container, eventType);
	// 2.构造合成事件，se就是e的事件合成对象，目前是多了一个阻止冒泡的方法
	const se = createSyntheticEvent(e);
	// 3.遍历触发captue里面的事件
	triggerEventFlow(capture, se);

	if (!se.__stopPropagation) {
		// 4.遍历bubble
		triggerEventFlow(bubble, se);
	}
}

/**
 * 时间数组的遍历方法
 * @param paths 遍历的数组
 * @param se 事件合成对象
 */
function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	for (let i = 0; i < paths.length; i++) {
		// 这里会将事件一个个循环调用
		const callback = paths[i];
		// unstable_runWithPriority会将第一个参数的优先级传入进去，这样在callback方法执行的过程中就可以通过unstable_getCurrentPriorityLevel拿到这个优先级
		unstable_runWithPriority(eventTypeToSchdulerPriority(se.type), () => {
			// 这里真正执行注册事件回调的地方，如果此时的se调用了阻止事件冒泡，那么下面的__stopPropagation就会是false
			callback.call(null, se);
		});

		// 如果有调用过注释冒泡的方法时候那么，事件数组后面就会终止调用，这样就起到了阻止事件冒泡的效果
		if (se.__stopPropagation) {
			// 阻止事件继续传播
			break;
		}
	}
}

function getEventCallbackNameFromEventType(eventType: string): string[] | undefined {
	return {
		click: ['onClickCapture', 'onClick']
	}[eventType];
}

/**
 * 收集沿途的事件方法
 * @param targetElement 实际触发事件的目标
 * @param container 根部容器
 * @param eventType 事件类型
 * @returns
 */
function collectPaths(targetElement: DOMElement, container: Container, eventType: string) {
	const paths: Paths = {
		capture: [],
		bubble: []
	};

	// 向上循环
	while (targetElement && targetElement !== container) {
		// 收集,拿到真实dom里面保存的props
		const elementProps = targetElement[elementPropsKey];
		// 如果存在
		if (elementProps) {
			// click => onClick onClickCapture
			// 根据事件类型拿到实际jsx中的事件回调函数名
			const callbackNameList = getEventCallbackNameFromEventType(eventType);
			// 如果存在
			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					// 从实际的props中拿到对应真正填写的函数对象的方法体
					const eventCallback = elementProps[callbackName];
					// 如果方法体存在，例如我在jsx中填写了 onClick={this.xxx}
					if (eventCallback) {
						// 放到对于的数组中
						if (i === 0) {
							// capture
							paths.capture.unshift(eventCallback);
						} else {
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}
		// 向上循环，知道根部容器
		targetElement = targetElement.parentNode as DOMElement;
	}
	return paths;
}

function eventTypeToSchdulerPriority(eventType: string) {
	switch (eventType) {
		case 'click':
		case 'keydown':
		case 'keyup':
			// 最高优先级
			return unstable_ImmediatePriority;
		case 'scroll':
			return unstable_UserBlockingPriority;
		default:
			return unstable_NormalPriority;
	}
}
