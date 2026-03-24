import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOverviewPayload,
  renderOverviewMarkdown,
} from "./social-recovery-smoke-overview-core.mjs";
import {
  REQUIRED_BUNDLE_FILES,
  collectMissingFiles,
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

function getIntegrity(baseDir) {
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
    issues.push(...getChecksumStatus(latestDir, "latest/").issues);
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
      issues.push(...getChecksumStatus(snapshotDir, `snapshot ${snapshot.name || "(unknown)"}`).issues);
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

  return {
    ok: issues.length === 0,
    snapshotCount: index.snapshots.length,
    issues,
    latestExists,
    indexExists,
    historyExists: fs.existsSync(historyPath),
    exportManifestExists: fs.existsSync(exportManifestPath),
  };
}

function getStatus(baseDir) {
  const latestDir = path.join(baseDir, "latest");
  const latestManifest = readJsonIfExists(path.join(latestDir, "manifest.json"));
  const latestCompare = readJsonIfExists(path.join(latestDir, "compare.json"));
  const index = readJsonIfExists(path.join(baseDir, "snapshots", "index.json")) || {
    snapshots: [],
  };
  const snapshotCount = index.snapshots.length;
  const hasLatestReport = fs.existsSync(path.join(latestDir, "report.md"));
  const hasCompare =
    Array.isArray(latestCompare?.changedFields) ||
    Array.isArray(latestCompare?.unchangedFields);

  return buildOverviewPayload({
    baseDir,
    snapshotCount,
    latestSnapshotName: index.snapshots[0]?.name || null,
    previousSnapshotName: index.snapshots[1]?.name || null,
    hasLatestReport,
    hasCompare,
    latestManifest,
    latestCompare,
    latestChecksumStatus: getChecksumStatus(latestDir, "latest/"),
  });
}

const baseDir = getBaseDir();
const integrity = getIntegrity(baseDir);
const overview = getStatus(baseDir);
const latestStability = readJsonIfExists(path.join(baseDir, "latest", "stability.json"));
if (latestStability && !latestStability.ok) {
  integrity.issues.push(
    `latest saved stability failed: ${
      Array.isArray(latestStability.reasons) && latestStability.reasons.length > 0
        ? latestStability.reasons.join("; ")
        : "unknown reason"
    }`
  );
  integrity.ok = false;
}
const doctorOk = integrity.ok && overview.hasLatestReport;

const payload = {
  ok: doctorOk,
  baseDir,
  integrity,
  overview,
  latestStability,
  nextCommand: overview.next.command,
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const sections = [
    "# Social Recovery Smoke Doctor",
    "",
    `- ok: ${payload.ok}`,
    `- baseDir: ${payload.baseDir}`,
    "",
    "## Integrity",
    "",
    `- ok: ${integrity.ok}`,
  ];

  if (integrity.issues.length === 0) {
    sections.push("- issues: none");
  } else {
    sections.push("- issues:");
    for (const issue of integrity.issues) {
      sections.push(`  - ${issue}`);
    }
  }

  sections.push("");
  sections.push(renderOverviewMarkdown(overview).trimEnd());
  sections.push("");
  sections.push("## Gate");
  sections.push("");
  sections.push(`- nextCommand: ${payload.nextCommand}`);
  sections.push(
    `- result: ${payload.ok ? "ready to rely on saved smoke artifacts" : "saved smoke artifacts need attention"}`
  );
  sections.push("");

  process.stdout.write(sections.join("\n"));
}

if (!payload.ok) {
  process.exitCode = 1;
}
