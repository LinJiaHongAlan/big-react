import { FiberNode } from './fiber';
import { popProvider } from './fiberContext';
import { DidCapture, NoFlags, ShouldCapture } from './filberFlags';
import { popSuspenseHandler } from './suspenseContext';
import { ContextProvider, SuspenseComponent } from './workTags';

export function unwindWork(wip: FiberNode) {
	const flags = wip.flags;

	switch (wip.tag) {
		case SuspenseComponent:
			popSuspenseHandler();
			if ((flags & ShouldCapture) !== NoFlags && (flags & DidCapture) === NoFlags) {
				// 从flags中移除掉ShouldCapture，再加上DidCapture
				wip.flags = (flags & ~ShouldCapture) | DidCapture;
				return wip;
			}
			break;
		case ContextProvider:
			const context = wip.type._context;
			popProvider(context);
			return null;
		default:
			return null;
	}
	return null;
}
