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

function getRecommendation({
  hasLatestReport,
  snapshotCount,
  hasCompare,
  hasChecksumsCompare,
  recentRegressionCount,
  hasRegressionsCompare,
}) {
  if (!hasLatestReport) {
    return {
      reason: "No saved smoke export exists yet.",
      command:
        "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    };
  }

  if (snapshotCount < 2 || !hasCompare) {
    return {
      reason: "Only one saved export is available, so compare output is not ready yet.",
      command:
        "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    };
  }

  if (recentRegressionCount > 0) {
    return {
      reason: "Recent unstable saved snapshots should be reviewed first.",
      command: hasRegressionsCompare
        ? "npm run social-recovery:smoke:regressions:changes"
        : "npm run social-recovery:smoke:regressions",
    };
  }

  if (hasChecksumsCompare) {
    return {
      reason: "Latest compare output and checksum-only diff are both available.",
      command: "npm run social-recovery:smoke:checksums:changes",
    };
  }

  return {
    reason: "Latest compare output is available.",
    command: "npm run social-recovery:smoke:changes",
  };
}

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const latestReportPath = path.join(latestDir, "report.md");
const latestCompareJsonPath = path.join(latestDir, "compare.json");
const latestChecksumsCompareJsonPath = path.join(latestDir, "checksums-compare.json");
const snapshotsIndexPath = path.join(baseDir, "snapshots", "index.json");

const latestCompare = readJsonIfExists(latestCompareJsonPath);
const latestChecksumsCompare = readJsonIfExists(latestChecksumsCompareJsonPath);
const latestRegressionsCompare = readJsonIfExists(
  path.join(latestDir, "regressions-compare.json")
);
const index = readJsonIfExists(snapshotsIndexPath) || { snapshots: [] };
const snapshotCount = index.snapshots.length;
const recentRegressionCount = index.snapshots
  .slice(0, 10)
  .filter((snapshot) => snapshot.stabilityOk === false).length;
const hasLatestReport = fs.existsSync(latestReportPath);
const hasCompare = Array.isArray(latestCompare?.changedFields) || Array.isArray(latestCompare?.unchangedFields);
const hasChecksumsCompare =
  Array.isArray(latestChecksumsCompare?.changedArtifacts) ||
  Array.isArray(latestChecksumsCompare?.unchangedArtifacts);
const hasRegressionsCompare =
  typeof latestRegressionsCompare?.regressionCountDelta === "number" ||
  Array.isArray(latestRegressionsCompare?.addedSnapshotNames);
const recommendation = getRecommendation({
  hasLatestReport,
  snapshotCount,
  hasCompare,
  hasChecksumsCompare,
  recentRegressionCount,
  hasRegressionsCompare,
});

const payload = {
  baseDir,
  snapshotCount,
  hasLatestReport,
  hasCompare,
  hasChecksumsCompare,
  hasRegressionsCompare,
  recentRegressionCount,
  reason: recommendation.reason,
  command: recommendation.command,
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(recommendation.command);
}
