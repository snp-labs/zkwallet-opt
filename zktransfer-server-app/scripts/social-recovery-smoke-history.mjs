import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const stableOnly = args.includes("--stable-only");
const unstableOnly = args.includes("--unstable-only");
const gateFailingOnly = args.includes("--gate-failing-only");

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
const historyPath = path.join(baseDir, "history.md");
const indexPath = path.join(baseDir, "snapshots", "index.json");

if (!fs.existsSync(indexPath)) {
  throw new Error(
    `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
  );
}

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const snapshots = index.snapshots.filter((snapshot) => {
  if (stableOnly) {
    return snapshot.stabilityOk === true;
  }
  if (unstableOnly) {
    return snapshot.stabilityOk === false;
  }
  if (gateFailingOnly) {
    return snapshot.regressionsGateOk === false;
  }
  return true;
});

function buildFallbackHistoryText() {
  const stableCount = snapshots.filter((snapshot) => snapshot.stabilityOk === true).length;
  const unstableCount = snapshots.filter((snapshot) => snapshot.stabilityOk === false).length;
  const gateFailingCount = snapshots.filter((snapshot) => snapshot.regressionsGateOk === false).length;
  const gateIssueCount = snapshots.reduce(
    (sum, snapshot) => sum + (snapshot.regressionsGateIssueCount ?? 0),
    0
  );
  const lines = [
    "# Social Recovery Smoke History",
    "",
    `- snapshots: ${snapshots.length}`,
    `- stableSnapshots: ${stableCount}`,
    `- unstableSnapshots: ${unstableCount}`,
    `- gateFailingSnapshots: ${gateFailingCount}`,
    `- gateIssues: ${gateIssueCount}`,
  ];

  if (stableOnly) {
    lines.push("- filter: stable-only");
  } else if (unstableOnly) {
    lines.push("- filter: unstable-only");
  } else if (gateFailingOnly) {
    lines.push("- filter: gate-failing-only");
  }

  return `${lines.join("\n")}\n`;
}

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        baseDir,
        historyPath,
        snapshotCount: snapshots.length,
        stableCount: snapshots.filter((snapshot) => snapshot.stabilityOk === true).length,
        unstableCount: snapshots.filter((snapshot) => snapshot.stabilityOk === false).length,
        gateFailingCount: snapshots.filter((snapshot) => snapshot.regressionsGateOk === false).length,
        gateIssueCount: snapshots.reduce(
          (sum, snapshot) => sum + (snapshot.regressionsGateIssueCount ?? 0),
          0
        ),
        filter: stableOnly
          ? "stable-only"
          : unstableOnly
          ? "unstable-only"
          : gateFailingOnly
          ? "gate-failing-only"
          : "all",
        snapshots,
      },
      null,
      2
    )
  );
} else if (fs.existsSync(historyPath)) {
  if (!stableOnly && !unstableOnly && !gateFailingOnly) {
    process.stdout.write(fs.readFileSync(historyPath, "utf8"));
  } else {
    process.stdout.write(buildFallbackHistoryText());
  }
} else {
  process.stdout.write(buildFallbackHistoryText());
}
