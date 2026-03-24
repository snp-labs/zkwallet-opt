import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
  const result = spawnSync(process.execPath, [scriptPath, "--json", "--base-dir", baseDir], {
    cwd: appDir,
    encoding: "utf8",
  });
  if (result.stdout) {
    return JSON.parse(result.stdout);
  }
  if (result.error) {
    throw result.error;
  }
  throw new Error(result.stderr || `Failed to run ${scriptPath}`);
}

function renderReport(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Report",
    "",
    "# Social Recovery Smoke Regressions Summary",
    "",
    "# Social Recovery Smoke Regressions Overview",
    "",
    `- baseDir: ${payload.summary.overview.baseDir}`,
    `- regressionCount: ${payload.summary.overview.regressionCount}`,
    `- windowSize: ${payload.summary.overview.windowSize ?? "(not available)"}`,
    `- hasRegressions: ${payload.summary.overview.hasRegressions}`,
    `- hasRegressionsGate: ${payload.summary.overview.hasRegressionsGate ?? false}`,
    `- regressionsGateOk: ${payload.summary.overview.regressionsGateOk ?? "(not available)"}`,
    `- regressionsGateIssueCount: ${payload.summary.overview.regressionsGateIssueCount ?? 0}`,
    `- hasRegressionsHistory: ${payload.summary.overview.hasRegressionsHistory}`,
    `- hasRegressionsHistoryGateFailing: ${payload.summary.overview.hasRegressionsHistoryGateFailing ?? false}`,
    `- hasRegressionsHistoryGateFailingCompare: ${payload.summary.overview.hasRegressionsHistoryGateFailingCompare ?? false}`,
    `- hasRegressionsHistoryGateFailingCompareCheck: ${payload.summary.overview.hasRegressionsHistoryGateFailingCompareCheck ?? false}`,
    `- regressionsHistoryGateFailingCompareCheckOk: ${payload.summary.overview.regressionsHistoryGateFailingCompareCheckOk ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareCheckIssueCount: ${payload.summary.overview.regressionsHistoryGateFailingCompareCheckIssueCount ?? 0}`,
    `- hasRegressionsHistoryCompare: ${payload.summary.overview.hasRegressionsHistoryCompare}`,
    `- hasRegressionsHistoryCompareCheck: ${payload.summary.overview.hasRegressionsHistoryCompareCheck ?? false}`,
    `- regressionsHistoryCompareCheckIssueCount: ${payload.summary.overview.regressionsHistoryCompareCheckIssueCount ?? 0}`,
    `- hasRegressionsCompare: ${payload.summary.overview.hasRegressionsCompare}`,
    `- hasRegressionsChanges: ${payload.summary.overview.hasRegressionsChanges}`,
    `- hasRegressionsIntegrity: ${payload.summary.overview.hasRegressionsIntegrity}`,
    `- regressionsHistoryCompareCheckOk: ${payload.summary.overview.regressionsHistoryCompareCheckOk ?? "(not available)"}`,
    `- regressionsIntegrityOk: ${payload.summary.overview.regressionsIntegrityOk ?? "(not available)"}`,
    `- regressionsIntegrityIssueCount: ${payload.summary.overview.regressionsIntegrityIssueCount}`,
    `- regressionsHistorySnapshotCount: ${payload.summary.overview.regressionsHistorySnapshotCount}`,
    `- regressionsHistoryUnstableCount: ${payload.summary.overview.regressionsHistoryUnstableCount}`,
    `- regressionsHistoryGateFailingCount: ${payload.summary.overview.regressionsHistoryGateFailingCount ?? 0}`,
    `- regressionsHistoryGateFailingSnapshotCount: ${payload.summary.overview.regressionsHistoryGateFailingSnapshotCount ?? 0}`,
    `- regressionsHistoryGateFailingCompareGateFailingCountDelta: ${payload.summary.overview.regressionsHistoryGateFailingCompareGateFailingCountDelta ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareGateIssueCountDelta: ${payload.summary.overview.regressionsHistoryGateFailingCompareGateIssueCountDelta ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareAddedGateFailingCount: ${payload.summary.overview.regressionsHistoryGateFailingCompareAddedGateFailingCount ?? 0}`,
    `- regressionsHistoryGateFailingCompareChangedToGateFailingCount: ${payload.summary.overview.regressionsHistoryGateFailingCompareChangedToGateFailingCount ?? 0}`,
    `- regressionsHistoryGateFailingCompareWorseningDetected: ${payload.summary.overview.regressionsHistoryGateFailingCompareWorseningDetected ?? false}`,
    `- regressionsHistoryGateFailingCompareWorseningSignalCount: ${payload.summary.overview.regressionsHistoryGateFailingCompareWorseningSignalCount ?? 0}`,
    `- regressionsHistoryCompareChangedStatusCount: ${payload.summary.overview.regressionsHistoryCompareChangedStatusCount}`,
    `- regressionsHistoryCompareAddedUnstableCount: ${payload.summary.overview.regressionsHistoryCompareAddedUnstableCount ?? 0}`,
    `- regressionsHistoryCompareChangedToUnstableCount: ${payload.summary.overview.regressionsHistoryCompareChangedToUnstableCount ?? 0}`,
    `- regressionsHistoryCompareGateFailingCountDelta: ${payload.summary.overview.regressionsHistoryCompareGateFailingCountDelta ?? "(not available)"}`,
    `- regressionsHistoryCompareGateIssueCountDelta: ${payload.summary.overview.regressionsHistoryCompareGateIssueCountDelta ?? "(not available)"}`,
    `- regressionsHistoryCompareAddedGateFailingCount: ${payload.summary.overview.regressionsHistoryCompareAddedGateFailingCount ?? 0}`,
    `- regressionsHistoryCompareChangedToGateFailingCount: ${payload.summary.overview.regressionsHistoryCompareChangedToGateFailingCount ?? 0}`,
    `- regressionsHistoryCompareWorseningDetected: ${payload.summary.overview.regressionsHistoryCompareWorseningDetected ?? false}`,
    `- regressionsHistoryCompareWorseningSignalCount: ${payload.summary.overview.regressionsHistoryCompareWorseningSignalCount ?? 0}`,
    `- regressionsHistoryCompareUnstableCountDelta: ${payload.summary.overview.regressionsHistoryCompareUnstableCountDelta ?? "(not available)"}`,
    `- regressionCountDelta: ${payload.summary.overview.regressionCountDelta ?? "(not available)"}`,
    `- unstableSnapshots: ${payload.summary.overview.unstableSnapshotNames.join(", ") || "(none)"}`,
    `- addedSnapshots: ${payload.summary.overview.addedSnapshotNames.join(", ") || "(none)"}`,
    "",
    "## Next",
    "",
    `- reason: ${payload.summary.overview.next.reason}`,
    `- command: ${payload.summary.overview.next.command}`,
    "",
    "## Paths",
    "",
    `- latestRegressionsPath: ${payload.summary.paths.latestRegressionsPath}`,
    `- latestRegressionsHistoryPath: ${payload.summary.paths.latestRegressionsHistoryPath}`,
    `- latestRegressionsHistoryJsonPath: ${payload.summary.paths.latestRegressionsHistoryJsonPath}`,
    `- latestRegressionsHistoryGateFailingPath: ${payload.summary.paths.latestRegressionsHistoryGateFailingPath}`,
    `- latestRegressionsHistoryGateFailingJsonPath: ${payload.summary.paths.latestRegressionsHistoryGateFailingJsonPath}`,
    `- latestRegressionsHistoryGateFailingComparePath: ${payload.summary.paths.latestRegressionsHistoryGateFailingComparePath}`,
    `- latestRegressionsHistoryGateFailingCompareJsonPath: ${payload.summary.paths.latestRegressionsHistoryGateFailingCompareJsonPath}`,
    `- latestRegressionsHistoryGateFailingCompareCheckPath: ${payload.summary.paths.latestRegressionsHistoryGateFailingCompareCheckPath}`,
    `- latestRegressionsHistoryGateFailingCompareCheckJsonPath: ${payload.summary.paths.latestRegressionsHistoryGateFailingCompareCheckJsonPath}`,
    `- latestRegressionsHistoryComparePath: ${payload.summary.paths.latestRegressionsHistoryComparePath}`,
    `- latestRegressionsHistoryCompareJsonPath: ${payload.summary.paths.latestRegressionsHistoryCompareJsonPath}`,
    `- latestRegressionsHistoryCompareCheckPath: ${payload.summary.paths.latestRegressionsHistoryCompareCheckPath}`,
    `- latestRegressionsHistoryCompareCheckJsonPath: ${payload.summary.paths.latestRegressionsHistoryCompareCheckJsonPath}`,
    `- latestRegressionsComparePath: ${payload.summary.paths.latestRegressionsComparePath}`,
    `- latestRegressionsChangesPath: ${payload.summary.paths.latestRegressionsChangesPath}`,
    `- latestRegressionsIntegrityPath: ${payload.summary.paths.latestRegressionsIntegrityPath}`,
    `- latestRegressionsGatePath: ${payload.summary.paths.latestRegressionsGatePath}`,
    `- latestRegressionsGateJsonPath: ${payload.summary.paths.latestRegressionsGateJsonPath}`,
    `- latestRegressionsStatusPath: ${payload.summary.paths.latestRegressionsStatusPath}`,
    `- latestRegressionsOverviewPath: ${payload.summary.paths.latestRegressionsOverviewPath}`,
    `- latestRegressionsPlanPath: ${payload.summary.paths.latestRegressionsPlanPath}`,
    `- latestRegressionsNextPath: ${payload.summary.paths.latestRegressionsNextPath}`,
    `- historyPath: ${payload.summary.paths.historyPath}`,
    "",
    "## History Preview",
    "",
    payload.summary.historyPreview || "(history not available)",
    "",
    "## Plan",
    "",
    `- reason: ${payload.plan.reason}`,
    ...payload.plan.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Gate",
    "",
    `- hasRegressionsGate: ${payload.summary.overview.hasRegressionsGate ?? false}`,
    `- regressionsGateOk: ${payload.summary.overview.regressionsGateOk ?? "(not available)"}`,
    `- regressionsGateIssueCount: ${payload.summary.overview.regressionsGateIssueCount ?? 0}`,
    `- latestRegressionsGatePath: ${payload.summary.paths.latestRegressionsGatePath}`,
    `- latestRegressionsGateJsonPath: ${payload.summary.paths.latestRegressionsGateJsonPath}`,
    "",
    "## Doctor",
    "",
    `- ok: ${payload.doctor.ok}`,
    `- nextCommand: ${payload.doctor.nextCommand}`,
    ...(payload.doctor.issues.length === 0
      ? ["- issues: none"]
      : ["- issues:", ...payload.doctor.issues.map((issue) => `  - ${issue}`)]),
    "",
  ];
  return lines.join("\n");
}

const baseDir = getBaseDir();
const summary = runNodeJson(
  path.join(appDir, "scripts", "social-recovery-smoke-regressions-summary.mjs"),
  baseDir
);
const plan = runNodeJson(
  path.join(appDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
  baseDir
);
const doctor = runNodeJson(
  path.join(appDir, "scripts", "social-recovery-smoke-regressions-doctor.mjs"),
  baseDir
);

const payload = {
  baseDir,
  summary,
  plan,
  doctor,
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  process.stdout.write(`${renderReport(payload)}\n`);
}
