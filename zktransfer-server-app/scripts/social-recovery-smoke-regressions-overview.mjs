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

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getRecommendation({
  regressionCount,
  hasRegressionsGate,
  regressionsGateOk,
  regressionsHistoryGateFailingCount,
  hasRegressionsHistory,
  hasRegressionsHistoryGateFailingCompare,
  hasRegressionsHistoryGateFailingCompareCheck,
  regressionsHistoryGateFailingCompareCheckOk,
  regressionsHistoryGateFailingCompareWorseningDetected,
  hasRegressionsHistoryCompare,
  hasRegressionsHistoryCompareCheck,
  regressionsHistoryCompareCheckOk,
  regressionsHistoryCompareWorseningDetected,
  hasRegressionsCompare,
  hasRegressionsChanges,
  hasRegressionsIntegrity,
  regressionsIntegrityOk,
}) {
  if (hasRegressionsGate && regressionsGateOk === false) {
    return {
      reason: "Saved regression gate is failing and should be reviewed first.",
      command: "npm run social-recovery:smoke:regressions:gate",
    };
  }
  if (hasRegressionsIntegrity && regressionsIntegrityOk === false) {
    return {
      reason: "Saved regression integrity check is failing and should be reviewed first.",
      command: "npm run social-recovery:smoke:regressions:integrity",
    };
  }
  if (regressionCount > 0 && hasRegressionsChanges) {
    return {
      reason: "Regression bundle and delta are both available.",
      command: "npm run social-recovery:smoke:regressions:changes",
    };
  }
  if (regressionCount > 0 && hasRegressionsCompare) {
    return {
      reason: "Regression delta is available for unstable snapshots.",
      command: "npm run social-recovery:smoke:regressions:compare",
    };
  }
  if (
    regressionCount > 0 &&
    hasRegressionsHistoryGateFailingCompareCheck &&
    regressionsHistoryGateFailingCompareCheckOk === false
  ) {
    return {
      reason: "Saved gate-failing-only regression history compare check is already failing.",
      command: "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
    };
  }
  if (regressionCount > 0 && regressionsHistoryGateFailingCompareWorseningDetected) {
    return {
      reason: "Saved gate-failing-only regression history delta already shows worsening gate failures.",
      command: "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
    };
  }
  if (regressionCount > 0 && hasRegressionsHistoryGateFailingCompare) {
    return {
      reason: "Saved gate-failing-only regression timeline delta exists even though regression diff artifacts are not.",
      command: "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
    };
  }
  if (
    regressionCount > 0 &&
    hasRegressionsHistoryCompareCheck &&
    regressionsHistoryCompareCheckOk === false
  ) {
    return {
      reason: "Saved regression history compare check is already failing on worsening behavior.",
      command: "npm run social-recovery:smoke:regressions:history:compare:check",
    };
  }
  if (regressionCount > 0 && regressionsHistoryCompareWorseningDetected) {
    return {
      reason: "Regression timeline delta already shows worsening unstable behavior.",
      command: "npm run social-recovery:smoke:regressions:history:compare:check",
    };
  }
  if (regressionCount > 0 && hasRegressionsHistoryCompare) {
    return {
      reason: "Regression timeline delta is available even though regression diff artifacts are not.",
      command: "npm run social-recovery:smoke:regressions:history:compare",
    };
  }
  if (regressionsHistoryGateFailingCount > 0 && hasRegressionsHistory) {
    return {
      reason: "Saved regression timeline shows gate-failing snapshots even though regression diff artifacts are not.",
      command: "npm run social-recovery:smoke:regressions:history:gate-failing",
    };
  }
  if (regressionCount > 0 && hasRegressionsHistory) {
    return {
      reason: "Regression timeline is available even though saved diff artifacts are not.",
      command: "npm run social-recovery:smoke:regressions:history:unstable",
    };
  }
  if (regressionCount > 0) {
    return {
      reason: "Unstable snapshots exist but only the raw regression list is available.",
      command: "npm run social-recovery:smoke:regressions",
    };
  }
  return {
    reason: "No unstable snapshots were found in the saved regression window.",
    command: "npm run social-recovery:smoke:regressions:latest",
  };
}

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const regressions = readJsonIfExists(path.join(latestDir, "regressions.json"));
const regressionsHistory = readJsonIfExists(path.join(latestDir, "regressions-history.json"));
const regressionsHistoryGateFailing = readJsonIfExists(
  path.join(latestDir, "regressions-history-gate-failing.json")
);
const regressionsHistoryGateFailingCompare = readJsonIfExists(
  path.join(latestDir, "regressions-history-gate-failing-compare.json")
);
const regressionsHistoryGateFailingCompareCheck = readJsonIfExists(
  path.join(latestDir, "regressions-history-gate-failing-compare-check.json")
);
const regressionsHistoryCompare = readJsonIfExists(
  path.join(latestDir, "regressions-history-compare.json")
);
const regressionsHistoryCompareCheck = readJsonIfExists(
  path.join(latestDir, "regressions-history-compare-check.json")
);
const regressionsCompare = readJsonIfExists(path.join(latestDir, "regressions-compare.json"));
const regressionsChanges = readJsonIfExists(path.join(latestDir, "regressions-changes.json"));
const regressionsIntegrity = readJsonIfExists(
  path.join(latestDir, "regressions-integrity.json")
);
const regressionsGate = readJsonIfExists(path.join(latestDir, "regressions-gate.json"));

