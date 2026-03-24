import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonIfExists } from "./social-recovery-smoke-bundle-core.mjs";
import {
  buildRegressionsIntegrityPayload,
  renderRegressionsIntegrityText,
} from "./social-recovery-smoke-regressions-integrity-core.mjs";

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

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const snapshotsDir = path.join(baseDir, "snapshots");
const indexPath = path.join(snapshotsDir, "index.json");
const index = readJsonIfExists(indexPath) || { snapshots: [] };

const payload = buildRegressionsIntegrityPayload({
  baseDir,
  latestDir,
  indexPath,
  index,
});

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(renderRegressionsIntegrityText(payload));
}

if (!payload.ok) {
  process.exitCode = 1;
}
