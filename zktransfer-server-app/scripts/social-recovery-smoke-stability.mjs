import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTrendPayload,
  renderTrendText,
} from "./social-recovery-smoke-trend-core.mjs";
import {
  buildStabilityPayload,
  renderStabilityText,
} from "./social-recovery-smoke-stability-core.mjs";

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

function hasFlag(flag) {
  return args.includes(flag);
}

function getBaseDir() {
  return (
    process.env.SOCIAL_RECOVERY_SMOKE_REPORT_DIR ||
    getArgValue("--base-dir") ||
    path.join(appDir, "tmp", "social-recovery-smoke-report")
  );
}

function getWindowSize() {
  const raw = process.env.SOCIAL_RECOVERY_SMOKE_TREND_WINDOW || getArgValue("--window");
  const parsed = Number.parseInt(raw || "5", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 5;
  }
  return parsed;
}

function getOptionalNumber(flag, envName) {
  const raw = process.env[envName] || getArgValue(flag);
  if (!raw) {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function requireLastTwoStable() {
  const raw = process.env.SOCIAL_RECOVERY_SMOKE_REQUIRE_LAST_TWO_STABLE;
  return raw === "1" || raw === "true" || hasFlag("--require-last-two");
}

const baseDir = getBaseDir();
const indexPath = path.join(baseDir, "snapshots", "index.json");
if (!fs.existsSync(indexPath)) {
  throw new Error(
    `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
  );
}

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const options = {
  requireLastTwoStable: requireLastTwoStable(),
  maxAverageChangedFieldsCount: getOptionalNumber(
    "--max-average-fields",
    "SOCIAL_RECOVERY_SMOKE_MAX_AVERAGE_FIELDS"
  ),
  maxAverageChangedArtifactsCount: getOptionalNumber(
    "--max-average-artifacts",
    "SOCIAL_RECOVERY_SMOKE_MAX_AVERAGE_ARTIFACTS"
  ),
};
const trendPayload = {
  baseDir,
  ...buildTrendPayload(index, getWindowSize()),
};
const payload = buildStabilityPayload(trendPayload, options);

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  process.stdout.write(renderStabilityText(payload, renderTrendText));
}

if (!payload.ok) {
  process.exitCode = 1;
}