const payload = {
  baseDir,
  latestDir,
  regressionCount: regressions?.regressionCount ?? 0,
  windowSize: regressions?.windowSize ?? null,
  hasRegressions: Boolean(regressions),
  hasRegressionsGate: Boolean(regressionsGate),
  regressionsGateOk:
    typeof regressionsGate?.ok === "boolean" ? regressionsGate.ok : null,
  regressionsGateIssueCount:
    typeof regressionsGate?.issueCount === "number"
      ? regressionsGate.issueCount
      : Array.isArray(regressionsGate?.issues)
      ? regressionsGate.issues.length
      : 0,
  hasRegressionsHistory: Boolean(regressionsHistory),
  hasRegressionsHistoryGateFailing: Boolean(regressionsHistoryGateFailing),
  hasRegressionsHistoryGateFailingCompare: Boolean(regressionsHistoryGateFailingCompare),
  hasRegressionsHistoryGateFailingCompareCheck: Boolean(
    regressionsHistoryGateFailingCompareCheck
  ),
  regressionsHistoryGateFailingCompareCheckOk:
    typeof regressionsHistoryGateFailingCompareCheck?.ok === "boolean"
      ? regressionsHistoryGateFailingCompareCheck.ok
      : null,
  regressionsHistoryGateFailingCompareCheckIssueCount:
    typeof regressionsHistoryGateFailingCompareCheck?.issueCount === "number"
      ? regressionsHistoryGateFailingCompareCheck.issueCount
      : Array.isArray(regressionsHistoryGateFailingCompareCheck?.issues)
      ? regressionsHistoryGateFailingCompareCheck.issues.length
      : 0,
  hasRegressionsHistoryCompare: Boolean(regressionsHistoryCompare),
  hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheck),
  regressionsHistoryCompareCheckOk:
    typeof regressionsHistoryCompareCheck?.ok === "boolean"
      ? regressionsHistoryCompareCheck.ok
      : null,
  regressionsHistoryCompareCheckIssueCount:
    typeof regressionsHistoryCompareCheck?.issueCount === "number"
      ? regressionsHistoryCompareCheck.issueCount
      : Array.isArray(regressionsHistoryCompareCheck?.issues)
      ? regressionsHistoryCompareCheck.issues.length
      : 0,
  hasRegressionsCompare: Boolean(regressionsCompare),
  hasRegressionsChanges: Boolean(regressionsChanges),
  hasRegressionsIntegrity: Boolean(regressionsIntegrity),
  regressionsIntegrityOk:
    typeof regressionsIntegrity?.ok === "boolean" ? regressionsIntegrity.ok : null,
  regressionsIntegrityIssueCount: Array.isArray(regressionsIntegrity?.issues)
    ? regressionsIntegrity.issues.length
    : 0,
  regressionsHistorySnapshotCount: regressionsHistory?.snapshotCount ?? 0,
  regressionsHistoryUnstableCount: regressionsHistory?.unstableCount ?? 0,
  regressionsHistoryGateFailingCount: regressionsHistory?.gateFailingCount ?? 0,
  regressionsHistoryGateFailingSnapshotCount:
    regressionsHistoryGateFailing?.snapshotCount ?? 0,
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
  regressionsHistoryGateFailingCompareGateFailingCountDelta:
    typeof regressionsHistoryGateFailingCompare?.gateFailingCountDelta === "number"
      ? regressionsHistoryGateFailingCompare.gateFailingCountDelta
      : null,
  regressionsHistoryGateFailingCompareGateIssueCountDelta:
    typeof regressionsHistoryGateFailingCompare?.gateIssueCountDelta === "number"
      ? regressionsHistoryGateFailingCompare.gateIssueCountDelta
      : null,
  regressionsHistoryGateFailingCompareAddedGateFailingCount: Array.isArray(
    regressionsHistoryGateFailingCompare?.addedGateFailingSnapshotNames
  )
    ? regressionsHistoryGateFailingCompare.addedGateFailingSnapshotNames.length
    : 0,
  regressionsHistoryGateFailingCompareChangedToGateFailingCount: Array.isArray(
    regressionsHistoryGateFailingCompare?.changedToGateFailingNames
  )
    ? regressionsHistoryGateFailingCompare.changedToGateFailingNames.length
    : 0,
  regressionsHistoryGateFailingCompareWorseningDetected:
    regressionsHistoryGateFailingCompare?.worseningDetected === true,
  regressionsHistoryGateFailingCompareWorseningSignalCount:
    typeof regressionsHistoryGateFailingCompare?.worseningSignalCount === "number"
      ? regressionsHistoryGateFailingCompare.worseningSignalCount
      : 0,
  regressionsHistoryCompareChangedStatusCount: Array.isArray(
    regressionsHistoryCompare?.changedStatuses
  )
    ? regressionsHistoryCompare.changedStatuses.length
    : 0,
  regressionsHistoryCompareAddedUnstableCount: Array.isArray(
    regressionsHistoryCompare?.addedUnstableSnapshotNames
  )
    ? regressionsHistoryCompare.addedUnstableSnapshotNames.length
    : 0,
  regressionsHistoryCompareChangedToUnstableCount: Array.isArray(
    regressionsHistoryCompare?.changedToUnstableNames
  )
    ? regressionsHistoryCompare.changedToUnstableNames.length
    : 0,
  regressionsHistoryCompareGateFailingCountDelta:
    typeof regressionsHistoryCompare?.gateFailingCountDelta === "number"
      ? regressionsHistoryCompare.gateFailingCountDelta
      : null,
  regressionsHistoryCompareGateIssueCountDelta:
    typeof regressionsHistoryCompare?.gateIssueCountDelta === "number"
      ? regressionsHistoryCompare.gateIssueCountDelta
      : null,
  regressionsHistoryCompareAddedGateFailingCount: Array.isArray(
    regressionsHistoryCompare?.addedGateFailingSnapshotNames
  )
    ? regressionsHistoryCompare.addedGateFailingSnapshotNames.length
    : 0,
  regressionsHistoryCompareChangedToGateFailingCount: Array.isArray(
    regressionsHistoryCompare?.changedToGateFailingNames
  )
    ? regressionsHistoryCompare.changedToGateFailingNames.length
    : 0,
  regressionsHistoryCompareWorseningDetected:
    regressionsHistoryCompare?.worseningDetected === true,
  regressionsHistoryCompareWorseningSignalCount:
    typeof regressionsHistoryCompare?.worseningSignalCount === "number"
      ? regressionsHistoryCompare.worseningSignalCount
      : 0,
  regressionsHistoryCompareUnstableCountDelta:
    typeof regressionsHistoryCompare?.unstableCountDelta === "number"
      ? regressionsHistoryCompare.unstableCountDelta
      : null,
  regressionCountDelta:
    typeof regressionsCompare?.regressionCountDelta === "number"
      ? regressionsCompare.regressionCountDelta
      : null,
  addedSnapshotNames: Array.isArray(regressionsCompare?.addedSnapshotNames)
    ? regressionsCompare.addedSnapshotNames
    : [],
  unstableSnapshotNames: Array.isArray(regressions?.regressions)
    ? regressions.regressions.map((entry) => entry.name).filter(Boolean)
    : [],
};

