import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareChecksumBundles,
  TRACKED_ARTIFACT_PATHS,
} from "./social-recovery-smoke-compare-core.mjs";
import { readJsonIfExists } from "./social-recovery-smoke-bundle-core.mjs";

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
    return null;
  }
  return index.snapshots.find((entry) => entry.name === name) || null;
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
  throw new Error("Need at least two smoke export snapshots to compare checksum bundles.");
}

const latestName =
  process.env.SOCIAL_RECOVERY_SMOKE_COMPARE_LATEST || getArgValue("--latest-name");
const previousName =
  process.env.SOCIAL_RECOVERY_SMOKE_COMPARE_PREVIOUS || getArgValue("--previous-name");

const latest = resolveSnapshot(index, latestName) || index.snapshots[0];
const previous = resolveSnapshot(index, previousName) || index.snapshots[1];

if (!latest) {
  throw new Error(`Latest snapshot ${latestName} was not found in ${indexPath}.`);
}
if (!previous) {
  throw new Error(`Previous snapshot ${previousName} was not found in ${indexPath}.`);
}

const latestChecksums = readJsonIfExists(path.join(latest.snapshotDir, "checksums.json"));
const previousChecksums = readJsonIfExists(path.join(previous.snapshotDir, "checksums.json"));
if (!latestChecksums || !previousChecksums) {
  throw new Error("Missing checksums.json in one or both snapshots.");
}

const comparisons = compareChecksumBundles(latestChecksums, previousChecksums);
const payload = {
  baseDir,
  trackedArtifactPaths: TRACKED_ARTIFACT_PATHS,
  latest: {
    name: latest.name,
    generatedAt: latest.generatedAt || null,
    snapshotDir: latest.snapshotDir,
  },
  previous: {
    name: previous.name,
    generatedAt: previous.generatedAt || null,
    snapshotDir: previous.snapshotDir,
  },
  changedArtifacts: comparisons.filter((entry) => entry.changed),
  unchangedArtifacts: comparisons.filter((entry) => !entry.changed).map((entry) => entry.path),
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const lines = [
    "# Social Recovery Smoke Checksum Compare",
    "",
    `- latest: ${payload.latest.name}`,
    `- previous: ${payload.previous.name}`,
    "",
  ];

  if (payload.changedArtifacts.length === 0) {
    lines.push("No tracked artifact checksum changes.");
  } else {
    lines.push("Changed artifacts:");
    for (const entry of payload.changedArtifacts) {
      lines.push(
        `- ${entry.path}: ${entry.previousSha256 || "(none)"} -> ${entry.latestSha256 || "(none)"}`
      );
    }
  }

  if (payload.unchangedArtifacts.length > 0) {
    lines.push("");
    lines.push(`Unchanged artifacts: ${payload.unchangedArtifacts.join(", ")}`);
  }

  lines.push("");
  process.stdout.write(lines.join("\n"));
}
