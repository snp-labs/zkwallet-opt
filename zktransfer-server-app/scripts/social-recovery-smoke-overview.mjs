import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOverviewPayload,
  renderOverviewMarkdown,
} from "./social-recovery-smoke-overview-core.mjs";
import {
  getChecksumStatus,
  readJsonIfExists,
} from "./social-recovery-smoke-bundle-core.mjs";

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
const latestManifest = readJsonIfExists(path.join(latestDir, "manifest.json"));
const latestCompare = readJsonIfExists(path.join(latestDir, "compare.json"));
const latestChecksumsCompare = readJsonIfExists(path.join(latestDir, "checksums-compare.json"));
const latestRegressionsCompare = readJsonIfExists(
  path.join(latestDir, "regressions-compare.json")
);
const index = readJsonIfExists(path.join(baseDir, "snapshots", "index.json")) || {
  snapshots: [],
};

const snapshotCount = index.snapshots.length;
const recentRegressionCount = index.snapshots
  .slice(0, 10)
  .filter((snapshot) => snapshot.stabilityOk === false).length;
const hasLatestReport = fs.existsSync(path.join(latestDir, "report.md"));
const hasCompare =
  Array.isArray(latestCompare?.changedFields) ||
  Array.isArray(latestCompare?.unchangedFields);
const payload = buildOverviewPayload({
  baseDir,
  snapshotCount,
  latestSnapshotName: index.snapshots[0]?.name || null,
  previousSnapshotName: index.snapshots[1]?.name || null,
  hasLatestReport,
  hasCompare,
  recentRegressionCount,
  latestManifest,
  latestCompare,
  latestChecksumStatus: getChecksumStatus(latestDir, "latest/"),
  latestChecksumsCompare,
  latestRegressionsCompare,
});

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  process.stdout.write(renderOverviewMarkdown(payload));
}
