import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';

// Dynamic + fire-and-forget: ad blockers commonly filter any request literally named
// analytics.js (a classic EasyPrivacy-style rule, independent of domain), and a static
// top-level import that gets blocked throws before this module's render() call below ever
// runs -- the whole app fails to mount, blank page, no error boundary. Neither of these is
// load-bearing for rendering, so a blocked/failed load must never affect the app itself.
import('./lib/analytics').then(m => m.initAnalytics()).catch(() => {});
import('./lib/sentry').then(m => m.initErrorMonitoring()).catch(() => {});

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
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
