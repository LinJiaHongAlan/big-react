import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function Child() {
	return <span>big-react</span>;
}

function App() {
	const [num, setNum] = useState(100);
	return (
		<div
			onClick={() => {
				setNum(num + 1);
			}}
			type="ljh"
		>
			{num}
		</div>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
