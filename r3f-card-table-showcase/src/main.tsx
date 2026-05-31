import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './App.css';

if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  const errors: string[] = [];
  const originalError = console.error;

  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && (args[0].includes('THREE.Clock') || args[0].includes('PCFSoftShadowMap'))) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args) => {
    errors.push(args.join(' '));
    originalError(...args);
    const errorDiv = document.getElementById('debug-errors') || document.createElement('div');
    errorDiv.id = 'debug-errors';
    errorDiv.style.cssText = 'position: fixed; top: 0; right: 0; background: rgba(255,0,0,0.8); color: white; z-index: 99999; padding: 10px; pointer-events: none; max-width: 50vw;';
    errorDiv.innerText = errors.join('\n');
    if (!document.getElementById('debug-errors')) document.body.appendChild(errorDiv);
  };

  window.addEventListener('error', (e) => console.error(e.message));
  window.addEventListener('unhandledrejection', (e) => console.error(e.reason));
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
