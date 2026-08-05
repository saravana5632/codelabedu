import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress "ResizeObserver loop completed with undelivered notifications" error
const _window = window as any;
if (_window.ResizeObserver) {
  const _ResizeObserver = _window.ResizeObserver;
  _window.ResizeObserver = class ResizeObserver extends _ResizeObserver {
    constructor(callback: any) {
      super((entries: any, observer: any) => {
        window.requestAnimationFrame(() => {
          callback(entries, observer);
        });
      });
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
