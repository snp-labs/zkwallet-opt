import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPlanPayload,
  renderPlanText,
} from "./social-recovery-smoke-plan-core.mjs";

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
const latestCompare = readJsonIfExists(path.join(latestDir, "compare.json"));
const latestChecksumsCompare = readJsonIfExists(path.join(latestDir, "checksums-compare.json"));
const latestRegressionsCompare = readJsonIfExists(
  path.join(latestDir, "regressions-compare.json")
);
const index = readJsonIfExists(path.join(baseDir, "snapshots", "index.json")) || {
  snapshots: [],
};
const recentRegressionCount = index.snapshots
  .slice(0, 10)
  .filter((snapshot) => snapshot.stabilityOk === false).length;
const hasLatestReport = fs.existsSync(path.join(latestDir, "report.md"));
const hasCompare =
  Array.isArray(latestCompare?.changedFields) ||
  Array.isArray(latestCompare?.unchangedFields);
const hasChecksumsCompare =
  Array.isArray(latestChecksumsCompare?.changedArtifacts) ||
  Array.isArray(latestChecksumsCompare?.unchangedArtifacts);
const hasRegressionsCompare =
  typeof latestRegressionsCompare?.regressionCountDelta === "number" ||
  Array.isArray(latestRegressionsCompare?.addedSnapshotNames);

const payload = buildPlanPayload({
  baseDir,
  hasLatestReport,
  snapshotCount: index.snapshots.length,
  hasCompare,
  hasChecksumsCompare,
  hasRegressionsCompare,
  recentRegressionCount,
});

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  process.stdout.write(renderPlanText(payload));
}
