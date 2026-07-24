import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { initErrorMonitoring } from './lib/sentry';

initAnalytics();
initErrorMonitoring();

const errorFallback = (
  <div style={{ textAlign: 'center', padding: '3rem 0' }}>
    <p className="status-msg">Something went wrong.</p>
    <a className="back-btn" href="/">← Go home</a>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={errorFallback}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
