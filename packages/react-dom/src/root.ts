// ReactDOM.createRoot(root).render(<APP/>)

import { createContainer, updateContainer } from 'react-reconciler/src/fiberReconciler';
import { Container } from './hostConfig';
import { ReactElementType } from 'shared/ReactTypes';

export function createRoot(container: Container) {
	// 创建容器container其实就是挂载的dom节点
	const root = createContainer(container);

	console.log(root);

	return {
		render(element: ReactElementType) {
			updateContainer(element, root);
		}
	};
}
