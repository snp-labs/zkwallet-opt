import fs from "node:fs";
import {
  REGRESSION_BUNDLE_FILES,
  collectMissingFiles,
  verifyChecksumsForPaths,
} from "./social-recovery-smoke-bundle-core.mjs";

export function buildRegressionsIntegrityPayload({ baseDir, latestDir, indexPath, index }) {
  const issues = [];
  const latestExists = fs.existsSync(latestDir);
  const latestMissingFiles = latestExists
    ? collectMissingFiles(latestDir, REGRESSION_BUNDLE_FILES)
    : REGRESSION_BUNDLE_FILES.slice();

  if (!latestExists) {
    issues.push("latest/ directory is missing");
  }
  if (!fs.existsSync(indexPath)) {
    issues.push("snapshots/index.json is missing");
  }
  if (latestMissingFiles.length > 0) {
    issues.push(`latest/ regression bundle is missing files: ${latestMissingFiles.join(", ")}`);
  } else if (latestExists) {
    verifyChecksumsForPaths(latestDir, REGRESSION_BUNDLE_FILES, issues, "latest/");
  }

  const brokenSnapshots = [];
  for (const snapshot of index.snapshots) {
    const snapshotDir = snapshot.snapshotDir;
    if (!snapshotDir || !fs.existsSync(snapshotDir)) {
      brokenSnapshots.push({ name: snapshot.name || "(unknown)", issue: "snapshotDir missing" });
      continue;
    }
    const missingFiles = collectMissingFiles(snapshotDir, REGRESSION_BUNDLE_FILES);
    if (missingFiles.length > 0) {
      brokenSnapshots.push({
        name: snapshot.name || "(unknown)",
        issue: `missing files: ${missingFiles.join(", ")}`,
      });
    } else {
      verifyChecksumsForPaths(
        snapshotDir,
        REGRESSION_BUNDLE_FILES,
        issues,
        `snapshot ${snapshot.name || "(unknown)"}`
      );
    }
  }

  if (brokenSnapshots.length > 0) {
    issues.push(
      `broken regression snapshots: ${brokenSnapshots.map((entry) => `${entry.name} (${entry.issue})`).join("; ")}`
    );
  }

  return {
    baseDir,
    ok: issues.length === 0,
    snapshotCount: index.snapshots.length,
    latestExists,
    indexExists: fs.existsSync(indexPath),
    latestMissingFiles,
    brokenSnapshots,
    issues,
    suggestedCommands:
      issues.length === 0
        ? [
            "npm run social-recovery:smoke:regressions:report",
            "npm run social-recovery:smoke:regressions:doctor",
          ]
        : [
            "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
            "npm run social-recovery:smoke:paths",
          ],
  };
}

export function renderRegressionsIntegrityText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Integrity",
    "",
    `- ok: ${payload.ok}`,
    `- snapshotCount: ${payload.snapshotCount}`,
    `- latestExists: ${payload.latestExists}`,
    `- indexExists: ${payload.indexExists}`,
    "",
  ];

  if (payload.issues.length === 0) {
    lines.push("No regression integrity issues found.");
  } else {
    lines.push("Issues:");
    for (const issue of payload.issues) {
      lines.push(`- ${issue}`);
    }
  }

  lines.push("", "Suggested commands:");
  for (const command of payload.suggestedCommands) {
    lines.push(`- ${command}`);
  }
  return lines.join("\n");
}
