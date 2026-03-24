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

function getKeepCount() {
  const raw = process.env.SOCIAL_RECOVERY_SMOKE_PRUNE_KEEP || getArgValue("--keep") || "5";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Invalid keep count: ${raw}`);
  }
  return parsed;
}

function shouldApply() {
  return (
    process.env.SOCIAL_RECOVERY_SMOKE_PRUNE_APPLY === "1" || args.includes("--apply")
  );
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function renderHistory(index) {
  const lines = [
    "# Social Recovery Smoke History",
    "",
    `- snapshots: ${index.snapshots.length}`,
    "",
    "| Snapshot | Account | Tx Hash | UserOp Hash | Generated At |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const snapshot of index.snapshots) {
    lines.push(
      `| ${snapshot.name} | ${snapshot.accountId || "(none)"} | ${snapshot.submitTransactionHash || "(none)"} | ${snapshot.submitUserOpHash || "(none)"} | ${snapshot.generatedAt || "(none)"} |`
    );
  }

  lines.push("");
  return lines.join("\n");
}

const baseDir = getBaseDir();
const snapshotsDir = path.join(baseDir, "snapshots");
const indexPath = path.join(snapshotsDir, "index.json");
const keep = getKeepCount();
const apply = shouldApply();

if (!fs.existsSync(indexPath)) {
  throw new Error(
    `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
  );
}

const index = readJson(indexPath, { snapshots: [] });
const keepSnapshots = index.snapshots.slice(0, keep);
const pruneSnapshots = index.snapshots.slice(keep);

if (apply && pruneSnapshots.length > 0) {
  for (const snapshot of pruneSnapshots) {
    fs.rmSync(snapshot.snapshotDir, { recursive: true, force: true });
  }

  const nextIndex = {
    generatedAt: new Date().toISOString(),
    snapshots: keepSnapshots,
  };
  writeJson(indexPath, nextIndex);
  fs.writeFileSync(path.join(baseDir, "history.md"), renderHistory(nextIndex));
}

const payload = {
  baseDir,
  apply,
  keep,
  totalSnapshots: index.snapshots.length,
  keptSnapshots: keepSnapshots.map((entry) => entry.name),
  prunedSnapshots: pruneSnapshots.map((entry) => entry.name),
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("# Social Recovery Smoke Prune");
  console.log("");
  console.log(`- mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`- keep: ${keep}`);
  console.log(`- totalSnapshots: ${payload.totalSnapshots}`);
  console.log(`- keptSnapshots: ${payload.keptSnapshots.join(", ") || "(none)"}`);
  console.log(`- prunedSnapshots: ${payload.prunedSnapshots.join(", ") || "(none)"}`);
}
