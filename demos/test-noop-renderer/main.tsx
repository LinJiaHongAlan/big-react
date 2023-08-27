import React, { useState } from 'react';
import ReactDOM from 'react-noop-renderer';

function App() {
	const [num, setNum] = useState(0);

	return (
		<ul>
			<li>a</li>
			<li>b</li>
			<li>{num}</li>
		</ul>
	);
}

const root = ReactDOM.createRoot();
root.render(<App />);

window.root = root;
