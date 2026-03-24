import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildComparisonReport, buildSnapshotComparison, renderComparisonReport } from "./zktransfer-ops-compare-core.mjs";
import { loadDeploymentStatuses, summarizeStatuses } from "./zktransfer-ops-overview.mjs";
import { renderNextSteps, renderRootCommandOnly } from "./zktransfer-ops-next.mjs";
import { renderOpsPlan } from "./zktransfer-ops-plan.mjs";
import { renderOpsReport } from "./zktransfer-ops-report.mjs";
import { renderOpsSummaryMarkdown } from "./zktransfer-ops-summary.mjs";

export function buildExportBundle(statuses, summary) {
  return {
    "deployment-statuses.json": `${JSON.stringify(statuses, null, 2)}\n`,
    "summary.json": `${JSON.stringify(summary, null, 2)}\n`,
    "summary.md": renderOpsSummaryMarkdown(summary),
    "next.txt": renderNextSteps(summary),
    "next-root.txt": renderRootCommandOnly(summary),
    "plan.txt": renderOpsPlan(summary),
    "report.md": renderOpsReport(summary)
  };
}

export function resolveExportDir(env = process.env) {
  if (env.ZKTRANSFER_OPS_EXPORT_DIR) {
    return path.resolve(env.ZKTRANSFER_OPS_EXPORT_DIR);
  }

  return path.join(os.tmpdir(), "zktransfer-ops-export");
}

export function createSnapshotName(timestamp) {
  return timestamp.replace(/[:.]/g, "-");
}

export function writeExportBundle(outputDir, bundle, metadata = {}) {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [filename, contents] of Object.entries(bundle)) {
    fs.writeFileSync(path.join(outputDir, filename), contents);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    outputDir,
    files: Object.keys(bundle).sort(),
    ...metadata
  };
  fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return manifest;
}

export function writeAdditionalArtifacts(outputDir, artifacts) {
  for (const [filename, contents] of Object.entries(artifacts)) {
    fs.writeFileSync(path.join(outputDir, filename), contents);
  }

  const manifestPath = path.join(outputDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.files = [...new Set([...(manifest.files || []), ...Object.keys(artifacts)])].sort();
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function collectSnapshotEntries(baseDir) {
  const snapshotsDir = path.join(baseDir, "snapshots");
  if (!fs.existsSync(snapshotsDir)) {
    return [];
  }

  return fs
    .readdirSync(snapshotsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const snapshotDir = path.join(snapshotsDir, entry.name);
      const manifestPath = path.join(snapshotDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return null;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      return {
        snapshotName: manifest.snapshotName || entry.name,
        generatedAt: manifest.generatedAt || null,
        snapshotDir,
        blockingIssueCount: manifest.blockingIssueCount ?? null,
        configReady: manifest.configReady ?? null,
        healthReady: manifest.healthReady ?? null
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.snapshotName.localeCompare(left.snapshotName));
}

export function renderSnapshotHistory(entries, latestDir) {
  const lines = [];

  lines.push("# zkTransfer Ops Export History");
  lines.push("");
  lines.push(`- Latest export: \`${latestDir}\``);
  lines.push(`- Snapshot count: \`${entries.length}\``);
  lines.push("");

  if (entries.length === 0) {
    lines.push("- none");
    lines.push("");
    return `${lines.join("\n")}`;
  }

  for (const entry of entries) {
    lines.push(`- **${entry.snapshotName}**`);
    if (entry.generatedAt) {
      lines.push(`  - generatedAt: \`${entry.generatedAt}\``);
    }
    if (entry.configReady !== null && entry.healthReady !== null) {
      lines.push(
        `  - ready: config=\`${entry.configReady}\`, health=\`${entry.healthReady}\`, blockingIssues=\`${entry.blockingIssueCount}\``
      );
    }
    lines.push(`  - path: \`${entry.snapshotDir}\``);
  }

  lines.push("");
  return `${lines.join("\n")}`;
}

export function updateExportIndex(baseDir, latestDir) {
  const entries = collectSnapshotEntries(baseDir);
  const indexPath = path.join(baseDir, "snapshots", "index.json");
  const historyPath = path.join(baseDir, "history.md");

  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(entries, null, 2)}\n`);
  fs.writeFileSync(historyPath, renderSnapshotHistory(entries, latestDir));

  return {
    entries,
    indexPath,
    historyPath
  };
}

export function writeExportArtifacts(baseDir, bundle, summary) {
  const snapshotName = createSnapshotName(summary.generatedAt);
  const snapshotsDir = path.join(baseDir, "snapshots");
  const snapshotDir = path.join(snapshotsDir, snapshotName);
  const latestDir = path.join(baseDir, "latest");

  fs.mkdirSync(snapshotsDir, { recursive: true });
  const snapshotManifest = writeExportBundle(snapshotDir, bundle, {
    exportMode: "snapshot",
    snapshotName,
    latestDir,
    configReady: summary.overall.configReady,
    healthReady: summary.overall.healthReady,
    blockingIssueCount: summary.overall.blockingIssueCount
  });

  fs.rmSync(latestDir, { recursive: true, force: true });
  const latestManifest = writeExportBundle(latestDir, bundle, {
    exportMode: "latest",
    snapshotName,
    snapshotDir,
    configReady: summary.overall.configReady,
    healthReady: summary.overall.healthReady,
    blockingIssueCount: summary.overall.blockingIssueCount
  });

  const exportIndex = updateExportIndex(baseDir, latestDir);
  const comparison = buildSnapshotComparison({
    baseDir,
    entries: exportIndex.entries,
    latestName: snapshotName,
    previousName: exportIndex.entries.find((entry) => entry.snapshotName !== snapshotName)?.snapshotName ?? null
  });
  const comparisonReport = buildComparisonReport(comparison);
  const comparisonArtifacts = {
    "compare.txt": renderComparisonReport(comparisonReport),
    "compare.json": `${JSON.stringify(comparisonReport, null, 2)}\n`
  };
  const snapshotManifestWithCompare = writeAdditionalArtifacts(snapshotDir, comparisonArtifacts);
  const latestManifestWithCompare = writeAdditionalArtifacts(latestDir, comparisonArtifacts);

  return {
    baseDir,
    latestDir,
    snapshotDir,
    snapshotName,
    snapshotManifest,
    latestManifest,
    exportIndex,
    comparisonReport,
    snapshotManifestWithCompare,
    latestManifestWithCompare
  };
}

function main() {
  const statuses = loadDeploymentStatuses();
  const summary = summarizeStatuses(statuses);
  const bundle = buildExportBundle(statuses, summary);
  const baseDir = resolveExportDir(process.env);
  const exportResult = writeExportArtifacts(baseDir, bundle, summary);

  const latestFiles = exportResult.latestManifestWithCompare?.files || exportResult.latestManifest.files;
  console.log(`[zktransfer-ops-export] wrote ${latestFiles.length + 1} files to ${exportResult.latestDir}`);
  console.log(`[zktransfer-ops-export] snapshot: ${exportResult.snapshotDir}`);
  console.log(`[zktransfer-ops-export] history: ${exportResult.exportIndex.historyPath}`);
  console.log(`[zktransfer-ops-export] index: ${exportResult.exportIndex.indexPath}`);
  for (const filename of latestFiles) {
    console.log(path.join(exportResult.latestDir, filename));
  }
  console.log(path.join(exportResult.latestDir, "manifest.json"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
