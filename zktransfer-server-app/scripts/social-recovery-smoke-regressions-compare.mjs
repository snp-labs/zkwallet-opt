import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRegressionsComparisonPayload,
  renderRegressionsComparisonText,
} from "./social-recovery-smoke-regressions-compare-core.mjs";

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const baseDir = getBaseDir();
const indexPath = path.join(baseDir, "snapshots", "index.json");

if (!fs.existsSync(indexPath)) {
  throw new Error(
    `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
  );
}

const index = readJson(indexPath);
if (index.snapshots.length < 2) {
  throw new Error("Need at least two smoke export snapshots to compare regressions.");
}

const latest = index.snapshots[0];
const previous = index.snapshots[1];
const latestRegressions = readJson(path.join(latest.snapshotDir, "regressions.json"));
const previousRegressions = readJson(path.join(previous.snapshotDir, "regressions.json"));

const payload = buildRegressionsComparisonPayload(
  baseDir,
  latest,
  previous,
  latestRegressions,
  previousRegressions
);

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  process.stdout.write(renderRegressionsComparisonText(payload));
}
