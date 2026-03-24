import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRegressionsGatePayload,
  renderRegressionsGateText,
} from "./social-recovery-smoke-regressions-gate-core.mjs";

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

const payload = buildRegressionsGatePayload({
  baseDir,
  latestDir,
  regressionsPayload: readJsonIfExists(path.join(latestDir, "regressions.json")),
  regressionsIntegrityPayload: readJsonIfExists(path.join(latestDir, "regressions-integrity.json")),
  regressionsDoctorPayload: readJsonIfExists(path.join(latestDir, "regressions-doctor.json")),
  regressionsHistoryGateFailingCompareCheckPayload: readJsonIfExists(
    path.join(latestDir, "regressions-history-gate-failing-compare-check.json")
  ),
  regressionsHistoryCompareCheckPayload: readJsonIfExists(
    path.join(latestDir, "regressions-history-compare-check.json")
  ),
});

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  process.stdout.write(renderRegressionsGateText(payload));
}

if (!payload.ok) {
  process.exitCode = 1;
}
