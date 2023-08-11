import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(0);

	function updateNum() {
		setNum(2);
		setNum(5);
		setNum(6);
		setNum(7);
		setNum(8);
	}

	return (
		<ul onClick={updateNum}>
			<li>a</li>
			<li>b</li>
			<li>{num}</li>
		</ul>
	);
}

console.log(<App />);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
