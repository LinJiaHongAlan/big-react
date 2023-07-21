import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(100);

	const arr =
		num % 2 === 0
			? [
					<li key="1">1</li>,
					<li key="3">3</li>,
					<li key="2">2</li>,
					<li key="4">4</li>,
					<li key="5">5</li>
			  ]
			: [
					<li key="2">2</li>,
					<li key="3">3</li>,
					<li key="1">1</li>,
					<li key="5">5</li>,
					<li key="4">4</li>
			  ];
	return (
		<ul
			onClick={() => {
				setNum(num + 1);
			}}
		>
			{arr}
		</ul>
	);
}

console.log(<App />);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
