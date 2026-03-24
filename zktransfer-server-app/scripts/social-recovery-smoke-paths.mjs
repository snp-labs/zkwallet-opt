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
const historyPath = path.join(baseDir, "history.md");
const indexPath = path.join(snapshotsDir, "index.json");
const index = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, "utf8"))
  : { snapshots: [] };

const payload = {
  baseDir,
  latestDir,
  latestReportPath: path.join(latestDir, "report.md"),
  latestManifestPath: path.join(latestDir, "manifest.json"),
  latestPlanPath: path.join(latestDir, "plan.txt"),
  latestPlanJsonPath: path.join(latestDir, "plan.json"),
  latestSummaryPath: path.join(latestDir, "summary.md"),
  latestSummaryJsonPath: path.join(latestDir, "summary.json"),
  latestChangesPath: path.join(latestDir, "changes.txt"),
  latestChangesJsonPath: path.join(latestDir, "changes.json"),
  latestTrendPath: path.join(latestDir, "trend.txt"),
  latestTrendJsonPath: path.join(latestDir, "trend.json"),
  latestStabilityPath: path.join(latestDir, "stability.txt"),
  latestStabilityJsonPath: path.join(latestDir, "stability.json"),
  latestRegressionsPath: path.join(latestDir, "regressions.txt"),
  latestRegressionsJsonPath: path.join(latestDir, "regressions.json"),
  latestRegressionsHistoryPath: path.join(latestDir, "regressions-history.txt"),
  latestRegressionsHistoryJsonPath: path.join(latestDir, "regressions-history.json"),
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
  latestChecksumsPath: path.join(latestDir, "checksums.json"),
  latestChecksumsTextPath: path.join(latestDir, "checksums.txt"),
  latestChecksumsComparePath: path.join(latestDir, "checksums-compare.txt"),
  latestChecksumsCompareJsonPath: path.join(latestDir, "checksums-compare.json"),
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
  console.log("# Social Recovery Smoke Paths");
  console.log("");
  console.log(`- baseDir: ${payload.baseDir}`);
  console.log(`- latestDir: ${payload.latestDir}`);
  console.log(`- latestReportPath: ${payload.latestReportPath}`);
  console.log(`- latestManifestPath: ${payload.latestManifestPath}`);
  console.log(`- latestPlanPath: ${payload.latestPlanPath}`);
  console.log(`- latestPlanJsonPath: ${payload.latestPlanJsonPath}`);
  console.log(`- latestSummaryPath: ${payload.latestSummaryPath}`);
  console.log(`- latestSummaryJsonPath: ${payload.latestSummaryJsonPath}`);
  console.log(`- latestChangesPath: ${payload.latestChangesPath}`);
  console.log(`- latestChangesJsonPath: ${payload.latestChangesJsonPath}`);
  console.log(`- latestTrendPath: ${payload.latestTrendPath}`);
  console.log(`- latestTrendJsonPath: ${payload.latestTrendJsonPath}`);
  console.log(`- latestStabilityPath: ${payload.latestStabilityPath}`);
  console.log(`- latestStabilityJsonPath: ${payload.latestStabilityJsonPath}`);
  console.log(`- latestRegressionsPath: ${payload.latestRegressionsPath}`);
  console.log(`- latestRegressionsJsonPath: ${payload.latestRegressionsJsonPath}`);
  console.log(`- latestRegressionsHistoryPath: ${payload.latestRegressionsHistoryPath}`);
  console.log(`- latestRegressionsHistoryJsonPath: ${payload.latestRegressionsHistoryJsonPath}`);
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
  console.log(`- latestChecksumsPath: ${payload.latestChecksumsPath}`);
  console.log(`- latestChecksumsTextPath: ${payload.latestChecksumsTextPath}`);
  console.log(`- latestChecksumsComparePath: ${payload.latestChecksumsComparePath}`);
  console.log(`- latestChecksumsCompareJsonPath: ${payload.latestChecksumsCompareJsonPath}`);
  console.log(`- snapshotsDir: ${payload.snapshotsDir}`);
  console.log(`- indexPath: ${payload.indexPath}`);
  console.log(`- historyPath: ${payload.historyPath}`);
  console.log(`- snapshotCount: ${payload.snapshotCount}`);
  console.log(`- latestSnapshotName: ${payload.latestSnapshotName || "(none)"}`);
  console.log(`- previousSnapshotName: ${payload.previousSnapshotName || "(none)"}`);
}
