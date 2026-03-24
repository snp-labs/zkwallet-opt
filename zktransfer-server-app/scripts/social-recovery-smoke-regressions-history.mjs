import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRegressionsHistoryPayload,
  renderRegressionsHistoryText,
} from "./social-recovery-smoke-regressions-history-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const unstableOnly = args.includes("--unstable-only");
const gateFailingOnly = args.includes("--gate-failing-only");

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

function getWindowSize() {
  const raw = process.env.SOCIAL_RECOVERY_SMOKE_REGRESSION_WINDOW || getArgValue("--window");
  const parsed = Number.parseInt(raw || "10", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 10;
  }
  return parsed;
}

const baseDir = getBaseDir();
const indexPath = path.join(baseDir, "snapshots", "index.json");

if (!fs.existsSync(indexPath)) {
  throw new Error(
    `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
  );
}

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const windowSize = getWindowSize();
const payload = {
  baseDir,
  indexPath,
  ...buildRegressionsHistoryPayload(index, windowSize, unstableOnly, gateFailingOnly),
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  process.stdout.write(renderRegressionsHistoryText(payload));
}
