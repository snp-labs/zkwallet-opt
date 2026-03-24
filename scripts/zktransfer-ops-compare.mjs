import { collectSnapshotEntries, resolveExportDir } from "./zktransfer-ops-export.mjs";
import {
  buildComparisonReport,
  buildSnapshotComparison,
  renderComparisonReport,
  resolveComparisonSelection
} from "./zktransfer-ops-compare-core.mjs";

export { buildComparisonReport, renderComparisonReport, resolveComparisonSelection } from "./zktransfer-ops-compare-core.mjs";

export function loadSnapshotComparison(baseDir, selection = {}) {
  const entries = collectSnapshotEntries(baseDir);
  return buildSnapshotComparison({
    baseDir,
    entries,
    latestName: selection.latestName,
    previousName: selection.previousName
  });
}

function main() {
  const baseDir = resolveExportDir(process.env);
  const selection = resolveComparisonSelection(process.env);
  const comparison = loadSnapshotComparison(baseDir, selection);
  const report = buildComparisonReport(comparison);
  process.stdout.write(renderComparisonReport(report));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
