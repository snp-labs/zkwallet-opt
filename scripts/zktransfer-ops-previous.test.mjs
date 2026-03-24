import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderPreviousSnapshot, resolvePreviousSnapshot } from "./zktransfer-ops-previous.mjs";
import { writeExportBundle } from "./zktransfer-ops-export.mjs";

test("resolvePreviousSnapshot returns null when there is no previous snapshot", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-previous-"));
  const state = resolvePreviousSnapshot(baseDir);
  assert.equal(state.previous, null);
  assert.equal(state.reportPath, null);
});

test("resolvePreviousSnapshot returns the second newest snapshot", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-previous-"));
  const snapshotsDir = path.join(baseDir, "snapshots");

  writeExportBundle(
    path.join(snapshotsDir, "2026-03-23T12-20-00-000Z"),
    { "report.md": "# Newest\n" },
    { snapshotName: "2026-03-23T12-20-00-000Z" }
  );
  writeExportBundle(
    path.join(snapshotsDir, "2026-03-23T12-10-00-000Z"),
    { "report.md": "# Previous\n" },
    { snapshotName: "2026-03-23T12-10-00-000Z" }
  );

  const state = resolvePreviousSnapshot(baseDir);
  assert.equal(state.previous?.snapshotName, "2026-03-23T12-10-00-000Z");
  assert.equal(state.reportPath, path.join(snapshotsDir, "2026-03-23T12-10-00-000Z", "report.md"));
});

test("renderPreviousSnapshot returns previous report contents when present", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-previous-"));
  const snapshotsDir = path.join(baseDir, "snapshots");
  const previousDir = path.join(snapshotsDir, "2026-03-23T12-10-00-000Z");

  writeExportBundle(
    previousDir,
    { "report.md": "# Previous Report\n" },
    { snapshotName: "2026-03-23T12-10-00-000Z" }
  );

  const output = renderPreviousSnapshot({
    baseDir,
    previous: { snapshotName: "2026-03-23T12-10-00-000Z", snapshotDir: previousDir },
    reportPath: path.join(previousDir, "report.md")
  });

  assert.equal(output, "# Previous Report\n");
});

test("renderPreviousSnapshot explains when no previous snapshot exists", () => {
  assert.match(
    renderPreviousSnapshot({
      baseDir: "/tmp/exports",
      previous: null,
      reportPath: null
    }),
    /No previous snapshot is available/
  );
});
