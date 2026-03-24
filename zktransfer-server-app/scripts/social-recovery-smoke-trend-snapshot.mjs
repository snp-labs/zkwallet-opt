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

function resolveSnapshot(index, name) {
  if (!name) {
    return index.snapshots[0] || null;
  }
  return index.snapshots.find((entry) => entry.name === name) || null;
}

const baseDir = getBaseDir();
const indexPath = path.join(baseDir, "snapshots", "index.json");
const requestedName =
  process.env.SOCIAL_RECOVERY_SMOKE_SNAPSHOT_NAME || getArgValue("--name");

if (!fs.existsSync(indexPath)) {
  throw new Error(
    `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
  );
}

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const snapshot = resolveSnapshot(index, requestedName);
if (!snapshot) {
  throw new Error(
    requestedName
      ? `Snapshot ${requestedName} was not found in ${indexPath}.`
      : `No smoke snapshots found in ${indexPath}.`
  );
}

const trendPath = path.join(snapshot.snapshotDir, "trend.txt");
const trendJsonPath = path.join(snapshot.snapshotDir, "trend.json");

if (!fs.existsSync(trendPath)) {
  throw new Error(`Missing snapshot trend at ${trendPath}.`);
}

const trend = fs.existsSync(trendJsonPath)
  ? JSON.parse(fs.readFileSync(trendJsonPath, "utf8"))
  : null;

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        baseDir,
        snapshot,
        trendPath,
        trendJsonPath,
        trend,
      },
      null,
      2
    )
  );
} else {
  process.stdout.write(fs.readFileSync(trendPath, "utf8"));
}
