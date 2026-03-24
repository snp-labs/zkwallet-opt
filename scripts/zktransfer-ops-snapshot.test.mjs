import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  renderSnapshotState,
  resolveSnapshotSelection,
  resolveSnapshotState
} from "./zktransfer-ops-snapshot.mjs";
import { writeExportBundle } from "./zktransfer-ops-export.mjs";

test("resolveSnapshotSelection reads the optional snapshot name", () => {
  assert.deepEqual(resolveSnapshotSelection({}), { snapshotName: null });
  assert.deepEqual(resolveSnapshotSelection({ ZKTRANSFER_OPS_SNAPSHOT_NAME: "abc" }), {
    snapshotName: "abc"
  });
});

test("resolveSnapshotState defaults to the latest snapshot", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-snapshot-"));
  const snapshotsDir = path.join(baseDir, "snapshots");

  writeExportBundle(
    path.join(snapshotsDir, "2026-03-23T12-20-00-000Z"),
    { "report.md": "# Latest\n" },
    { snapshotName: "2026-03-23T12-20-00-000Z" }
  );
  writeExportBundle(
    path.join(snapshotsDir, "2026-03-23T12-10-00-000Z"),
    { "report.md": "# Older\n" },
    { snapshotName: "2026-03-23T12-10-00-000Z" }
  );

  const state = resolveSnapshotState(baseDir, { snapshotName: null });
  assert.equal(state.snapshot?.snapshotName, "2026-03-23T12-20-00-000Z");
});

test("resolveSnapshotState respects an explicit snapshot name", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-snapshot-"));
  const snapshotsDir = path.join(baseDir, "snapshots");
  writeExportBundle(
    path.join(snapshotsDir, "2026-03-23T12-10-00-000Z"),
    { "report.md": "# Selected\n" },
    { snapshotName: "2026-03-23T12-10-00-000Z" }
  );

  const state = resolveSnapshotState(baseDir, { snapshotName: "2026-03-23T12-10-00-000Z" });
  assert.equal(state.snapshot?.snapshotName, "2026-03-23T12-10-00-000Z");
  assert.equal(state.reportPath, path.join(snapshotsDir, "2026-03-23T12-10-00-000Z", "report.md"));
});

test("renderSnapshotState returns the snapshot report when present", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-snapshot-"));
  const snapshotDir = path.join(baseDir, "snapshots", "2026-03-23T12-10-00-000Z");
  writeExportBundle(
    snapshotDir,
    { "report.md": "# Snapshot Report\n" },
    { snapshotName: "2026-03-23T12-10-00-000Z" }
  );

  const output = renderSnapshotState({
    baseDir,
    selection: { snapshotName: "2026-03-23T12-10-00-000Z" },
    entries: [],
    snapshot: { snapshotName: "2026-03-23T12-10-00-000Z", snapshotDir },
    reportPath: path.join(snapshotDir, "report.md")
  });

  assert.equal(output, "# Snapshot Report\n");
});

test("renderSnapshotState explains missing snapshots", () => {
  assert.match(
    renderSnapshotState({
      baseDir: "/tmp",
      selection: { snapshotName: "missing" },
      entries: [],
      snapshot: null,
      reportPath: null
    }),
    /Snapshot not found: missing/
  );
});
