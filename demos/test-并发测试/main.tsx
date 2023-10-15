import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function Child({ children }) {
	// 做一个耗时的操作
	const now = performance.now();
	while (performance.now() - now < 4) {}
	return <li>{children}</li>;
}

function App() {
	const [num, setNum] = useState(100);
	return (
		<ul onClick={() => setNum(50)}>
			{new Array(num).fill(0).map((_, i) => {
				return <Child key={i}>{i}</Child>;
			})}
		</ul>
	);
}

console.log(<App />);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
