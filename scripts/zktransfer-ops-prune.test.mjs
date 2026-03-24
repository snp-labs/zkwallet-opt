import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyPrunePlan,
  buildPrunePlan,
  renderPrunePlan,
  resolvePruneConfig
} from "./zktransfer-ops-prune.mjs";
import { writeExportBundle } from "./zktransfer-ops-export.mjs";

test("resolvePruneConfig parses keep count and apply flag", () => {
  assert.deepEqual(resolvePruneConfig({}), { keep: 10, apply: false });
  assert.deepEqual(resolvePruneConfig({ ZKTRANSFER_OPS_PRUNE_KEEP: "3", ZKTRANSFER_OPS_PRUNE_APPLY: "1" }), {
    keep: 3,
    apply: true
  });
  assert.throws(() => resolvePruneConfig({ ZKTRANSFER_OPS_PRUNE_KEEP: "-1" }), /invalid/);
});

test("buildPrunePlan splits retained and prunable snapshots", () => {
  const entries = [
    { snapshotName: "c", snapshotDir: "/tmp/c" },
    { snapshotName: "b", snapshotDir: "/tmp/b" },
    { snapshotName: "a", snapshotDir: "/tmp/a" }
  ];

  const plan = buildPrunePlan(entries, 2);
  assert.deepEqual(plan.retained.map((entry) => entry.snapshotName), ["c", "b"]);
  assert.deepEqual(plan.prunable.map((entry) => entry.snapshotName), ["a"]);
});

test("renderPrunePlan shows dry-run guidance and prunable snapshots", () => {
  const output = renderPrunePlan(
    {
      keep: 1,
      retained: [{ snapshotName: "new" }],
      prunable: [{ snapshotName: "old", snapshotDir: "/tmp/old" }]
    },
    false
  );

  assert.match(output, /Mode: dry-run/);
  assert.match(output, /Prunable snapshots:/);
  assert.match(output, /old/);
  assert.match(output, /Set ZKTRANSFER_OPS_PRUNE_APPLY=1/);
});

test("applyPrunePlan deletes older snapshots and refreshes index/history", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-prune-"));
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  const snapshotsDir = path.join(baseDir, "snapshots");

  const retainedDir = path.join(snapshotsDir, "2026-03-23T12-20-00-000Z");
  writeExportBundle(
    retainedDir,
    { "summary.md": "# Retained\n" },
    {
      snapshotName: "2026-03-23T12-20-00-000Z",
      generatedAt: "2026-03-23T12:20:00.000Z",
      configReady: false,
      healthReady: false,
      blockingIssueCount: 2
    }
  );

  const prunableDir = path.join(snapshotsDir, "2026-03-23T12-10-00-000Z");
  writeExportBundle(
    prunableDir,
    { "summary.md": "# Prunable\n" },
    {
      snapshotName: "2026-03-23T12-10-00-000Z",
      generatedAt: "2026-03-23T12:10:00.000Z",
      configReady: false,
      healthReady: false,
      blockingIssueCount: 3
    }
  );

  const result = applyPrunePlan(baseDir, {
    keep: 1,
    retained: [
      {
        snapshotName: "2026-03-23T12-20-00-000Z",
        snapshotDir: retainedDir
      }
    ],
    prunable: [
      {
        snapshotName: "2026-03-23T12-10-00-000Z",
        snapshotDir: prunableDir
      }
    ]
  });

  assert.equal(fs.existsSync(prunableDir), false);
  assert.equal(fs.existsSync(retainedDir), true);
  const indexFile = JSON.parse(fs.readFileSync(result.indexPath, "utf8"));
  assert.deepEqual(indexFile.map((entry) => entry.snapshotName), ["2026-03-23T12-20-00-000Z"]);
});
