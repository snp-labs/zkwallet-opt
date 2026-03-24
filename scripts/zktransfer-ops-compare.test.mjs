import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildComparisonReport,
  loadSnapshotComparison,
  resolveComparisonSelection,
  renderComparisonReport
} from "./zktransfer-ops-compare.mjs";
import { writeExportBundle } from "./zktransfer-ops-export.mjs";

test("buildComparisonReport handles empty and single-snapshot histories", () => {
  assert.deepEqual(buildComparisonReport({ latest: null, previous: null }), {
    status: "empty",
    message: "No snapshots found."
  });

  assert.deepEqual(
    buildComparisonReport({
      latest: { snapshotName: "2026-03-23T12-15-00-000Z" },
      previous: null
    }),
    {
      status: "single",
      message: "Only one snapshot is available: 2026-03-23T12-15-00-000Z."
    }
  );

  assert.deepEqual(
    buildComparisonReport({
      latestMissingName: "missing",
      previousMissingName: null
    }),
    {
      status: "missing",
      message: "Requested snapshot was not found: latest=missing."
    }
  );
});

test("resolveComparisonSelection reads optional env overrides", () => {
  assert.deepEqual(resolveComparisonSelection({}), {
    latestName: null,
    previousName: null
  });
  assert.deepEqual(
    resolveComparisonSelection({
      ZKTRANSFER_OPS_COMPARE_LATEST: "a",
      ZKTRANSFER_OPS_COMPARE_PREVIOUS: "b"
    }),
    {
      latestName: "a",
      previousName: "b"
    }
  );
});

test("loadSnapshotComparison and buildComparisonReport compare latest two snapshots", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-compare-"));
  const snapshotsDir = path.join(baseDir, "snapshots");

  const previousDir = path.join(snapshotsDir, "2026-03-23T12-15-00-000Z");
  writeExportBundle(
    previousDir,
    {
      "summary.json": `${JSON.stringify({
        overall: { configReady: false, healthReady: false, blockingIssueCount: 3 },
        blockingIssues: ["missing .env", "health endpoint is unavailable"],
        services: [
          { serviceName: "zktransfer-server-app", suggestedCommand: "npm run setup:env" }
        ]
      })}\n`
    },
    {
      snapshotName: "2026-03-23T12-15-00-000Z",
      generatedAt: "2026-03-23T12:15:00.000Z",
      configReady: false,
      healthReady: false,
      blockingIssueCount: 3
    }
  );

  const latestDir = path.join(snapshotsDir, "2026-03-23T12-16-00-000Z");
  writeExportBundle(
    latestDir,
    {
      "summary.json": `${JSON.stringify({
        overall: { configReady: true, healthReady: false, blockingIssueCount: 2 },
        blockingIssues: ["health endpoint is unavailable", "legacy proof-input policy is not pinned"],
        services: [
          { serviceName: "zktransfer-server-app", suggestedCommand: "npm run check:ready" }
        ]
      })}\n`
    },
    {
      snapshotName: "2026-03-23T12-16-00-000Z",
      generatedAt: "2026-03-23T12:16:00.000Z",
      configReady: true,
      healthReady: false,
      blockingIssueCount: 2
    }
  );

  const comparison = loadSnapshotComparison(baseDir);
  const report = buildComparisonReport(comparison);

  assert.equal(report.status, "compared");
  assert.equal(report.blockingIssueCountDelta, -1);
  assert.equal(report.configReadyChanged, true);
  assert.equal(report.healthReadyChanged, false);
  assert.deepEqual(report.blockingIssues.added, ["legacy proof-input policy is not pinned"]);
  assert.deepEqual(report.blockingIssues.removed, ["missing .env"]);
  assert.deepEqual(report.serviceNextChanges, [
    {
      serviceName: "zktransfer-server-app",
      latestSuggested: "npm run check:ready",
      previousSuggested: "npm run setup:env"
    }
  ]);
});

test("loadSnapshotComparison respects explicit snapshot selection", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-compare-select-"));
  const snapshotsDir = path.join(baseDir, "snapshots");

  for (const snapshotName of [
    "2026-03-23T12-20-00-000Z",
    "2026-03-23T12-10-00-000Z",
    "2026-03-23T12-00-00-000Z"
  ]) {
    writeExportBundle(
      path.join(snapshotsDir, snapshotName),
      { "summary.json": `${JSON.stringify({ overall: { blockingIssueCount: 1 }, services: [] })}\n` },
      { snapshotName }
    );
  }

  const comparison = loadSnapshotComparison(baseDir, {
    latestName: "2026-03-23T12-10-00-000Z",
    previousName: "2026-03-23T12-00-00-000Z"
  });
  assert.equal(comparison.latest?.snapshotName, "2026-03-23T12-10-00-000Z");
  assert.equal(comparison.previous?.snapshotName, "2026-03-23T12-00-00-000Z");

  const missingComparison = loadSnapshotComparison(baseDir, {
    latestName: "missing"
  });
  assert.equal(missingComparison.latest, null);
  assert.equal(missingComparison.latestMissingName, "missing");
});

test("renderComparisonReport prints changes in a readable format", () => {
  const output = renderComparisonReport({
    status: "compared",
    latest: { snapshotName: "new" },
    previous: { snapshotName: "old" },
    blockingIssueCountDelta: -1,
    configReadyChanged: true,
    healthReadyChanged: false,
    blockingIssues: {
      added: ["issue A"],
      removed: ["issue B"]
    },
    serviceNextChanges: [
      {
        serviceName: "zktransfer-server-app",
        previousSuggested: "npm run setup:env",
        latestSuggested: "npm run check:ready"
      }
    ]
  });

  assert.match(output, /Latest: new/);
  assert.match(output, /Blocking issue delta: -1/);
  assert.match(output, /Added blocking issues:/);
  assert.match(output, /Removed blocking issues:/);
  assert.match(output, /zktransfer-server-app: npm run setup:env -> npm run check:ready/);
  assert.match(renderComparisonReport({ status: "missing", message: "Requested snapshot was not found." }), /Requested snapshot was not found/);
});
