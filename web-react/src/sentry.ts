import * as Sentry from "@sentry/react";

const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const isTest = env?.MODE === "test" || env?.VITEST !== undefined;

let dsn: string | undefined;
if (!isTest && env) {
  dsn = env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn("[Sentry] VITE_SENTRY_DSN not set — error tracking disabled");
  }
}

Sentry.init({
  dsn: dsn ?? "",
  enabled: !!dsn && !isTest,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});

export const ErrorBoundary = Sentry.ErrorBoundary;
