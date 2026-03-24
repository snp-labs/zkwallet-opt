import fs from "node:fs";
import path from "node:path";
import { collectSnapshotEntries, renderSnapshotHistory, resolveExportDir } from "./zktransfer-ops-export.mjs";

export function loadHistoryState(baseDir) {
  const latestDir = path.join(baseDir, "latest");
  const historyPath = path.join(baseDir, "history.md");
  const entries = collectSnapshotEntries(baseDir);

  return {
    baseDir,
    latestDir,
    historyPath,
    entries,
    historyExists: fs.existsSync(historyPath)
  };
}

export function renderHistoryState(state) {
  if (state.historyExists) {
    return fs.readFileSync(state.historyPath, "utf8");
  }

  return renderSnapshotHistory(state.entries, state.latestDir);
}

export function renderHistoryPaths(state) {
  const lines = [];
  lines.push("zkTransfer Ops History Paths");
  lines.push(`Base dir: ${state.baseDir}`);
  lines.push(`Latest dir: ${state.latestDir}`);
  lines.push(`History file: ${state.historyPath}`);
  lines.push(`Snapshot count: ${state.entries.length}`);
  return `${lines.join("\n")}\n`;
}

function main() {
  const baseDir = resolveExportDir(process.env);
  const state = loadHistoryState(baseDir);
  if (process.argv.slice(2).includes("--paths")) {
    process.stdout.write(renderHistoryPaths(state));
    return;
  }
  process.stdout.write(renderHistoryState(state));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
