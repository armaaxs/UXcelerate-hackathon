import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useStore } from './store';

if (import.meta.env.DEV) {
  // diagnostics handle for automated checks (never ships in production build)
  (window as unknown as { __toggle: (k: string) => void }).__toggle = (k) =>
    useStore.getState().toggleLayer(k as never);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
