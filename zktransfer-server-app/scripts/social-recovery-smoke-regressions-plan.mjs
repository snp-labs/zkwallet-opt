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
const regressionsHistoryCompareWorseningDetected =
  regressionsHistoryCompare?.worseningDetected === true;

let reason;
let steps;

if (!regressions) {
  reason = "No saved regression artifacts exist yet.";
  steps = [
    "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    "npm run social-recovery:smoke:regressions:status",
  ];
} else if (regressionsGate?.ok === false) {
  reason = "Saved regression gate is failing and should be reviewed before lower-level artifacts.";
  steps = [
    "npm run social-recovery:smoke:regressions:gate",
    "npm run social-recovery:smoke:regressions:report",
  ];
} else if (regressionsIntegrity?.ok === false) {
  reason = "Saved regression integrity is failing and should be fixed before diff review.";
  steps = [
    "npm run social-recovery:smoke:regressions:integrity",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressions.regressionCount ?? 0) > 0 && regressionsChanges) {
  reason = "Combined regression diff is available for unstable snapshots.";
  steps = [
    "npm run social-recovery:smoke:regressions:changes",
    "npm run social-recovery:smoke:regressions:overview",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressions.regressionCount ?? 0) > 0 && regressionsCompare) {
  reason = "Regression delta exists, but combined regression changes do not.";
  steps = [
    "npm run social-recovery:smoke:regressions:compare",
    "npm run social-recovery:smoke:regressions",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if (
  (regressions.regressionCount ?? 0) > 0 &&
  regressionsHistoryGateFailingCompareCheck?.ok === false
) {
  reason = "A saved gate-failing-only history compare check already shows worsening gate failures.";
  steps = [
    "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
    "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if (
  (regressions.regressionCount ?? 0) > 0 &&
  regressionsHistoryGateFailingCompare?.worseningDetected === true
) {
  reason = "The saved gate-failing-only history delta already shows worsening gate failures.";
  steps = [
    "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
    "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressions.regressionCount ?? 0) > 0 && regressionsHistoryGateFailingCompare) {
  reason = "A saved gate-failing-only regression timeline delta exists.";
  steps = [
    "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
    "npm run social-recovery:smoke:regressions:history:gate-failing",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressions.regressionCount ?? 0) > 0 && regressionsHistoryCompareCheck?.ok === false) {
  reason = "A saved history-compare check already shows worsening unstable behavior.";
  steps = [
    "npm run social-recovery:smoke:regressions:history:compare:check",
    "npm run social-recovery:smoke:regressions:history:compare",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressions.regressionCount ?? 0) > 0 && regressionsHistoryCompareWorseningDetected) {
  reason = "The saved regression timeline delta already shows worsening unstable behavior.";
  steps = [
    "npm run social-recovery:smoke:regressions:history:compare:check",
    "npm run social-recovery:smoke:regressions:history:compare",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressions.regressionCount ?? 0) > 0 && regressionsHistoryCompare) {
  reason = "A saved regression timeline delta exists even though regression diff artifacts do not.";
  steps = [
    "npm run social-recovery:smoke:regressions:history:compare",
    "npm run social-recovery:smoke:regressions:history:unstable",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressionsHistory?.gateFailingCount ?? 0) > 0) {
  reason = "A saved regression timeline shows gate-failing snapshots even though diff artifacts do not.";
  steps = [
    "npm run social-recovery:smoke:regressions:history:gate-failing",
    "npm run social-recovery:smoke:regressions:history",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressions.regressionCount ?? 0) > 0 && regressionsHistory) {
  reason = "A saved regression timeline exists even though diff artifacts do not.";
  steps = [
    "npm run social-recovery:smoke:regressions:history:unstable",
    "npm run social-recovery:smoke:regressions",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else if ((regressions.regressionCount ?? 0) > 0) {
  reason = "Only the raw regression list is available for unstable snapshots.";
  steps = [
    "npm run social-recovery:smoke:regressions",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
} else {
  reason = "No unstable snapshots are present in the saved regression window.";
  steps = [
    "npm run social-recovery:smoke:regressions:latest",
    "npm run social-recovery:smoke:regressions:doctor",
  ];
}

const payload = {
  baseDir,
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
  regressionsHistoryGateFailingCompareWorseningDetected:
    regressionsHistoryGateFailingCompare?.worseningDetected === true,
  hasRegressionsHistoryCompare: Boolean(regressionsHistoryCompare),
  hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheck),
  hasRegressionsCompare: Boolean(regressionsCompare),
  hasRegressionsChanges: Boolean(regressionsChanges),
  hasRegressionsIntegrity: Boolean(regressionsIntegrity),
  regressionsIntegrityOk:
    typeof regressionsIntegrity?.ok === "boolean" ? regressionsIntegrity.ok : null,
  regressionsHistoryCompareCheckOk:
    typeof regressionsHistoryCompareCheck?.ok === "boolean"
      ? regressionsHistoryCompareCheck.ok
      : null,
  regressionsHistoryCompareWorseningDetected,
  regressionCount: regressions?.regressionCount ?? 0,
  reason,
  steps,
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const lines = ["# Social Recovery Smoke Regressions Plan", "", `- reason: ${reason}`, ""];
  steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  lines.push("");
  process.stdout.write(lines.join("\n"));
}
