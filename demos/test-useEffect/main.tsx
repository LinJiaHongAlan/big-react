import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// function App() {
// 	const [num, updateNum] = useState(0);
// 	useEffect(() => {
// 		console.log('App mount');
// 		updateNum(num + 1);
// 	}, []);

// 	useEffect(() => {
// 		console.log('num change create', num);
// 		return () => {
// 			console.log('num change destroy', num);
// 		};
// 	}, [num]);

// 	return <div onClick={() => updateNum(num + 1)}>{num === 0 ? <Child /> : 'noop'}</div>;
// }

function App() {
	const [num, setNum] = useState(0);
	console.log('jntm');
	useEffect(() => {
		setNum(1);
	});
	return <div>{num}</div>;
}

function Child() {
	useEffect(() => {
		console.log('Child mount');
		return () => console.log('Child unmount');
	}, []);

	return 'i am child';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
