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

const baseDir = getBaseDir();
const indexPath = path.join(baseDir, "snapshots", "index.json");

if (!fs.existsSync(indexPath)) {
  throw new Error(
    `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
  );
}

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
if (index.snapshots.length < 2) {
  throw new Error(
    "Need at least two smoke export snapshots to open the previous regressions changes."
  );
}

const snapshot = index.snapshots[1];
const changesTextPath = path.join(snapshot.snapshotDir, "regressions-changes.txt");
const changesJsonPath = path.join(snapshot.snapshotDir, "regressions-changes.json");

if (!fs.existsSync(changesTextPath)) {
  throw new Error(`Missing previous snapshot regressions changes artifact at ${changesTextPath}.`);
}

const changes = fs.existsSync(changesJsonPath)
  ? JSON.parse(fs.readFileSync(changesJsonPath, "utf8"))
  : null;

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        baseDir,
        snapshot,
        changesTextPath,
        changesJsonPath,
        changes,
      },
      null,
      2
    )
  );
} else {
  process.stdout.write(fs.readFileSync(changesTextPath, "utf8"));
}
