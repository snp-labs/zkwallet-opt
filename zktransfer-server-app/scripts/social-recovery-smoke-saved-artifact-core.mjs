import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getCliContext(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl);
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

  return { appDir, args, jsonOnly, getArgValue, getBaseDir };
}

export function resolveSnapshot(index, name) {
  if (!name) {
    return index.snapshots[0] || null;
  }
  return index.snapshots.find((entry) => entry.name === name) || null;
}

export function loadSavedArtifact({
  importMetaUrl,
  mode,
  textFileName,
  jsonFileName = null,
  latestMissingMessage,
  previousMissingMessage,
  snapshotMissingMessage,
}) {
  const context = getCliContext(importMetaUrl);
  const baseDir = context.getBaseDir();
  const latestDir = path.join(baseDir, "latest");

  if (mode === "latest") {
    const textPath = path.join(latestDir, textFileName);
    const jsonPath = jsonFileName ? path.join(latestDir, jsonFileName) : null;
    if (!fs.existsSync(textPath)) {
      throw new Error(latestMissingMessage(textPath));
    }
    return {
      baseDir,
      latestDir,
      snapshot: null,
      textPath,
      jsonPath,
      text: fs.readFileSync(textPath, "utf8"),
      artifact:
        jsonPath && fs.existsSync(jsonPath)
          ? JSON.parse(fs.readFileSync(jsonPath, "utf8"))
          : null,
    };
  }

  const indexPath = path.join(baseDir, "snapshots", "index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Missing smoke export history at ${indexPath}. Run social-recovery:smoke:export first.`
    );
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  let snapshot;

  if (mode === "previous") {
    if (index.snapshots.length < 2) {
      throw new Error(
        `Need at least two smoke export snapshots to open the previous ${textFileName}.`
      );
    }
    snapshot = index.snapshots[1];
  } else {
    const requestedName =
      process.env.SOCIAL_RECOVERY_SMOKE_SNAPSHOT_NAME || context.getArgValue("--name");
    snapshot = resolveSnapshot(index, requestedName);
    if (!snapshot) {
      throw new Error(
        requestedName
          ? `Snapshot ${requestedName} was not found in ${indexPath}.`
          : `No smoke snapshots found in ${indexPath}.`
      );
    }
  }

  const textPath = path.join(snapshot.snapshotDir, textFileName);
  const jsonPath = jsonFileName ? path.join(snapshot.snapshotDir, jsonFileName) : null;
  if (!fs.existsSync(textPath)) {
    const formatter = mode === "previous" ? previousMissingMessage : snapshotMissingMessage;
    throw new Error(formatter(textPath));
  }

  return {
    baseDir,
    latestDir,
    snapshot,
    textPath,
    jsonPath,
    text: fs.readFileSync(textPath, "utf8"),
    artifact:
      jsonPath && fs.existsSync(jsonPath)
        ? JSON.parse(fs.readFileSync(jsonPath, "utf8"))
        : null,
  };
}

export function printSavedArtifact({ jsonOnly, payload }) {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    process.stdout.write(payload.text);
  }
}
