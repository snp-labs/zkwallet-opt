import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSuggestedCommandLine,
  extractJsonDocument,
  isSummaryReady,
  summarizeStatuses
} from "./zktransfer-ops-overview.mjs";

test("extractJsonDocument parses JSON after command prelude", () => {
  const status = extractJsonDocument(
    "\n> app@0.1.0 deployment:status\n> bash scripts/deployment-status.sh\n\n{\"ready\":true}"
  );
  assert.deepEqual(status, { ready: true });
});

test("buildSuggestedCommandLine returns a copy-pastable command", () => {
  assert.equal(
    buildSuggestedCommandLine("/tmp/zktransfer-server-app", "npm run setup:env"),
    'cd "/tmp/zktransfer-server-app" && npm run setup:env'
  );
  assert.equal(buildSuggestedCommandLine("/tmp/zktransfer-server-app", null), null);
});

test("summarizeStatuses collects blocking issues and suggested commands", () => {
  const summary = summarizeStatuses([
    {
      serviceName: "zktransfer-server-app",
      appDir: "/tmp/zktransfer-server-app",
      envExists: false,
      unitExists: false,
      config: { ready: false },
      health: null,
      missingDeps: ["systemctl"],
      blockingIssues: ["missing .env", "health endpoint is unavailable"],
      suggestedCommand: "npm run setup:env"
    },
    {
      serviceName: "zktransfer-custody-platform-server",
      appDir: "/tmp/zktransfer-custody-platform-server",
      envExists: true,
      unitExists: false,
      config: { ready: true },
      health: { ready: false },
      missingDeps: [],
      blockingIssues: ["health endpoint is unavailable"],
      suggestedCommand: "npm run install:systemd:dry-run"
    }
  ]);

  assert.equal(summary.overall.configReady, false);
  assert.equal(summary.overall.healthReady, false);
  assert.equal(summary.overall.blockingIssueCount, 2);
  assert.deepEqual(summary.overall.suggestedCommands, [
    "npm run setup:env",
    "npm run install:systemd:dry-run"
  ]);
  assert.equal(summary.overall.primarySuggestedCommand, "npm run setup:env");
  assert.deepEqual(summary.blockingIssues, [
    "missing .env",
    "health endpoint is unavailable"
  ]);
  assert.deepEqual(summary.services, [
    {
      serviceName: "zktransfer-server-app",
      appDir: "/tmp/zktransfer-server-app",
      envExists: false,
      unitExists: false,
      configReady: false,
      healthReady: false,
      missingDeps: ["systemctl"],
      blockingIssues: ["missing .env", "health endpoint is unavailable"],
      suggestedCommand: "npm run setup:env",
      suggestedCommandLine: 'cd "/tmp/zktransfer-server-app" && npm run setup:env'
    },
    {
      serviceName: "zktransfer-custody-platform-server",
      appDir: "/tmp/zktransfer-custody-platform-server",
      envExists: true,
      unitExists: false,
      configReady: true,
      healthReady: false,
      missingDeps: [],
      blockingIssues: ["health endpoint is unavailable"],
      suggestedCommand: "npm run install:systemd:dry-run",
      suggestedCommandLine: 'cd "/tmp/zktransfer-custody-platform-server" && npm run install:systemd:dry-run'
    }
  ]);
});

test("isSummaryReady returns true only when config and health are both ready", () => {
  assert.equal(
    isSummaryReady({
      overall: {
        configReady: true,
        healthReady: true
      }
    }),
    true
  );
  assert.equal(
    isSummaryReady({
      overall: {
        configReady: true,
        healthReady: false
      }
    }),
    false
  );
});
