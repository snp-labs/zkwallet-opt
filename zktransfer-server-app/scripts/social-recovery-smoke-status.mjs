import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

function getSuggestedCommands(
  snapshotCount,
  hasLatestReport,
  hasCompare,
  recentRegressionCount,
  hasRegressionsCompare
) {
  if (!hasLatestReport) {
    return ["npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json"];
  }
  if (snapshotCount < 2 || !hasCompare) {
    return [
      "npm run social-recovery:smoke:latest",
      "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    ];
  }
  if (recentRegressionCount > 0) {
    return [
      ...(hasRegressionsCompare ? ["npm run social-recovery:smoke:regressions:changes"] : []),
      "npm run social-recovery:smoke:regressions",
      "npm run social-recovery:smoke:changes",
      "npm run social-recovery:smoke:checksums:changes",
      "npm run social-recovery:smoke:compare",
    ];
  }
  return [
    "npm run social-recovery:smoke:changes",
    "npm run social-recovery:smoke:checksums:changes",
    "npm run social-recovery:smoke:compare",
    "npm run social-recovery:smoke:latest",
  ];
}

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const latestManifestPath = path.join(latestDir, "manifest.json");
const latestReportPath = path.join(latestDir, "report.md");
const latestCompareJsonPath = path.join(latestDir, "compare.json");
const snapshotsIndexPath = path.join(baseDir, "snapshots", "index.json");
const historyPath = path.join(baseDir, "history.md");

const latestManifest = readJsonIfExists(latestManifestPath);
const latestCompare = readJsonIfExists(latestCompareJsonPath);
const latestChecksumsCompare = readJsonIfExists(path.join(latestDir, "checksums-compare.json"));
const latestRegressionsCompare = readJsonIfExists(path.join(latestDir, "regressions-compare.json"));
const latestStability = readJsonIfExists(path.join(latestDir, "stability.json"));
const latestChecksumStatus = getChecksumStatus(latestDir, "latest/");
const index = readJsonIfExists(snapshotsIndexPath) || { snapshots: [] };
const snapshotCount = index.snapshots.length;
const recentRegressionCount = index.snapshots
  .slice(0, 10)
  .filter((snapshot) => snapshot.stabilityOk === false).length;
const latestSnapshot = index.snapshots[0] || null;
const previousSnapshot = index.snapshots[1] || null;
const hasLatestReport = fs.existsSync(latestReportPath);
const hasCompare = Array.isArray(latestCompare?.changedFields) || Array.isArray(latestCompare?.unchangedFields);
const hasRegressionsCompare =
  typeof latestRegressionsCompare?.regressionCountDelta === "number" ||
  Array.isArray(latestRegressionsCompare?.addedSnapshotNames);

const payload = {
  baseDir,
  latestDir,
  snapshotCount,
  recentRegressionCount,
  hasLatestReport,
  hasHistory: fs.existsSync(historyPath),
  latestSnapshotName: latestSnapshot?.name || null,
  previousSnapshotName: previousSnapshot?.name || null,
  latestManifest: latestManifest
    ? {
        accountId: latestManifest.accountId || null,
        zkAccountAddress: latestManifest.zkAccountAddress || null,
        challengeNonce: latestManifest.challengeNonce || null,
        submitTransactionHash: latestManifest.submitTransactionHash || null,
        submitUserOpHash: latestManifest.submitUserOpHash || null,
        generatedAt: latestManifest.generatedAt || null,
      }
    : null,
  latestCompare: latestCompare
    ? {
        latest: latestCompare.latest || null,
        previous: latestCompare.previous || null,
        changedFieldLabels: Array.isArray(latestCompare.changedFields)
          ? latestCompare.changedFields.map((entry) => entry.label)
          : [],
        unchangedFields: Array.isArray(latestCompare.unchangedFields)
          ? latestCompare.unchangedFields
          : [],
      }
    : null,
  latestChecksumStatus: {
    ok: latestChecksumStatus.ok,
    fileCount: latestChecksumStatus.fileCount,
    issues: latestChecksumStatus.issues,
  },
  latestChecksumsCompare: latestChecksumsCompare
    ? {
        changedArtifactPaths: Array.isArray(latestChecksumsCompare.changedArtifacts)
          ? latestChecksumsCompare.changedArtifacts.map((entry) => entry.path)
          : [],
        unchangedArtifacts: Array.isArray(latestChecksumsCompare.unchangedArtifacts)
          ? latestChecksumsCompare.unchangedArtifacts
          : [],
      }
    : null,
  latestRegressionsCompare: latestRegressionsCompare
    ? {
        regressionCountDelta:
          typeof latestRegressionsCompare.regressionCountDelta === "number"
            ? latestRegressionsCompare.regressionCountDelta
            : null,
        addedSnapshotNames: Array.isArray(latestRegressionsCompare.addedSnapshotNames)
          ? latestRegressionsCompare.addedSnapshotNames
          : [],
        removedSnapshotNames: Array.isArray(latestRegressionsCompare.removedSnapshotNames)
          ? latestRegressionsCompare.removedSnapshotNames
          : [],
      }
    : null,
  latestStability: latestStability
    ? {
        ok: Boolean(latestStability.ok),
        reasons: Array.isArray(latestStability.reasons) ? latestStability.reasons : [],
      }
    : null,
  suggestedCommands: getSuggestedCommands(
    snapshotCount,
    hasLatestReport,
    hasCompare,
    recentRegressionCount,
    hasRegressionsCompare
  ),
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("# Social Recovery Smoke Status");
  console.log("");
  console.log(`- baseDir: ${payload.baseDir}`);
  console.log(`- snapshotCount: ${payload.snapshotCount}`);
  console.log(`- recentRegressionCount: ${payload.recentRegressionCount}`);
  console.log(`- latestSnapshotName: ${payload.latestSnapshotName || "(none)"}`);
  console.log(`- previousSnapshotName: ${payload.previousSnapshotName || "(none)"}`);
  console.log(`- hasLatestReport: ${payload.hasLatestReport}`);
  console.log(`- hasHistory: ${payload.hasHistory}`);
  console.log(`- latestChecksumOk: ${payload.latestChecksumStatus.ok}`);
  console.log(`- latestChecksumFileCount: ${payload.latestChecksumStatus.fileCount}`);
  if (payload.latestManifest) {
    console.log(`- latestAccountId: ${payload.latestManifest.accountId || "(none)"}`);
    console.log(
      `- latestSubmitTransactionHash: ${payload.latestManifest.submitTransactionHash || "(none)"}`
    );
    console.log(`- latestSubmitUserOpHash: ${payload.latestManifest.submitUserOpHash || "(none)"}`);
  }
  if (payload.latestCompare) {
    console.log(
      `- changedFields: ${payload.latestCompare.changedFieldLabels.join(", ") || "(none)"}`
    );
  } else {
    console.log("- changedFields: (not available)");
  }
  if (payload.latestChecksumStatus.issues.length === 0) {
    console.log("- checksumIssues: none");
  } else {
    console.log(`- checksumIssues: ${payload.latestChecksumStatus.issues.join("; ")}`);
  }
  if (payload.latestChecksumsCompare) {
    console.log(
      `- changedChecksumArtifacts: ${payload.latestChecksumsCompare.changedArtifactPaths.join(", ") || "(none)"}`
    );
  } else {
    console.log("- changedChecksumArtifacts: (not available)");
  }
  if (payload.latestRegressionsCompare) {
    console.log(
      `- regressionCountDelta: ${payload.latestRegressionsCompare.regressionCountDelta ?? "(none)"}`
    );
    console.log(
      `- addedRegressionSnapshots: ${payload.latestRegressionsCompare.addedSnapshotNames.join(", ") || "(none)"}`
    );
  } else {
    console.log("- regressionCountDelta: (not available)");
  }
  if (payload.latestStability) {
    console.log(`- latestStabilityOk: ${payload.latestStability.ok}`);
  } else {
    console.log("- latestStabilityOk: (not available)");
  }
  console.log("");
  console.log("Recommended next commands:");
  for (const command of payload.suggestedCommands) {
    console.log(`- ${command}`);
  }
}
