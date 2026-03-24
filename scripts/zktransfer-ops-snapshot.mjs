import fs from "node:fs";
import path from "node:path";
import { collectSnapshotEntries, resolveExportDir } from "./zktransfer-ops-export.mjs";

export function resolveSnapshotSelection(env = process.env) {
  return {
    snapshotName: env.ZKTRANSFER_OPS_SNAPSHOT_NAME || null
  };
}

export function resolveSnapshotState(baseDir, selection) {
  const entries = collectSnapshotEntries(baseDir);
  const snapshot = selection.snapshotName
    ? entries.find((entry) => entry.snapshotName === selection.snapshotName) || null
    : entries[0] || null;

  return {
    baseDir,
    selection,
    entries,
    snapshot,
    reportPath: snapshot ? path.join(snapshot.snapshotDir, "report.md") : null
  };
}

export function renderSnapshotState(state) {
  if (!state.snapshot) {
    if (state.selection.snapshotName) {
      return `zkTransfer Ops Snapshot\nSnapshot not found: ${state.selection.snapshotName}\n`;
    }

    return "zkTransfer Ops Snapshot\nNo snapshots are available.\n";
  }

  if (state.reportPath && fs.existsSync(state.reportPath)) {
    return fs.readFileSync(state.reportPath, "utf8");
  }

  return [
    "zkTransfer Ops Snapshot",
    `Snapshot: ${state.snapshot.snapshotName}`,
    `Report file not found: ${state.reportPath}`
  ].join("\n") + "\n";
}

function main() {
  const baseDir = resolveExportDir(process.env);
  const selection = resolveSnapshotSelection(process.env);
  const state = resolveSnapshotState(baseDir, selection);
  process.stdout.write(renderSnapshotState(state));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
