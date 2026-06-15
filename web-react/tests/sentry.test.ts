import assert from "node:assert/strict";
import test from "node:test";

test("sentry.ts exports ErrorBoundary", async () => {
  const sentry = await import("../src/sentry.ts");
  assert.ok(sentry.ErrorBoundary, "ErrorBoundary should be exported");
  assert.equal(typeof sentry.ErrorBoundary, "function");
});
