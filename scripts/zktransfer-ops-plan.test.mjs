import test from "node:test";
import assert from "node:assert/strict";
import { buildOpsPlan, renderOpsPlan } from "./zktransfer-ops-plan.mjs";

test("buildOpsPlan returns ready when the summary is fully green", () => {
  const plan = buildOpsPlan({
    generatedAt: "2026-03-23T12:00:00.000Z",
    overall: {
      configReady: true,
      healthReady: true,
      blockingIssueCount: 0
    },
    services: []
  });

  assert.deepEqual(plan, [
    {
      command: "ready",
      reason: "All tracked zkTransfer services report config and health readiness."
    }
  ]);
});

test("buildOpsPlan creates an ordered root-level recovery sequence", () => {
  const plan = buildOpsPlan({
    generatedAt: "2026-03-23T12:00:00.000Z",
    overall: {
      configReady: false,
      healthReady: false,
      blockingIssueCount: 6
    },
    services: [
      {
        serviceName: "zktransfer-server-app",
        configReady: false,
        healthReady: false,
        missingDeps: ["systemctl"],
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/server" && npm run setup:env',
        blockingIssues: ["missing .env"]
      },
      {
        serviceName: "zktransfer-custody-platform-server",
        configReady: false,
        healthReady: false,
        missingDeps: ["systemctl"],
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/platform" && npm run setup:env',
        blockingIssues: ["missing .env"]
      }
    ]
  });

  assert.deepEqual(
    plan.map((step) => step.command),
    [
      'bash "/Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh" setup-env',
      'bash "/Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh" check-ready',
      'bash "/Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh" install:dry-run',
      'bash "/Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh" doctor'
    ]
  );
});

test("renderOpsPlan prints numbered steps", () => {
  const output = renderOpsPlan({
    generatedAt: "2026-03-23T12:00:00.000Z",
    overall: {
      configReady: false,
      healthReady: false,
      blockingIssueCount: 3
    },
    services: [
      {
        serviceName: "zktransfer-server-app",
        configReady: false,
        healthReady: false,
        missingDeps: [],
        suggestedCommand: "npm run check:ready",
        suggestedCommandLine: 'cd "/tmp/server" && npm run check:ready',
        blockingIssues: ["JWT secret is not configured"]
      }
    ]
  });

  assert.match(output, /zkTransfer Ops Plan/);
  assert.match(output, /1\. bash .*zktransfer-ops\.sh" check-ready/);
  assert.match(output, /2\. bash .*zktransfer-ops\.sh" doctor/);
});
