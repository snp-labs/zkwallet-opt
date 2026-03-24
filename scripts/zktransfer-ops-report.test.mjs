import test from "node:test";
import assert from "node:assert/strict";
import { renderOpsReport } from "./zktransfer-ops-report.mjs";

test("renderOpsReport includes next command, plan, and detailed summary", () => {
  const output = renderOpsReport({
    generatedAt: "2026-03-23T12:10:00.000Z",
    overall: {
      configReady: false,
      healthReady: false,
      blockingIssueCount: 2,
      suggestedCommands: ["npm run setup:env"],
      primarySuggestedCommand: "npm run setup:env"
    },
    blockingIssues: ["missing .env", "health endpoint is unavailable"],
    services: [
      {
        serviceName: "zktransfer-server-app",
        appDir: "/tmp/server",
        envExists: false,
        unitExists: false,
        configReady: false,
        healthReady: false,
        missingDeps: ["systemctl"],
        blockingIssues: ["missing .env"],
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/server" && npm run setup:env'
      },
      {
        serviceName: "zktransfer-custody-platform-server",
        appDir: "/tmp/platform",
        envExists: false,
        unitExists: false,
        configReady: false,
        healthReady: false,
        missingDeps: ["systemctl"],
        blockingIssues: ["missing .env"],
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/platform" && npm run setup:env'
      }
    ]
  });

  assert.match(output, /^# zkTransfer Ops Report/m);
  assert.match(output, /## Immediate Next Command/);
  assert.match(output, /bash ".*zktransfer-ops\.sh" setup-env/);
  assert.match(output, /## Recommended Plan/);
  assert.match(output, /1\. `bash ".*zktransfer-ops\.sh" setup-env`/);
  assert.match(output, /## Detailed Summary/);
  assert.match(output, /# zkTransfer Ops Summary/);
});

test("renderOpsReport prints ready when there is nothing left to do", () => {
  const output = renderOpsReport({
    generatedAt: "2026-03-23T12:10:00.000Z",
    overall: {
      configReady: true,
      healthReady: true,
      blockingIssueCount: 0,
      suggestedCommands: [],
      primarySuggestedCommand: null
    },
    blockingIssues: [],
    services: []
  });

  assert.match(output, /```bash\nready\n```/);
  assert.match(output, /1\. `ready`/);
});
