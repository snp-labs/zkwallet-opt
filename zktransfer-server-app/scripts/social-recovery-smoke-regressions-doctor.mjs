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
const regressionsCompare = readJsonIfExists(path.join(latestDir, "regressions-compare.json"));
const regressionsChanges = readJsonIfExists(path.join(latestDir, "regressions-changes.json"));
const regressionsIntegrity = readJsonIfExists(path.join(latestDir, "regressions-integrity.json"));

const issues = [];
if (!regressions) {
  issues.push("latest regressions.json is missing");
}
if (regressions && (regressions.regressionCount ?? 0) > 0 && !regressionsChanges) {
  issues.push("latest regressions-changes.json is missing while unstable snapshots exist");
}
if (regressions && (regressions.regressionCount ?? 0) > 0 && !regressionsCompare) {
  issues.push("latest regressions-compare.json is missing while unstable snapshots exist");
}
if (regressionsIntegrity && regressionsIntegrity.ok === false) {
  issues.push("latest regressions-integrity.json reports integrity issues");
}

const payload = {
  ok: issues.length === 0,
  baseDir,
  latestDir,
  regressionCount: regressions?.regressionCount ?? 0,
  hasRegressions: Boolean(regressions),
  hasRegressionsCompare: Boolean(regressionsCompare),
  hasRegressionsChanges: Boolean(regressionsChanges),
  hasRegressionsIntegrity: Boolean(regressionsIntegrity),
  regressionsIntegrityOk: regressionsIntegrity?.ok ?? null,
  issues,
  nextCommand: !regressions
    ? "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json"
    : regressionsChanges
    ? "npm run social-recovery:smoke:regressions:changes"
    : regressionsCompare
    ? "npm run social-recovery:smoke:regressions:compare"
    : "npm run social-recovery:smoke:regressions",
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const lines = [
    "# Social Recovery Smoke Regressions Doctor",
    "",
    `- ok: ${payload.ok}`,
    `- regressionCount: ${payload.regressionCount}`,
    `- hasRegressions: ${payload.hasRegressions}`,
    `- hasRegressionsCompare: ${payload.hasRegressionsCompare}`,
    `- hasRegressionsChanges: ${payload.hasRegressionsChanges}`,
    `- nextCommand: ${payload.nextCommand}`,
    "",
  ];
  if (issues.length === 0) {
    lines.push("- issues: none", "");
  } else {
    lines.push("- issues:");
    for (const issue of issues) {
      lines.push(`  - ${issue}`);
    }
    lines.push("");
  }
  process.stdout.write(lines.join("\n"));
}

if (!payload.ok) {
  process.exitCode = 1;
}
