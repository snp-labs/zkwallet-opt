import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOverviewPayload,
  renderOverviewMarkdown,
} from "./social-recovery-smoke-overview-core.mjs";
import { getChecksumStatus } from "./social-recovery-smoke-bundle-core.mjs";
import {
  buildSummaryPayload,
  renderSummaryMarkdown,
} from "./social-recovery-smoke-summary-core.mjs";

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

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const snapshotsDir = path.join(baseDir, "snapshots");

const latestManifest = readJsonIfExists(path.join(latestDir, "manifest.json"));
const latestCompare = readJsonIfExists(path.join(latestDir, "compare.json"));
const latestChecksumsCompare = readJsonIfExists(path.join(latestDir, "checksums-compare.json"));
const historyText = readTextIfExists(path.join(baseDir, "history.md"));
const index = readJsonIfExists(path.join(snapshotsDir, "index.json")) || { snapshots: [] };

const overview = buildOverviewPayload({
  baseDir,
  snapshotCount: index.snapshots.length,
  latestSnapshotName: index.snapshots[0]?.name || null,
  previousSnapshotName: index.snapshots[1]?.name || null,
  hasLatestReport: fs.existsSync(path.join(latestDir, "report.md")),
  hasCompare:
    Array.isArray(latestCompare?.changedFields) ||
    Array.isArray(latestCompare?.unchangedFields),
  latestManifest,
  latestCompare,
  latestChecksumStatus: getChecksumStatus(latestDir, "latest/"),
  latestChecksumsCompare,
});

const payload = buildSummaryPayload({
  baseDir,
  overview,
  latestDir,
  snapshotsDir,
  historyText,
});

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  process.stdout.write(renderSummaryMarkdown(payload, renderOverviewMarkdown));
}
