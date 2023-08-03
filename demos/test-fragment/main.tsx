import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

// console.log(
// 	<>
// 		<div>1</div>
// 		<div>2</div>
// 	</>
// );

const node = <li>node1</li>;
const arr = [<li>c</li>, <li>d</li>];

// function App() {
// 	return (
// 		<ul>
// 			<>
// 				<li>1</li>
// 				<li>2</li>
// 			</>
// 		</ul>
// 	);
// }

// function App() {
// 	return (
// 		<>
// 			<div>1</div>
// 			<div>2</div>
// 		</>
// 	);
// }

function App() {
	const [num, setNum] = useState(0);

	return (
		<ul
			onClick={() => {
				setNum(num + 1);
			}}
		>
			<li>a</li>
			<li>b</li>
			{num % 2 === 0 ? node : arr}
		</ul>
	);
}

console.log(<App />);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
