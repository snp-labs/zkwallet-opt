import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadHistoryState, renderHistoryPaths, renderHistoryState } from "./zktransfer-ops-history.mjs";
import { writeExportBundle } from "./zktransfer-ops-export.mjs";

test("loadHistoryState discovers snapshot entries and history file status", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-history-"));
  const snapshotsDir = path.join(baseDir, "snapshots");
  writeExportBundle(
    path.join(snapshotsDir, "2026-03-23T12-20-00-000Z"),
    { "summary.md": "# Summary\n" },
    {
      snapshotName: "2026-03-23T12-20-00-000Z",
      generatedAt: "2026-03-23T12:20:00.000Z",
      configReady: false,
      healthReady: false,
      blockingIssueCount: 4
    }
  );

  const state = loadHistoryState(baseDir);
  assert.equal(state.historyExists, false);
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].snapshotName, "2026-03-23T12-20-00-000Z");
});

test("renderHistoryState prefers the existing history file", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-history-"));
  const historyPath = path.join(baseDir, "history.md");
  fs.writeFileSync(historyPath, "# Existing History\n");

  const output = renderHistoryState({
    baseDir,
    latestDir: path.join(baseDir, "latest"),
    historyPath,
    entries: [],
    historyExists: true
  });

  assert.equal(output, "# Existing History\n");
});

test("renderHistoryState falls back to rendered snapshot history when needed", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-history-"));
  const output = renderHistoryState({
    baseDir,
    latestDir: path.join(baseDir, "latest"),
    historyPath: path.join(baseDir, "history.md"),
    entries: [
      {
        snapshotName: "2026-03-23T12-20-00-000Z",
        generatedAt: "2026-03-23T12:20:00.000Z",
        snapshotDir: path.join(baseDir, "snapshots", "2026-03-23T12-20-00-000Z"),
        blockingIssueCount: 4,
        configReady: false,
        healthReady: false
      }
    ],
    historyExists: false
  });

  assert.match(output, /# zkTransfer Ops Export History/);
  assert.match(output, /2026-03-23T12-20-00-000Z/);
});

test("renderHistoryPaths prints the key filesystem locations", () => {
  const output = renderHistoryPaths({
    baseDir: "/tmp/exports",
    latestDir: "/tmp/exports/latest",
    historyPath: "/tmp/exports/history.md",
    entries: [{ snapshotName: "a" }, { snapshotName: "b" }]
  });

  assert.match(output, /Base dir: \/tmp\/exports/);
  assert.match(output, /Latest dir: \/tmp\/exports\/latest/);
  assert.match(output, /History file: \/tmp\/exports\/history\.md/);
  assert.match(output, /Snapshot count: 2/);
});
