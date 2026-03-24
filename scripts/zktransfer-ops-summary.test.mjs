import test from "node:test";
import assert from "node:assert/strict";
import { renderOpsSummary, renderOpsSummaryByFormat, renderOpsSummaryMarkdown } from "./zktransfer-ops-summary.mjs";

test("renderOpsSummary formats overall and service status lines", () => {
  const output = renderOpsSummary({
    generatedAt: "2026-03-23T08:41:39.057Z",
    overall: {
      configReady: false,
      healthReady: false,
      blockingIssueCount: 3,
      suggestedCommands: ["npm run setup:env"],
      primarySuggestedCommand: "npm run setup:env"
    },
    blockingIssues: [
      "missing .env",
      "JWT secret is not configured",
      "health endpoint is unavailable"
    ],
    services: [
      {
        serviceName: "zktransfer-server-app",
        appDir: "/tmp/zktransfer-server-app",
        envExists: false,
        unitExists: false,
        configReady: false,
        healthReady: false,
        missingDeps: ["systemctl"],
        blockingIssues: ["missing .env"],
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/zktransfer-server-app" && npm run setup:env'
      },
      {
        serviceName: "zktransfer-custody-platform-server",
        appDir: "/tmp/zktransfer-custody-platform/apps/server",
        envExists: true,
        unitExists: false,
        configReady: true,
        healthReady: false,
        missingDeps: [],
        blockingIssues: ["health endpoint is unavailable"],
        suggestedCommand: "npm run install:systemd:dry-run",
        suggestedCommandLine: 'cd "/tmp/zktransfer-custody-platform/apps/server" && npm run install:systemd:dry-run'
      }
    ]
  });

  assert.match(output, /zkTransfer Ops Summary/);
  assert.match(output, /Next command: npm run setup:env/);
  assert.match(output, /- missing \.env/);
  assert.match(output, /- zktransfer-server-app: blocked \| env=false unit=false \| next=npm run setup:env/);
  assert.match(output, /run: cd "\/tmp\/zktransfer-server-app" && npm run setup:env/);
  assert.match(output, /issue: missing \.env/);
  assert.match(
    output,
    /- zktransfer-custody-platform-server: blocked \| env=true unit=false \| next=npm run install:systemd:dry-run/
  );
});

test("renderOpsSummaryMarkdown formats markdown headings and bullets", () => {
  const output = renderOpsSummaryMarkdown({
    generatedAt: "2026-03-23T08:41:39.057Z",
    overall: {
      configReady: true,
      healthReady: false,
      blockingIssueCount: 1,
      suggestedCommands: ["npm run install:systemd:dry-run"],
      primarySuggestedCommand: "npm run install:systemd:dry-run"
    },
    blockingIssues: ["health endpoint is unavailable"],
    services: [
      {
        serviceName: "zktransfer-server-app",
        appDir: "/tmp/zktransfer-server-app",
        envExists: true,
        unitExists: false,
        configReady: true,
        healthReady: false,
        missingDeps: [],
        blockingIssues: ["health endpoint is unavailable"],
        suggestedCommand: "npm run install:systemd:dry-run",
        suggestedCommandLine: 'cd "/tmp/zktransfer-server-app" && npm run install:systemd:dry-run'
      }
    ]
  });

  assert.match(output, /^# zkTransfer Ops Summary/m);
  assert.match(output, /## Blocking Issues/);
  assert.match(output, /- Next command: `npm run install:systemd:dry-run`/);
  assert.match(output, /\*\*zktransfer-server-app\*\*: blocked/);
  assert.match(output, /- run: `cd "\/tmp\/zktransfer-server-app" && npm run install:systemd:dry-run`/);
  assert.match(output, /- issue: health endpoint is unavailable/);
});

test("renderOpsSummaryByFormat returns json output when requested", () => {
  const output = renderOpsSummaryByFormat(
    {
      generatedAt: "2026-03-23T08:41:39.057Z",
      overall: {
        configReady: false,
        healthReady: false,
        blockingIssueCount: 0,
        suggestedCommands: [],
        primarySuggestedCommand: null
      },
      blockingIssues: [],
      services: []
    },
    "json"
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.generatedAt, "2026-03-23T08:41:39.057Z");
  assert.deepEqual(parsed.services, []);
});

test("renderOpsSummaryByFormat falls back to text for unknown formats", () => {
  const output = renderOpsSummaryByFormat(
    {
      generatedAt: "2026-03-23T08:41:39.057Z",
      overall: {
        configReady: true,
        healthReady: true,
        blockingIssueCount: 0,
        suggestedCommands: [],
        primarySuggestedCommand: null
      },
      blockingIssues: [],
      services: []
    },
    "unknown"
  );

  assert.match(output, /zkTransfer Ops Summary/);
  assert.match(output, /Blocking issues: none/);
});
