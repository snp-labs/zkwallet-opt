import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

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

function runNodeJson(scriptPath, baseDir) {
  return JSON.parse(
    execFileSync(process.execPath, [scriptPath, "--json", "--base-dir", baseDir], {
      cwd: appDir,
      encoding: "utf8",
    })
  );
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

const baseDir = getBaseDir();
const overview = runNodeJson(
  path.join(appDir, "scripts", "social-recovery-smoke-regressions-overview.mjs"),
  baseDir
);
const historyText = readTextIfExists(path.join(baseDir, "history.md"));

const payload = {
  baseDir,
  overview,
  paths: {
    latestRegressionsPath: path.join(baseDir, "latest", "regressions.txt"),
    latestRegressionsHistoryPath: path.join(baseDir, "latest", "regressions-history.txt"),
    latestRegressionsHistoryJsonPath: path.join(baseDir, "latest", "regressions-history.json"),
    latestRegressionsHistoryGateFailingPath: path.join(
      baseDir,
      "latest",
      "regressions-history-gate-failing.txt"
    ),
    latestRegressionsHistoryGateFailingJsonPath: path.join(
      baseDir,
      "latest",
      "regressions-history-gate-failing.json"
    ),
    latestRegressionsHistoryGateFailingComparePath: path.join(
      baseDir,
      "latest",
      "regressions-history-gate-failing-compare.txt"
    ),
    latestRegressionsHistoryGateFailingCompareJsonPath: path.join(
      baseDir,
      "latest",
      "regressions-history-gate-failing-compare.json"
    ),
    latestRegressionsHistoryGateFailingCompareCheckPath: path.join(
      baseDir,
      "latest",
      "regressions-history-gate-failing-compare-check.txt"
    ),
    latestRegressionsHistoryGateFailingCompareCheckJsonPath: path.join(
      baseDir,
      "latest",
      "regressions-history-gate-failing-compare-check.json"
    ),
    latestRegressionsHistoryComparePath: path.join(
      baseDir,
      "latest",
      "regressions-history-compare.txt"
    ),
    latestRegressionsHistoryCompareJsonPath: path.join(
      baseDir,
      "latest",
      "regressions-history-compare.json"
    ),
    latestRegressionsHistoryCompareCheckPath: path.join(
      baseDir,
      "latest",
      "regressions-history-compare-check.txt"
    ),
    latestRegressionsHistoryCompareCheckJsonPath: path.join(
      baseDir,
      "latest",
      "regressions-history-compare-check.json"
    ),
    latestRegressionsComparePath: path.join(baseDir, "latest", "regressions-compare.txt"),
    latestRegressionsChangesPath: path.join(baseDir, "latest", "regressions-changes.txt"),
    latestRegressionsIntegrityPath: path.join(baseDir, "latest", "regressions-integrity.txt"),
    latestRegressionsGatePath: path.join(baseDir, "latest", "regressions-gate.txt"),
    latestRegressionsGateJsonPath: path.join(baseDir, "latest", "regressions-gate.json"),
    latestRegressionsStatusPath: path.join(baseDir, "latest", "regressions-status.txt"),
    latestRegressionsOverviewPath: path.join(baseDir, "latest", "regressions-overview.md"),
    latestRegressionsPlanPath: path.join(baseDir, "latest", "regressions-plan.txt"),
    latestRegressionsNextPath: path.join(baseDir, "latest", "regressions-next.txt"),
    latestRegressionsDoctorPath: path.join(baseDir, "latest", "regressions-doctor.txt"),
    latestRegressionsReportPath: path.join(baseDir, "latest", "regressions-report.md"),
    historyPath: path.join(baseDir, "history.md"),
  },
  historyPreview: historyText
    ? historyText.split("\n").slice(0, 8).join("\n").trim()
    : null,
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const lines = [
    "# Social Recovery Smoke Regressions Summary",
    "",
    "# Social Recovery Smoke Regressions Overview",
    "",
    `- baseDir: ${payload.overview.baseDir}`,
    `- regressionCount: ${payload.overview.regressionCount}`,
    `- windowSize: ${payload.overview.windowSize ?? "(not available)"}`,
    `- hasRegressions: ${payload.overview.hasRegressions}`,
    `- hasRegressionsGate: ${payload.overview.hasRegressionsGate ?? false}`,
    `- regressionsGateOk: ${payload.overview.regressionsGateOk ?? "(not available)"}`,
    `- regressionsGateIssueCount: ${payload.overview.regressionsGateIssueCount ?? 0}`,
    `- hasRegressionsHistory: ${payload.overview.hasRegressionsHistory}`,
    `- hasRegressionsHistoryGateFailing: ${payload.overview.hasRegressionsHistoryGateFailing ?? false}`,
    `- hasRegressionsHistoryGateFailingCompare: ${payload.overview.hasRegressionsHistoryGateFailingCompare ?? false}`,
    `- hasRegressionsHistoryGateFailingCompareCheck: ${payload.overview.hasRegressionsHistoryGateFailingCompareCheck ?? false}`,
    `- regressionsHistoryGateFailingCompareCheckOk: ${payload.overview.regressionsHistoryGateFailingCompareCheckOk ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareCheckIssueCount: ${payload.overview.regressionsHistoryGateFailingCompareCheckIssueCount ?? 0}`,
    `- hasRegressionsHistoryCompare: ${payload.overview.hasRegressionsHistoryCompare}`,
    `- hasRegressionsHistoryCompareCheck: ${payload.overview.hasRegressionsHistoryCompareCheck ?? false}`,
    `- regressionsHistoryCompareCheckIssueCount: ${payload.overview.regressionsHistoryCompareCheckIssueCount ?? 0}`,
    `- hasRegressionsCompare: ${payload.overview.hasRegressionsCompare}`,
    `- hasRegressionsChanges: ${payload.overview.hasRegressionsChanges}`,
    `- hasRegressionsIntegrity: ${payload.overview.hasRegressionsIntegrity}`,
    `- regressionsHistoryCompareCheckOk: ${payload.overview.regressionsHistoryCompareCheckOk ?? "(not available)"}`,
    `- regressionsIntegrityOk: ${payload.overview.regressionsIntegrityOk ?? "(not available)"}`,
    `- regressionsIntegrityIssueCount: ${payload.overview.regressionsIntegrityIssueCount}`,
    `- regressionsHistorySnapshotCount: ${payload.overview.regressionsHistorySnapshotCount}`,
    `- regressionsHistoryUnstableCount: ${payload.overview.regressionsHistoryUnstableCount}`,
    `- regressionsHistoryGateFailingCount: ${payload.overview.regressionsHistoryGateFailingCount ?? 0}`,
    `- regressionsHistoryGateFailingSnapshotCount: ${payload.overview.regressionsHistoryGateFailingSnapshotCount ?? 0}`,
    `- regressionsHistoryGateFailingCompareGateFailingCountDelta: ${payload.overview.regressionsHistoryGateFailingCompareGateFailingCountDelta ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareGateIssueCountDelta: ${payload.overview.regressionsHistoryGateFailingCompareGateIssueCountDelta ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareAddedGateFailingCount: ${payload.overview.regressionsHistoryGateFailingCompareAddedGateFailingCount ?? 0}`,
    `- regressionsHistoryGateFailingCompareChangedToGateFailingCount: ${payload.overview.regressionsHistoryGateFailingCompareChangedToGateFailingCount ?? 0}`,
    `- regressionsHistoryGateFailingCompareWorseningDetected: ${payload.overview.regressionsHistoryGateFailingCompareWorseningDetected ?? false}`,
    `- regressionsHistoryGateFailingCompareWorseningSignalCount: ${payload.overview.regressionsHistoryGateFailingCompareWorseningSignalCount ?? 0}`,
    `- regressionsHistoryCompareChangedStatusCount: ${payload.overview.regressionsHistoryCompareChangedStatusCount}`,
    `- regressionsHistoryCompareAddedUnstableCount: ${payload.overview.regressionsHistoryCompareAddedUnstableCount ?? 0}`,
    `- regressionsHistoryCompareChangedToUnstableCount: ${payload.overview.regressionsHistoryCompareChangedToUnstableCount ?? 0}`,
    `- regressionsHistoryCompareGateFailingCountDelta: ${payload.overview.regressionsHistoryCompareGateFailingCountDelta ?? "(not available)"}`,
    `- regressionsHistoryCompareGateIssueCountDelta: ${payload.overview.regressionsHistoryCompareGateIssueCountDelta ?? "(not available)"}`,
    `- regressionsHistoryCompareAddedGateFailingCount: ${payload.overview.regressionsHistoryCompareAddedGateFailingCount ?? 0}`,
    `- regressionsHistoryCompareChangedToGateFailingCount: ${payload.overview.regressionsHistoryCompareChangedToGateFailingCount ?? 0}`,
    `- regressionsHistoryCompareWorseningDetected: ${payload.overview.regressionsHistoryCompareWorseningDetected ?? false}`,
    `- regressionsHistoryCompareWorseningSignalCount: ${payload.overview.regressionsHistoryCompareWorseningSignalCount ?? 0}`,
    `- regressionsHistoryCompareUnstableCountDelta: ${payload.overview.regressionsHistoryCompareUnstableCountDelta ?? "(not available)"}`,
    `- regressionCountDelta: ${payload.overview.regressionCountDelta ?? "(not available)"}`,
    `- unstableSnapshots: ${payload.overview.unstableSnapshotNames.join(", ") || "(none)"}`,
    `- addedSnapshots: ${payload.overview.addedSnapshotNames.join(", ") || "(none)"}`,
    "",
    "## Next",
    "",
    `- reason: ${payload.overview.next.reason}`,
    `- command: ${payload.overview.next.command}`,
    "",
    "## Paths",
    "",
    `- latestRegressionsPath: ${payload.paths.latestRegressionsPath}`,
    `- latestRegressionsHistoryPath: ${payload.paths.latestRegressionsHistoryPath}`,
    `- latestRegressionsHistoryJsonPath: ${payload.paths.latestRegressionsHistoryJsonPath}`,
    `- latestRegressionsHistoryGateFailingPath: ${payload.paths.latestRegressionsHistoryGateFailingPath}`,
    `- latestRegressionsHistoryGateFailingJsonPath: ${payload.paths.latestRegressionsHistoryGateFailingJsonPath}`,
    `- latestRegressionsHistoryGateFailingComparePath: ${payload.paths.latestRegressionsHistoryGateFailingComparePath}`,
    `- latestRegressionsHistoryGateFailingCompareJsonPath: ${payload.paths.latestRegressionsHistoryGateFailingCompareJsonPath}`,
    `- latestRegressionsHistoryGateFailingCompareCheckPath: ${payload.paths.latestRegressionsHistoryGateFailingCompareCheckPath}`,
    `- latestRegressionsHistoryGateFailingCompareCheckJsonPath: ${payload.paths.latestRegressionsHistoryGateFailingCompareCheckJsonPath}`,
    `- latestRegressionsHistoryComparePath: ${payload.paths.latestRegressionsHistoryComparePath}`,
    `- latestRegressionsHistoryCompareJsonPath: ${payload.paths.latestRegressionsHistoryCompareJsonPath}`,
    `- latestRegressionsHistoryCompareCheckPath: ${payload.paths.latestRegressionsHistoryCompareCheckPath}`,
    `- latestRegressionsHistoryCompareCheckJsonPath: ${payload.paths.latestRegressionsHistoryCompareCheckJsonPath}`,
    `- latestRegressionsComparePath: ${payload.paths.latestRegressionsComparePath}`,
    `- latestRegressionsChangesPath: ${payload.paths.latestRegressionsChangesPath}`,
    `- latestRegressionsIntegrityPath: ${payload.paths.latestRegressionsIntegrityPath}`,
    `- latestRegressionsGatePath: ${payload.paths.latestRegressionsGatePath}`,
    `- latestRegressionsGateJsonPath: ${payload.paths.latestRegressionsGateJsonPath}`,
    `- latestRegressionsStatusPath: ${payload.paths.latestRegressionsStatusPath}`,
    `- latestRegressionsOverviewPath: ${payload.paths.latestRegressionsOverviewPath}`,
    `- latestRegressionsPlanPath: ${payload.paths.latestRegressionsPlanPath}`,
    `- latestRegressionsNextPath: ${payload.paths.latestRegressionsNextPath}`,
    `- latestRegressionsDoctorPath: ${payload.paths.latestRegressionsDoctorPath}`,
    `- latestRegressionsReportPath: ${payload.paths.latestRegressionsReportPath}`,
    `- historyPath: ${payload.paths.historyPath}`,
    "",
    "## History Preview",
    "",
    payload.historyPreview || "(history not available)",
    "",
  ];
  process.stdout.write(lines.join("\n"));
}
