import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNextStepGroups,
  mapSuggestedCommandToRootCommand,
  renderNextSteps,
  renderRootCommandOnly
} from "./zktransfer-ops-next.mjs";

test("mapSuggestedCommandToRootCommand maps supported commands", () => {
  assert.equal(mapSuggestedCommandToRootCommand("npm run setup:env"), "setup-env");
  assert.equal(mapSuggestedCommandToRootCommand("npm run install:systemd:dry-run"), "install:dry-run");
  assert.equal(mapSuggestedCommandToRootCommand("npm run unknown"), null);
});

test("buildNextStepGroups groups services by suggested command", () => {
  const groups = buildNextStepGroups({
    services: [
      {
        serviceName: "zktransfer-server-app",
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/server" && npm run setup:env',
        blockingIssues: ["missing .env"]
      },
      {
        serviceName: "zktransfer-custody-platform-server",
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/platform" && npm run setup:env',
        blockingIssues: ["missing .env"]
      }
    ]
  });

  assert.deepEqual(groups, [
    {
      suggestedCommand: "npm run setup:env",
      rootCommand: "setup-env",
      services: [
        {
          serviceName: "zktransfer-server-app",
          suggestedCommandLine: 'cd "/tmp/server" && npm run setup:env',
          blockingIssues: ["missing .env"]
        },
        {
          serviceName: "zktransfer-custody-platform-server",
          suggestedCommandLine: 'cd "/tmp/platform" && npm run setup:env',
          blockingIssues: ["missing .env"]
        }
      ]
    }
  ]);
});

test("renderNextSteps prints shared root command and service-level commands", () => {
  const output = renderNextSteps({
    generatedAt: "2026-03-23T09:00:00.000Z",
    overall: {
      configReady: false,
      healthReady: false,
      blockingIssueCount: 2
    },
    services: [
      {
        serviceName: "zktransfer-server-app",
        configReady: false,
        healthReady: false,
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/server" && npm run setup:env',
        blockingIssues: ["missing .env"]
      },
      {
        serviceName: "zktransfer-custody-platform-server",
        configReady: false,
        healthReady: false,
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/platform" && npm run setup:env',
        blockingIssues: ["missing .env"]
      }
    ]
  });

  assert.match(output, /zkTransfer Ops Next Steps/);
  assert.match(output, /Status: blocked \(2 blocking issues\)/);
  assert.match(output, /Shared: bash .*zktransfer-ops\.sh" setup-env/);
  assert.match(output, /service: zktransfer-server-app/);
  assert.match(output, /run: cd "\/tmp\/server" && npm run setup:env/);
});

test("renderNextSteps reports ready when there is nothing left to do", () => {
  const output = renderNextSteps({
    generatedAt: "2026-03-23T09:00:00.000Z",
    overall: {
      configReady: true,
      healthReady: true,
      blockingIssueCount: 0
    },
    services: []
  });

  assert.match(output, /Status: ready/);
});

test("renderRootCommandOnly prefers a shared root wrapper command", () => {
  const output = renderRootCommandOnly({
    generatedAt: "2026-03-23T09:00:00.000Z",
    overall: {
      configReady: false,
      healthReady: false,
      blockingIssueCount: 2
    },
    services: [
      {
        serviceName: "zktransfer-server-app",
        configReady: false,
        healthReady: false,
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/server" && npm run setup:env',
        blockingIssues: ["missing .env"]
      },
      {
        serviceName: "zktransfer-custody-platform-server",
        configReady: false,
        healthReady: false,
        suggestedCommand: "npm run setup:env",
        suggestedCommandLine: 'cd "/tmp/platform" && npm run setup:env',
        blockingIssues: ["missing .env"]
      }
    ]
  });

  assert.match(output, /^bash .*zktransfer-ops\.sh" setup-env$/m);
});

test("renderRootCommandOnly reports ready when the summary is green", () => {
  assert.equal(
    renderRootCommandOnly({
      overall: {
        configReady: true,
        healthReady: true
      },
      services: []
    }),
    "ready\n"
  );
});
