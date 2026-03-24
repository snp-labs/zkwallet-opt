import fs from "node:fs";
import path from "node:path";
import { collectSnapshotEntries, resolveExportDir } from "./zktransfer-ops-export.mjs";

export function resolvePreviousSnapshot(baseDir) {
  const entries = collectSnapshotEntries(baseDir);
  const previous = entries[1] || null;

  if (!previous) {
    return {
      baseDir,
      previous: null,
      reportPath: null
    };
  }

  return {
    baseDir,
    previous,
    reportPath: path.join(previous.snapshotDir, "report.md")
  };
}

export function renderPreviousSnapshot(state) {
  if (!state.previous) {
    return "zkTransfer Ops Previous\nNo previous snapshot is available.\n";
  }

  if (state.reportPath && fs.existsSync(state.reportPath)) {
    return fs.readFileSync(state.reportPath, "utf8");
  }

  return [
    "zkTransfer Ops Previous",
    `Previous snapshot: ${state.previous.snapshotName}`,
    `Report file not found: ${state.reportPath}`
  ].join("\n") + "\n";
}

function main() {
  const baseDir = resolveExportDir(process.env);
  const state = resolvePreviousSnapshot(baseDir);
  process.stdout.write(renderPreviousSnapshot(state));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
