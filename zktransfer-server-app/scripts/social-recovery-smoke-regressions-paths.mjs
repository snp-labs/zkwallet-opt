import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function getBaseDir() {
  return (
    process.env.SOCIAL_RECOVERY_SMOKE_REPORT_DIR ||
    getArgValue("--base-dir") ||
    path.join(appDir, "tmp", "social-recovery-smoke-report")
  );
}

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const snapshotsDir = path.join(baseDir, "snapshots");
const indexPath = path.join(snapshotsDir, "index.json");
const historyPath = path.join(baseDir, "history.md");
const index = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, "utf8"))
  : { snapshots: [] };

const payload = {
  baseDir,
  latestDir,
  latestRegressionsPath: path.join(latestDir, "regressions.txt"),
  latestRegressionsJsonPath: path.join(latestDir, "regressions.json"),
  latestRegressionsHistoryPath: path.join(latestDir, "regressions-history.txt"),
  latestRegressionsHistoryJsonPath: path.join(latestDir, "regressions-history.json"),
  latestRegressionsHistoryGateFailingPath: path.join(
    latestDir,
    "regressions-history-gate-failing.txt"
  ),
  latestRegressionsHistoryGateFailingJsonPath: path.join(
    latestDir,
    "regressions-history-gate-failing.json"
  ),
  latestRegressionsHistoryGateFailingComparePath: path.join(
    latestDir,
    "regressions-history-gate-failing-compare.txt"
  ),
  latestRegressionsHistoryGateFailingCompareJsonPath: path.join(
    latestDir,
    "regressions-history-gate-failing-compare.json"
  ),
  latestRegressionsHistoryGateFailingCompareCheckPath: path.join(
    latestDir,
    "regressions-history-gate-failing-compare-check.txt"
  ),
  latestRegressionsHistoryGateFailingCompareCheckJsonPath: path.join(
    latestDir,
    "regressions-history-gate-failing-compare-check.json"
  ),
  latestRegressionsHistoryComparePath: path.join(
    latestDir,
    "regressions-history-compare.txt"
  ),
  latestRegressionsHistoryCompareJsonPath: path.join(
    latestDir,
    "regressions-history-compare.json"
  ),
  latestRegressionsHistoryCompareCheckPath: path.join(
    latestDir,
    "regressions-history-compare-check.txt"
  ),
  latestRegressionsHistoryCompareCheckJsonPath: path.join(
    latestDir,
    "regressions-history-compare-check.json"
  ),
  latestRegressionsComparePath: path.join(latestDir, "regressions-compare.txt"),
  latestRegressionsCompareJsonPath: path.join(latestDir, "regressions-compare.json"),
  latestRegressionsChangesPath: path.join(latestDir, "regressions-changes.txt"),
  latestRegressionsChangesJsonPath: path.join(latestDir, "regressions-changes.json"),
  latestRegressionsStatusPath: path.join(latestDir, "regressions-status.txt"),
  latestRegressionsStatusJsonPath: path.join(latestDir, "regressions-status.json"),
  latestRegressionsOverviewPath: path.join(latestDir, "regressions-overview.md"),
  latestRegressionsOverviewJsonPath: path.join(latestDir, "regressions-overview.json"),
  latestRegressionsNextPath: path.join(latestDir, "regressions-next.txt"),
  latestRegressionsPlanPath: path.join(latestDir, "regressions-plan.txt"),
  latestRegressionsPlanJsonPath: path.join(latestDir, "regressions-plan.json"),
  latestRegressionsSummaryPath: path.join(latestDir, "regressions-summary.md"),
  latestRegressionsSummaryJsonPath: path.join(latestDir, "regressions-summary.json"),
  latestRegressionsDoctorPath: path.join(latestDir, "regressions-doctor.txt"),
  latestRegressionsDoctorJsonPath: path.join(latestDir, "regressions-doctor.json"),
  latestRegressionsGatePath: path.join(latestDir, "regressions-gate.txt"),
  latestRegressionsGateJsonPath: path.join(latestDir, "regressions-gate.json"),
  latestRegressionsReportPath: path.join(latestDir, "regressions-report.md"),
  latestRegressionsReportJsonPath: path.join(latestDir, "regressions-report.json"),
  latestRegressionsIntegrityPath: path.join(latestDir, "regressions-integrity.txt"),
  latestRegressionsIntegrityJsonPath: path.join(latestDir, "regressions-integrity.json"),
  latestRegressionsCompareSavedPath: path.join(latestDir, "regressions-compare.txt"),
  latestRegressionsChangesSavedPath: path.join(latestDir, "regressions-changes.txt"),
  snapshotsDir,
  indexPath,
  historyPath,
  snapshotCount: index.snapshots.length,
  latestSnapshotName: index.snapshots[0]?.name || null,
  previousSnapshotName: index.snapshots[1]?.name || null,
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("# Social Recovery Smoke Regressions Paths");
  console.log("");
  console.log(`- baseDir: ${payload.baseDir}`);
  console.log(`- latestDir: ${payload.latestDir}`);
  console.log(`- latestRegressionsPath: ${payload.latestRegressionsPath}`);
  console.log(`- latestRegressionsJsonPath: ${payload.latestRegressionsJsonPath}`);
  console.log(`- latestRegressionsHistoryPath: ${payload.latestRegressionsHistoryPath}`);
  console.log(`- latestRegressionsHistoryJsonPath: ${payload.latestRegressionsHistoryJsonPath}`);
  console.log(
    `- latestRegressionsHistoryGateFailingPath: ${payload.latestRegressionsHistoryGateFailingPath}`
  );
  console.log(
    `- latestRegressionsHistoryGateFailingJsonPath: ${payload.latestRegressionsHistoryGateFailingJsonPath}`
  );
  console.log(
    `- latestRegressionsHistoryGateFailingComparePath: ${payload.latestRegressionsHistoryGateFailingComparePath}`
  );
  console.log(
    `- latestRegressionsHistoryGateFailingCompareJsonPath: ${payload.latestRegressionsHistoryGateFailingCompareJsonPath}`
  );
  console.log(
    `- latestRegressionsHistoryGateFailingCompareCheckPath: ${payload.latestRegressionsHistoryGateFailingCompareCheckPath}`
  );
  console.log(
    `- latestRegressionsHistoryGateFailingCompareCheckJsonPath: ${payload.latestRegressionsHistoryGateFailingCompareCheckJsonPath}`
  );
  console.log(`- latestRegressionsHistoryComparePath: ${payload.latestRegressionsHistoryComparePath}`);
  console.log(
    `- latestRegressionsHistoryCompareJsonPath: ${payload.latestRegressionsHistoryCompareJsonPath}`
  );
  console.log(
    `- latestRegressionsHistoryCompareCheckPath: ${payload.latestRegressionsHistoryCompareCheckPath}`
  );
  console.log(
    `- latestRegressionsHistoryCompareCheckJsonPath: ${payload.latestRegressionsHistoryCompareCheckJsonPath}`
  );
  console.log(`- latestRegressionsComparePath: ${payload.latestRegressionsComparePath}`);
  console.log(`- latestRegressionsCompareJsonPath: ${payload.latestRegressionsCompareJsonPath}`);
  console.log(`- latestRegressionsChangesPath: ${payload.latestRegressionsChangesPath}`);
  console.log(`- latestRegressionsChangesJsonPath: ${payload.latestRegressionsChangesJsonPath}`);
  console.log(`- latestRegressionsStatusPath: ${payload.latestRegressionsStatusPath}`);
  console.log(`- latestRegressionsStatusJsonPath: ${payload.latestRegressionsStatusJsonPath}`);
  console.log(`- latestRegressionsOverviewPath: ${payload.latestRegressionsOverviewPath}`);
  console.log(`- latestRegressionsOverviewJsonPath: ${payload.latestRegressionsOverviewJsonPath}`);
  console.log(`- latestRegressionsNextPath: ${payload.latestRegressionsNextPath}`);
  console.log(`- latestRegressionsPlanPath: ${payload.latestRegressionsPlanPath}`);
  console.log(`- latestRegressionsPlanJsonPath: ${payload.latestRegressionsPlanJsonPath}`);
  console.log(`- latestRegressionsSummaryPath: ${payload.latestRegressionsSummaryPath}`);
  console.log(`- latestRegressionsSummaryJsonPath: ${payload.latestRegressionsSummaryJsonPath}`);
  console.log(`- latestRegressionsDoctorPath: ${payload.latestRegressionsDoctorPath}`);
  console.log(`- latestRegressionsDoctorJsonPath: ${payload.latestRegressionsDoctorJsonPath}`);
  console.log(`- latestRegressionsGatePath: ${payload.latestRegressionsGatePath}`);
  console.log(`- latestRegressionsGateJsonPath: ${payload.latestRegressionsGateJsonPath}`);
  console.log(`- latestRegressionsReportPath: ${payload.latestRegressionsReportPath}`);
  console.log(`- latestRegressionsReportJsonPath: ${payload.latestRegressionsReportJsonPath}`);
  console.log(`- latestRegressionsIntegrityPath: ${payload.latestRegressionsIntegrityPath}`);
  console.log(`- latestRegressionsIntegrityJsonPath: ${payload.latestRegressionsIntegrityJsonPath}`);
  console.log(`- snapshotsDir: ${payload.snapshotsDir}`);
  console.log(`- indexPath: ${payload.indexPath}`);
  console.log(`- historyPath: ${payload.historyPath}`);
  console.log(`- snapshotCount: ${payload.snapshotCount}`);
  console.log(`- latestSnapshotName: ${payload.latestSnapshotName || "(none)"}`);
  console.log(`- previousSnapshotName: ${payload.previousSnapshotName || "(none)"}`);
}