payload.next = getRecommendation({
  regressionCount: payload.regressionCount,
  hasRegressionsGate: payload.hasRegressionsGate,
  regressionsGateOk: payload.regressionsGateOk,
  regressionsHistoryGateFailingCount: payload.regressionsHistoryGateFailingCount,
  hasRegressionsHistory: payload.hasRegressionsHistory,
  hasRegressionsHistoryGateFailingCompare: payload.hasRegressionsHistoryGateFailingCompare,
  hasRegressionsHistoryGateFailingCompareCheck:
    payload.hasRegressionsHistoryGateFailingCompareCheck,
  regressionsHistoryGateFailingCompareCheckOk:
    payload.regressionsHistoryGateFailingCompareCheckOk,
  regressionsHistoryGateFailingCompareWorseningDetected:
    payload.regressionsHistoryGateFailingCompareWorseningDetected,
  hasRegressionsHistoryCompare: payload.hasRegressionsHistoryCompare,
  hasRegressionsHistoryCompareCheck: payload.hasRegressionsHistoryCompareCheck,
  regressionsHistoryCompareCheckOk: payload.regressionsHistoryCompareCheckOk,
  regressionsHistoryCompareWorseningDetected:
    payload.regressionsHistoryCompareWorseningDetected,
  hasRegressionsCompare: payload.hasRegressionsCompare,
  hasRegressionsChanges: payload.hasRegressionsChanges,
  hasRegressionsIntegrity: payload.hasRegressionsIntegrity,
  regressionsIntegrityOk: payload.regressionsIntegrityOk,
});

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const lines = [
    "# Social Recovery Smoke Regressions Overview",
    "",
    `- baseDir: ${payload.baseDir}`,
    `- regressionCount: ${payload.regressionCount}`,
    `- windowSize: ${payload.windowSize ?? "(not available)"}`,
    `- hasRegressions: ${payload.hasRegressions}`,
    `- hasRegressionsGate: ${payload.hasRegressionsGate}`,
    `- regressionsGateOk: ${payload.regressionsGateOk ?? "(not available)"}`,
    `- regressionsGateIssueCount: ${payload.regressionsGateIssueCount}`,
    `- hasRegressionsHistory: ${payload.hasRegressionsHistory}`,
    `- hasRegressionsHistoryGateFailing: ${payload.hasRegressionsHistoryGateFailing}`,
    `- hasRegressionsHistoryGateFailingCompare: ${payload.hasRegressionsHistoryGateFailingCompare}`,
    `- hasRegressionsHistoryGateFailingCompareCheck: ${payload.hasRegressionsHistoryGateFailingCompareCheck}`,
    `- regressionsHistoryGateFailingCompareCheckOk: ${payload.regressionsHistoryGateFailingCompareCheckOk ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareCheckIssueCount: ${payload.regressionsHistoryGateFailingCompareCheckIssueCount}`,
    `- hasRegressionsHistoryCompare: ${payload.hasRegressionsHistoryCompare}`,
    `- hasRegressionsHistoryCompareCheck: ${payload.hasRegressionsHistoryCompareCheck}`,
    `- hasRegressionsCompare: ${payload.hasRegressionsCompare}`,
    `- hasRegressionsChanges: ${payload.hasRegressionsChanges}`,
    `- hasRegressionsIntegrity: ${payload.hasRegressionsIntegrity}`,
    `- regressionsHistoryCompareCheckOk: ${payload.regressionsHistoryCompareCheckOk ?? "(not available)"}`,
    `- regressionsHistoryCompareCheckIssueCount: ${payload.regressionsHistoryCompareCheckIssueCount}`,
    `- regressionsIntegrityOk: ${payload.regressionsIntegrityOk ?? "(not available)"}`,
    `- regressionsIntegrityIssueCount: ${payload.regressionsIntegrityIssueCount}`,
    `- regressionsHistorySnapshotCount: ${payload.regressionsHistorySnapshotCount}`,
    `- regressionsHistoryUnstableCount: ${payload.regressionsHistoryUnstableCount}`,
    `- regressionsHistoryGateFailingCount: ${payload.regressionsHistoryGateFailingCount}`,
    `- regressionsHistoryGateFailingSnapshotCount: ${payload.regressionsHistoryGateFailingSnapshotCount}`,
    `- latestRegressionsHistoryGateFailingPath: ${payload.latestRegressionsHistoryGateFailingPath}`,
    `- latestRegressionsHistoryGateFailingJsonPath: ${payload.latestRegressionsHistoryGateFailingJsonPath}`,
    `- latestRegressionsHistoryGateFailingComparePath: ${payload.latestRegressionsHistoryGateFailingComparePath}`,
    `- latestRegressionsHistoryGateFailingCompareJsonPath: ${payload.latestRegressionsHistoryGateFailingCompareJsonPath}`,
    `- latestRegressionsHistoryGateFailingCompareCheckPath: ${payload.latestRegressionsHistoryGateFailingCompareCheckPath}`,
    `- latestRegressionsHistoryGateFailingCompareCheckJsonPath: ${payload.latestRegressionsHistoryGateFailingCompareCheckJsonPath}`,
    `- regressionsHistoryGateFailingCompareGateFailingCountDelta: ${payload.regressionsHistoryGateFailingCompareGateFailingCountDelta ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareGateIssueCountDelta: ${payload.regressionsHistoryGateFailingCompareGateIssueCountDelta ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareAddedGateFailingCount: ${payload.regressionsHistoryGateFailingCompareAddedGateFailingCount}`,
    `- regressionsHistoryGateFailingCompareChangedToGateFailingCount: ${payload.regressionsHistoryGateFailingCompareChangedToGateFailingCount}`,
    `- regressionsHistoryGateFailingCompareWorseningDetected: ${payload.regressionsHistoryGateFailingCompareWorseningDetected}`,
    `- regressionsHistoryGateFailingCompareWorseningSignalCount: ${payload.regressionsHistoryGateFailingCompareWorseningSignalCount}`,
    `- regressionsHistoryCompareChangedStatusCount: ${payload.regressionsHistoryCompareChangedStatusCount}`,
    `- regressionsHistoryCompareAddedUnstableCount: ${payload.regressionsHistoryCompareAddedUnstableCount}`,
    `- regressionsHistoryCompareChangedToUnstableCount: ${payload.regressionsHistoryCompareChangedToUnstableCount}`,
    `- regressionsHistoryCompareGateFailingCountDelta: ${payload.regressionsHistoryCompareGateFailingCountDelta ?? "(not available)"}`,
    `- regressionsHistoryCompareGateIssueCountDelta: ${payload.regressionsHistoryCompareGateIssueCountDelta ?? "(not available)"}`,
    `- regressionsHistoryCompareAddedGateFailingCount: ${payload.regressionsHistoryCompareAddedGateFailingCount}`,
    `- regressionsHistoryCompareChangedToGateFailingCount: ${payload.regressionsHistoryCompareChangedToGateFailingCount}`,
    `- regressionsHistoryCompareWorseningDetected: ${payload.regressionsHistoryCompareWorseningDetected}`,
    `- regressionsHistoryCompareWorseningSignalCount: ${payload.regressionsHistoryCompareWorseningSignalCount}`,
    `- regressionsHistoryCompareUnstableCountDelta: ${payload.regressionsHistoryCompareUnstableCountDelta ?? "(not available)"}`,
    `- regressionCountDelta: ${payload.regressionCountDelta ?? "(not available)"}`,
    `- unstableSnapshots: ${payload.unstableSnapshotNames.join(", ") || "(none)"}`,
    `- addedSnapshots: ${payload.addedSnapshotNames.join(", ") || "(none)"}`,
    "",
    "## Next",
    "",
    `- reason: ${payload.next.reason}`,
    `- command: ${payload.next.command}`,
    "",
  ];
  process.stdout.write(lines.join("\n"));
}
