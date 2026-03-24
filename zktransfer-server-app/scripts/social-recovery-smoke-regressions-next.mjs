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
  regressions,
  regressionsGate,
  regressionsHistory,
  regressionsHistoryGateFailingCompare,
  regressionsHistoryGateFailingCompareCheck,
  regressionsHistoryCompare,
  regressionsHistoryCompareCheck,
  regressionsCompare,
  regressionsChanges,
  regressionsIntegrity,
}) {
  if (!regressions) {
    return {
      reason: "No saved regression artifact exists yet.",
      command:
        "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    };
  }
  if (regressionsGate?.ok === false) {
    return {
      reason: "Saved regression gate is failing and should be reviewed first.",
      command: "npm run social-recovery:smoke:regressions:gate",
    };
  }
  if (regressionsIntegrity?.ok === false) {
    return {
      reason: "Saved regression integrity check is failing.",
      command: "npm run social-recovery:smoke:regressions:integrity",
    };
  }
  if ((regressions.regressionCount ?? 0) > 0 && regressionsChanges) {
    return {
      reason: "Saved regression bundle and regression delta are both available.",
      command: "npm run social-recovery:smoke:regressions:changes",
    };
  }
  if ((regressions.regressionCount ?? 0) > 0 && regressionsCompare) {
    return {
      reason: "Regression delta is available but combined regression changes are not.",
      command: "npm run social-recovery:smoke:regressions:compare",
    };
  }
  if (
    (regressions.regressionCount ?? 0) > 0 &&
    regressionsHistoryGateFailingCompareCheck?.ok === false
  ) {
    return {
      reason: "Saved gate-failing-only regression history compare check is already failing.",
      command: "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
    };
  }
  if (
    (regressions.regressionCount ?? 0) > 0 &&
    regressionsHistoryGateFailingCompare?.worseningDetected === true
  ) {
    return {
      reason: "Saved gate-failing-only regression history delta shows worsening gate failures.",
      command: "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
    };
  }
  if ((regressions.regressionCount ?? 0) > 0 && regressionsHistoryGateFailingCompare) {
    return {
      reason: "A saved gate-failing-only regression history delta exists.",
      command: "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
    };
  }
  if ((regressions.regressionCount ?? 0) > 0 && regressionsHistoryCompareCheck?.ok === false) {
    return {
      reason: "Saved regression history compare check is already failing on worsening behavior.",
      command: "npm run social-recovery:smoke:regressions:history:compare:check",
    };
  }
  if (
    (regressions.regressionCount ?? 0) > 0 &&
    regressionsHistoryCompare?.worseningDetected === true
  ) {
    return {
      reason: "Regression timeline delta shows new unstable behavior and should fail fast.",
      command: "npm run social-recovery:smoke:regressions:history:compare:check",
    };
  }
  if ((regressions.regressionCount ?? 0) > 0 && regressionsHistoryCompare) {
    return {
      reason: "Regression timeline delta is available even though regression diff artifacts are not.",
      command: "npm run social-recovery:smoke:regressions:history:compare",
    };
  }
  if ((regressionsHistory?.gateFailingCount ?? 0) > 0) {
    return {
      reason: "Saved regression timeline shows gate-failing snapshots even though diff artifacts are not available.",
      command: "npm run social-recovery:smoke:regressions:history:gate-failing",
    };
  }
  if ((regressions.regressionCount ?? 0) > 0 && regressionsHistory) {
    return {
      reason: "Regression timeline is available even though saved diff artifacts are not.",
      command: "npm run social-recovery:smoke:regressions:history:unstable",
    };
  }
  if ((regressions.regressionCount ?? 0) > 0) {
    return {
      reason: "Unstable snapshots were found in the latest saved regression window.",
      command: "npm run social-recovery:smoke:regressions",
    };
  }
  return {
    reason: "No regressions were found in the latest saved regression window.",
    command: "npm run social-recovery:smoke:regressions:latest",
  };
}

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const regressions = readJsonIfExists(path.join(latestDir, "regressions.json"));
const regressionsHistory = readJsonIfExists(path.join(latestDir, "regressions-history.json"));
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
const recommendation = getRecommendation({
  regressions,
  regressionsGate,
  regressionsHistory,
  regressionsHistoryGateFailingCompare,
  regressionsHistoryGateFailingCompareCheck,
  regressionsHistoryCompare,
  regressionsHistoryCompareCheck,
  regressionsCompare,
  regressionsChanges,
  regressionsIntegrity,
});
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
  regressionsHistoryGateFailingCount: regressionsHistory?.gateFailingCount ?? 0,
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
  regressionsHistoryGateFailingCompareWorseningDetected:
    regressionsHistoryGateFailingCompare?.worseningDetected === true,
  regressionsHistoryGateFailingCompareWorseningSignalCount:
    typeof regressionsHistoryGateFailingCompare?.worseningSignalCount === "number"
      ? regressionsHistoryGateFailingCompare.worseningSignalCount
      : 0,
  hasRegressionsHistoryCompare: Boolean(regressionsHistoryCompare),
  hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheck),
  regressionsHistoryCompareCheckOk:
    typeof regressionsHistoryCompareCheck?.ok === "boolean"
      ? regressionsHistoryCompareCheck.ok
      : null,
  hasRegressionsCompare: Boolean(regressionsCompare),
  hasRegressionsChanges: Boolean(regressionsChanges),
  hasRegressionsIntegrity: Boolean(regressionsIntegrity),
  regressionsIntegrityOk:
    typeof regressionsIntegrity?.ok === "boolean" ? regressionsIntegrity.ok : null,
  regressionsHistoryCompareWorseningDetected:
    regressionsHistoryCompare?.worseningDetected === true,
  regressionsHistoryCompareWorseningSignalCount:
    typeof regressionsHistoryCompare?.worseningSignalCount === "number"
      ? regressionsHistoryCompare.worseningSignalCount
      : 0,
  regressionCount: regressions?.regressionCount ?? 0,
  reason: recommendation.reason,
  command: recommendation.command,
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(recommendation.command);
}
