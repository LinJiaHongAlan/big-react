import { useState, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';

const ctxA = createContext(null);
const ctxB = createContext(undefined);

function App() {
	const res = (
		<ctxA.Provider value={'A0'}>
			<ctxB.Provider value={'B0'}>
				<ctxA.Provider value={'A1'}>
					<Cpn />
				</ctxA.Provider>
			</ctxB.Provider>
			<Cpn />
		</ctxA.Provider>
	);
	console.log(res);
	return res;
}

function Cpn() {
	const a = useContext(ctxA);
	const b = useContext(ctxB);
	return (
		<div>
			A: {a} B: {b}
		</div>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
