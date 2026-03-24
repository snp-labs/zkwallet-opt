import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_BUNDLE_FILES,
  collectMissingFiles,
  readJsonIfExists,
  verifyChecksums,
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

function getSuggestedCommands({ hasIndex, hasLatest, snapshotCount, issues }) {
  if (!hasIndex && !hasLatest) {
    return ["npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json"];
  }
  if (issues.length > 0) {
    return [
      "npm run social-recovery:smoke:paths",
      "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    ];
  }
  if (snapshotCount >= 2) {
    return [
      "npm run social-recovery:smoke:changes",
      "npm run social-recovery:smoke:overview",
    ];
  }
  return [
    "npm run social-recovery:smoke:latest",
    "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
  ];
}

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const snapshotsDir = path.join(baseDir, "snapshots");
const historyPath = path.join(baseDir, "history.md");
const exportManifestPath = path.join(baseDir, "export-manifest.json");
const indexPath = path.join(snapshotsDir, "index.json");

const issues = [];
const exportManifest = readJsonIfExists(exportManifestPath);
const index = readJsonIfExists(indexPath) || { snapshots: [] };
const latestExists = fs.existsSync(latestDir);
const indexExists = fs.existsSync(indexPath);

const latestMissingFiles = latestExists
  ? collectMissingFiles(latestDir, REQUIRED_BUNDLE_FILES)
  : ["manifest.json", "report.md"];

if (!latestExists) {
  issues.push("latest/ directory is missing");
}
if (!indexExists) {
  issues.push("snapshots/index.json is missing");
}
if (!fs.existsSync(historyPath)) {
  issues.push("history.md is missing");
}
if (!fs.existsSync(exportManifestPath)) {
  issues.push("export-manifest.json is missing");
}
if (latestMissingFiles.length > 0) {
  issues.push(`latest/ is missing files: ${latestMissingFiles.join(", ")}`);
} else if (latestExists) {
  verifyChecksums(latestDir, issues, "latest/");
}

const brokenSnapshots = [];
for (const snapshot of index.snapshots) {
  const snapshotDir = snapshot.snapshotDir;
  if (!snapshotDir || !fs.existsSync(snapshotDir)) {
    brokenSnapshots.push({ name: snapshot.name || "(unknown)", issue: "snapshotDir missing" });
    continue;
  }
  const missingFiles = collectMissingFiles(snapshotDir, REQUIRED_BUNDLE_FILES);
  if (missingFiles.length > 0) {
    brokenSnapshots.push({
      name: snapshot.name || "(unknown)",
      issue: `missing files: ${missingFiles.join(", ")}`,
    });
  } else {
    verifyChecksums(snapshotDir, issues, `snapshot ${snapshot.name || "(unknown)"}`);
  }
}

if (brokenSnapshots.length > 0) {
  issues.push(
    `broken snapshots: ${brokenSnapshots.map((entry) => `${entry.name} (${entry.issue})`).join("; ")}`
  );
}

if (
  exportManifest &&
  exportManifest.latestIndexPath &&
  path.resolve(exportManifest.latestIndexPath) !== path.resolve(indexPath)
) {
  issues.push("export-manifest.json latestIndexPath does not match snapshots/index.json");
}

const payload = {
  baseDir,
  ok: issues.length === 0,
  snapshotCount: index.snapshots.length,
  latestExists,
  indexExists,
  historyExists: fs.existsSync(historyPath),
  exportManifestExists: fs.existsSync(exportManifestPath),
  latestMissingFiles,
  brokenSnapshots,
  issues,
  suggestedCommands: getSuggestedCommands({
    hasIndex: indexExists,
    hasLatest: latestExists,
    snapshotCount: index.snapshots.length,
    issues,
  }),
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("# Social Recovery Smoke Integrity");
  console.log("");
  console.log(`- ok: ${payload.ok}`);
  console.log(`- snapshotCount: ${payload.snapshotCount}`);
  console.log(`- latestExists: ${payload.latestExists}`);
  console.log(`- indexExists: ${payload.indexExists}`);
  console.log(`- historyExists: ${payload.historyExists}`);
  console.log(`- exportManifestExists: ${payload.exportManifestExists}`);
  console.log("");
  if (payload.issues.length === 0) {
    console.log("No integrity issues found.");
  } else {
    console.log("Issues:");
    for (const issue of payload.issues) {
      console.log(`- ${issue}`);
    }
  }
  console.log("");
  console.log("Suggested commands:");
  for (const command of payload.suggestedCommands) {
    console.log(`- ${command}`);
  }
}
