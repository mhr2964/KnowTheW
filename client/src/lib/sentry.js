// Sentry error monitoring. No-ops if VITE_SENTRY_DSN isn't set, so local dev/test never reports.
import * as Sentry from '@sentry/react';

export function initErrorMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn });
}
