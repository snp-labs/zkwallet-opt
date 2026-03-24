import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonIfExists } from "./social-recovery-smoke-bundle-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const textOnly = args.includes("--text");

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

function getTarget(baseDir, requestedName) {
  if (!requestedName) {
    return {
      kind: "latest",
      dir: path.join(baseDir, "latest"),
      snapshot: null,
    };
  }

  const indexPath = path.join(baseDir, "snapshots", "index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
    );
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const snapshot = resolveSnapshot(index, requestedName);
  if (!snapshot) {
    throw new Error(`Snapshot ${requestedName} was not found in ${indexPath}.`);
  }

  return {
    kind: "snapshot",
    dir: snapshot.snapshotDir,
    snapshot,
  };
}

const baseDir = getBaseDir();
const requestedName =
  process.env.SOCIAL_RECOVERY_SMOKE_SNAPSHOT_NAME || getArgValue("--name");
const target = getTarget(baseDir, requestedName);
const checksumsPath = path.join(target.dir, "checksums.json");
const checksumsTextPath = path.join(target.dir, "checksums.txt");

if (!fs.existsSync(checksumsPath) || !fs.existsSync(checksumsTextPath)) {
  throw new Error(
    `Missing checksum artifacts in ${target.dir}. Run social-recovery:smoke:export first.`
  );
}

const checksums = readJsonIfExists(checksumsPath);
const checksumsText = fs.readFileSync(checksumsTextPath, "utf8");

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        baseDir,
        target: {
          kind: target.kind,
          dir: target.dir,
          snapshotName: target.snapshot?.name || null,
        },
        checksumsPath,
        checksumsTextPath,
        checksums,
      },
      null,
      2
    )
  );
} else if (textOnly) {
  process.stdout.write(checksumsText);
} else {
  const lines = [
    "# Social Recovery Smoke Checksums",
    "",
    `- target: ${target.kind}`,
    `- dir: ${target.dir}`,
    `- snapshotName: ${target.snapshot?.name || "(latest)"}`,
    `- fileCount: ${Array.isArray(checksums?.files) ? checksums.files.length : 0}`,
    `- checksumsPath: ${checksumsPath}`,
    `- checksumsTextPath: ${checksumsTextPath}`,
    "",
    checksumsText.trimEnd(),
    "",
  ];
  process.stdout.write(lines.join("\n"));
}
