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

function getSuggestedCommands({
  hasRegressions,
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
  regressionCount,
}) {
  if (!hasRegressions) {
    return [
      "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    ];
  }

  if (hasRegressionsGate && regressionsGateOk === false) {
    return [
      "npm run social-recovery:smoke:regressions:gate",
      "npm run social-recovery:smoke:regressions:report",
    ];
  }

  if (hasRegressionsIntegrity && regressionsIntegrityOk === false) {
    return [
      "npm run social-recovery:smoke:regressions:integrity",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  }

  if (regressionCount > 0 && hasRegressionsChanges) {
    return [
      "npm run social-recovery:smoke:regressions:changes",
      "npm run social-recovery:smoke:regressions:compare",
      "npm run social-recovery:smoke:regressions",
    ];
  }

  if (regressionCount > 0 && hasRegressionsCompare) {
    return [
      "npm run social-recovery:smoke:regressions:compare",
      "npm run social-recovery:smoke:regressions",
    ];
  }

  if (
    regressionCount > 0 &&
    hasRegressionsHistoryGateFailingCompareCheck &&
    regressionsHistoryGateFailingCompareCheckOk === false
  ) {
    return [
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
      "npm run social-recovery:smoke:regressions:history:gate-failing",
    ];
  }

  if (
    regressionCount > 0 &&
    hasRegressionsHistoryGateFailingCompare &&
    regressionsHistoryGateFailingCompareWorseningDetected
  ) {
    return [
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
      "npm run social-recovery:smoke:regressions:history:gate-failing",
    ];
  }

  if (regressionCount > 0 && hasRegressionsHistoryGateFailingCompare) {
    return [
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
      "npm run social-recovery:smoke:regressions:history:gate-failing",
    ];
  }

  if (
    regressionCount > 0 &&
    hasRegressionsHistoryCompareCheck &&
    regressionsHistoryCompareCheckOk === false
  ) {
    return [
      "npm run social-recovery:smoke:regressions:history:compare:check",
      "npm run social-recovery:smoke:regressions:history:compare",
      "npm run social-recovery:smoke:regressions:history:unstable",
    ];
  }

  if (
    regressionCount > 0 &&
    hasRegressionsHistoryCompare &&
    regressionsHistoryCompareWorseningDetected
  ) {
    return [
      "npm run social-recovery:smoke:regressions:history:compare:check",
      "npm run social-recovery:smoke:regressions:history:compare",
      "npm run social-recovery:smoke:regressions:history:unstable",
    ];
  }

  if (regressionCount > 0 && hasRegressionsHistoryCompare) {
    return [
      "npm run social-recovery:smoke:regressions:history:compare",
      "npm run social-recovery:smoke:regressions:history:unstable",
    ];
  }

  if (regressionsHistoryGateFailingCount > 0 && hasRegressionsHistory) {
    return [
      "npm run social-recovery:smoke:regressions:history:gate-failing",
      "npm run social-recovery:smoke:regressions:history",
    ];
  }

  if (regressionCount > 0 && hasRegressionsHistory) {
    return [
      "npm run social-recovery:smoke:regressions:history:unstable",
      "npm run social-recovery:smoke:regressions",
    ];
  }

  if (regressionCount > 0) {
    return ["npm run social-recovery:smoke:regressions"];
  }

  return ["npm run social-recovery:smoke:regressions:latest"];
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
  regressionCount: regressions?.regressionCount ?? 0,
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
  suggestedCommands: getSuggestedCommands({
    hasRegressions: Boolean(regressions),
    hasRegressionsGate: Boolean(regressionsGate),
    regressionsGateOk:
      typeof regressionsGate?.ok === "boolean" ? regressionsGate.ok : null,
    regressionsHistoryGateFailingCount: regressionsHistory?.gateFailingCount ?? 0,
    hasRegressionsHistory: Boolean(regressionsHistory),
    hasRegressionsHistoryGateFailingCompare: Boolean(regressionsHistoryGateFailingCompare),
    hasRegressionsHistoryGateFailingCompareCheck: Boolean(
      regressionsHistoryGateFailingCompareCheck
    ),
    regressionsHistoryGateFailingCompareCheckOk:
      typeof regressionsHistoryGateFailingCompareCheck?.ok === "boolean"
        ? regressionsHistoryGateFailingCompareCheck.ok
        : null,
    regressionsHistoryGateFailingCompareWorseningDetected:
      regressionsHistoryGateFailingCompare?.worseningDetected === true,
    hasRegressionsHistoryCompare: Boolean(regressionsHistoryCompare),
    hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheck),
    regressionsHistoryCompareCheckOk:
      typeof regressionsHistoryCompareCheck?.ok === "boolean"
        ? regressionsHistoryCompareCheck.ok
        : null,
    regressionsHistoryCompareWorseningDetected:
      regressionsHistoryCompare?.worseningDetected === true,
    hasRegressionsCompare: Boolean(regressionsCompare),
    hasRegressionsChanges: Boolean(regressionsChanges),
    hasRegressionsIntegrity: Boolean(regressionsIntegrity),
    regressionsIntegrityOk:
      typeof regressionsIntegrity?.ok === "boolean" ? regressionsIntegrity.ok : null,
    regressionCount: regressions?.regressionCount ?? 0,
  }),
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("# Social Recovery Smoke Regressions Status");
  console.log("");
  console.log(`- baseDir: ${payload.baseDir}`);
  console.log(`- hasRegressions: ${payload.hasRegressions}`);
  console.log(`- hasRegressionsGate: ${payload.hasRegressionsGate}`);
  console.log(`- regressionsGateOk: ${payload.regressionsGateOk ?? "(not available)"}`);
  console.log(`- regressionsGateIssueCount: ${payload.regressionsGateIssueCount}`);
  console.log(`- hasRegressionsHistory: ${payload.hasRegressionsHistory}`);
  console.log(
    `- hasRegressionsHistoryGateFailing: ${payload.hasRegressionsHistoryGateFailing}`
  );
  console.log(
    `- hasRegressionsHistoryGateFailingCompare: ${payload.hasRegressionsHistoryGateFailingCompare}`
  );
  console.log(
    `- hasRegressionsHistoryGateFailingCompareCheck: ${payload.hasRegressionsHistoryGateFailingCompareCheck}`
  );
  console.log(
    `- regressionsHistoryGateFailingCompareCheckOk: ${payload.regressionsHistoryGateFailingCompareCheckOk ?? "(not available)"}`
  );
  console.log(
    `- regressionsHistoryGateFailingCompareCheckIssueCount: ${payload.regressionsHistoryGateFailingCompareCheckIssueCount}`
  );
  console.log(`- hasRegressionsHistoryCompare: ${payload.hasRegressionsHistoryCompare}`);
  console.log(
    `- hasRegressionsHistoryCompareCheck: ${payload.hasRegressionsHistoryCompareCheck}`
  );
  console.log(
    `- regressionsHistoryCompareCheckOk: ${payload.regressionsHistoryCompareCheckOk ?? "(not available)"}`
  );
  console.log(
    `- regressionsHistoryCompareCheckIssueCount: ${payload.regressionsHistoryCompareCheckIssueCount}`
  );
  console.log(`- hasRegressionsCompare: ${payload.hasRegressionsCompare}`);
  console.log(`- hasRegressionsChanges: ${payload.hasRegressionsChanges}`);
  console.log(`- hasRegressionsIntegrity: ${payload.hasRegressionsIntegrity}`);
  console.log(
    `- regressionsIntegrityOk: ${payload.regressionsIntegrityOk ?? "(not available)"}`
  );
  console.log(`- regressionsIntegrityIssueCount: ${payload.regressionsIntegrityIssueCount}`);
  console.log(`- regressionCount: ${payload.regressionCount}`);
  console.log(`- regressionsHistorySnapshotCount: ${payload.regressionsHistorySnapshotCount}`);
  console.log(`- regressionsHistoryUnstableCount: ${payload.regressionsHistoryUnstableCount}`);
  console.log(`- regressionsHistoryGateFailingCount: ${payload.regressionsHistoryGateFailingCount}`);
  console.log(
    `- regressionsHistoryGateFailingSnapshotCount: ${payload.regressionsHistoryGateFailingSnapshotCount}`
  );
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
  console.log(
    `- regressionsHistoryGateFailingCompareGateFailingCountDelta: ${payload.regressionsHistoryGateFailingCompareGateFailingCountDelta ?? "(not available)"}`
  );
  console.log(
    `- regressionsHistoryGateFailingCompareGateIssueCountDelta: ${payload.regressionsHistoryGateFailingCompareGateIssueCountDelta ?? "(not available)"}`
  );
  console.log(
    `- regressionsHistoryGateFailingCompareAddedGateFailingCount: ${payload.regressionsHistoryGateFailingCompareAddedGateFailingCount}`
  );
  console.log(
    `- regressionsHistoryGateFailingCompareChangedToGateFailingCount: ${payload.regressionsHistoryGateFailingCompareChangedToGateFailingCount}`
  );
  console.log(
    `- regressionsHistoryGateFailingCompareWorseningDetected: ${payload.regressionsHistoryGateFailingCompareWorseningDetected}`
  );
  console.log(
    `- regressionsHistoryGateFailingCompareWorseningSignalCount: ${payload.regressionsHistoryGateFailingCompareWorseningSignalCount}`
  );
  console.log(
    `- regressionsHistoryCompareChangedStatusCount: ${payload.regressionsHistoryCompareChangedStatusCount}`
  );
  console.log(
    `- regressionsHistoryCompareAddedUnstableCount: ${payload.regressionsHistoryCompareAddedUnstableCount}`
  );
  console.log(
    `- regressionsHistoryCompareChangedToUnstableCount: ${payload.regressionsHistoryCompareChangedToUnstableCount}`
  );
  console.log(
    `- regressionsHistoryCompareGateFailingCountDelta: ${payload.regressionsHistoryCompareGateFailingCountDelta ?? "(not available)"}`
  );
  console.log(
    `- regressionsHistoryCompareGateIssueCountDelta: ${payload.regressionsHistoryCompareGateIssueCountDelta ?? "(not available)"}`
  );
  console.log(
    `- regressionsHistoryCompareAddedGateFailingCount: ${payload.regressionsHistoryCompareAddedGateFailingCount}`
  );
  console.log(
    `- regressionsHistoryCompareChangedToGateFailingCount: ${payload.regressionsHistoryCompareChangedToGateFailingCount}`
  );
  console.log(
    `- regressionsHistoryCompareWorseningDetected: ${payload.regressionsHistoryCompareWorseningDetected}`
  );
  console.log(
    `- regressionsHistoryCompareWorseningSignalCount: ${payload.regressionsHistoryCompareWorseningSignalCount}`
  );
  console.log(
    `- regressionsHistoryCompareUnstableCountDelta: ${payload.regressionsHistoryCompareUnstableCountDelta ?? "(not available)"}`
  );
  console.log(`- regressionCountDelta: ${payload.regressionCountDelta ?? "(not available)"}`);
  console.log(`- addedSnapshotNames: ${payload.addedSnapshotNames.join(", ") || "(none)"}`);
  console.log("");
  console.log("Recommended next commands:");
  for (const command of payload.suggestedCommands) {
    console.log(`- ${command}`);
  }
}
