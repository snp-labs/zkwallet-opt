import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildExportBundle,
  collectSnapshotEntries,
  createSnapshotName,
  renderSnapshotHistory,
  resolveExportDir,
  updateExportIndex,
  writeExportArtifacts,
  writeExportBundle
} from "./zktransfer-ops-export.mjs";

test("buildExportBundle returns the expected export files", () => {
  const bundle = buildExportBundle(
    [
      {
        serviceName: "zktransfer-server-app",
        envExists: false
      }
    ],
    {
      generatedAt: "2026-03-23T12:15:00.000Z",
      overall: {
        configReady: false,
        healthReady: false,
        blockingIssueCount: 1,
        suggestedCommands: ["npm run setup:env"],
        primarySuggestedCommand: "npm run setup:env"
      },
      blockingIssues: ["missing .env"],
      services: [
        {
          serviceName: "zktransfer-server-app",
          appDir: "/tmp/server",
          envExists: false,
          unitExists: false,
          configReady: false,
          healthReady: false,
          missingDeps: [],
          blockingIssues: ["missing .env"],
          suggestedCommand: "npm run setup:env",
          suggestedCommandLine: 'cd "/tmp/server" && npm run setup:env'
        }
      ]
    }
  );

  assert.deepEqual(Object.keys(bundle).sort(), [
    "deployment-statuses.json",
    "next-root.txt",
    "next.txt",
    "plan.txt",
    "report.md",
    "summary.json",
    "summary.md"
  ]);
  assert.match(bundle["report.md"], /# zkTransfer Ops Report/);
  assert.match(bundle["next-root.txt"], /setup-env/);
});

test("resolveExportDir uses env override or falls back to the tmp path", () => {
  assert.equal(
    resolveExportDir({ ZKTRANSFER_OPS_EXPORT_DIR: "/tmp/custom-export" }),
    path.resolve("/tmp/custom-export")
  );
  assert.equal(
    resolveExportDir({}),
    path.join(os.tmpdir(), "zktransfer-ops-export")
  );
});

test("createSnapshotName normalizes timestamps for directory names", () => {
  assert.equal(
    createSnapshotName("2026-03-23T12:15:00.000Z"),
    "2026-03-23T12-15-00-000Z"
  );
});

test("writeExportBundle writes files and a manifest", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-export-test-"));
  const manifest = writeExportBundle(outputDir, {
    "summary.md": "# Summary\n",
    "next.txt": "bash /tmp/run\n"
  });

  assert.deepEqual(manifest.files, ["next.txt", "summary.md"]);
  assert.equal(fs.readFileSync(path.join(outputDir, "summary.md"), "utf8"), "# Summary\n");
  assert.equal(fs.readFileSync(path.join(outputDir, "next.txt"), "utf8"), "bash /tmp/run\n");

  const manifestFile = JSON.parse(fs.readFileSync(path.join(outputDir, "manifest.json"), "utf8"));
  assert.equal(manifestFile.outputDir, outputDir);
  assert.deepEqual(manifestFile.files, ["next.txt", "summary.md"]);
});

test("writeExportArtifacts writes both snapshot and latest directories", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-export-artifacts-"));
  const exportResult = writeExportArtifacts(
    baseDir,
    {
      "summary.md": "# Summary\n",
      "summary.json": `${JSON.stringify({
        overall: {
          configReady: false,
          healthReady: false,
          blockingIssueCount: 2
        },
        blockingIssues: ["missing .env"],
        services: []
      })}\n`,
      "next.txt": "bash /tmp/run\n"
    },
    {
      generatedAt: "2026-03-23T12:15:00.000Z",
      overall: {
        configReady: false,
        healthReady: false,
        blockingIssueCount: 2
      }
    }
  );

  assert.equal(exportResult.snapshotName, "2026-03-23T12-15-00-000Z");
  assert.equal(
    exportResult.snapshotDir,
    path.join(baseDir, "snapshots", "2026-03-23T12-15-00-000Z")
  );
  assert.equal(exportResult.latestDir, path.join(baseDir, "latest"));
  assert.equal(fs.readFileSync(path.join(exportResult.snapshotDir, "summary.md"), "utf8"), "# Summary\n");
  assert.equal(fs.readFileSync(path.join(exportResult.latestDir, "summary.md"), "utf8"), "# Summary\n");
  assert.ok(fs.existsSync(path.join(exportResult.snapshotDir, "compare.txt")));
  assert.ok(fs.existsSync(path.join(exportResult.snapshotDir, "compare.json")));
  assert.ok(fs.existsSync(path.join(exportResult.latestDir, "compare.txt")));
  assert.ok(fs.existsSync(path.join(exportResult.latestDir, "compare.json")));

  const latestManifest = JSON.parse(fs.readFileSync(path.join(exportResult.latestDir, "manifest.json"), "utf8"));
  const snapshotManifest = JSON.parse(
    fs.readFileSync(path.join(exportResult.snapshotDir, "manifest.json"), "utf8")
  );
  assert.equal(latestManifest.exportMode, "latest");
  assert.equal(snapshotManifest.exportMode, "snapshot");
  assert.equal(latestManifest.snapshotName, "2026-03-23T12-15-00-000Z");
  assert.equal(latestManifest.blockingIssueCount, 2);
  assert.equal(snapshotManifest.configReady, false);
  assert.ok(latestManifest.files.includes("compare.txt"));
  assert.ok(latestManifest.files.includes("compare.json"));
  assert.equal(exportResult.comparisonReport.status, "single");
  assert.equal(exportResult.exportIndex.entries.length, 1);
  assert.ok(fs.existsSync(exportResult.exportIndex.indexPath));
  assert.ok(fs.existsSync(exportResult.exportIndex.historyPath));
});

test("collectSnapshotEntries and updateExportIndex preserve latest-first history", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-export-index-"));
  const snapshotsDir = path.join(baseDir, "snapshots");
  const latestDir = path.join(baseDir, "latest");

  writeExportBundle(
    path.join(snapshotsDir, "2026-03-23T12-15-00-000Z"),
    { "summary.md": "# One\n" },
    {
      snapshotName: "2026-03-23T12-15-00-000Z",
      generatedAt: "2026-03-23T12:15:00.000Z",
      configReady: false,
      healthReady: false,
      blockingIssueCount: 2
    }
  );
  writeExportBundle(
    path.join(snapshotsDir, "2026-03-23T12-16-00-000Z"),
    { "summary.md": "# Two\n" },
    {
      snapshotName: "2026-03-23T12-16-00-000Z",
      generatedAt: "2026-03-23T12:16:00.000Z",
      configReady: true,
      healthReady: false,
      blockingIssueCount: 1
    }
  );

  const entries = collectSnapshotEntries(baseDir);
  assert.deepEqual(
    entries.map((entry) => entry.snapshotName),
    ["2026-03-23T12-16-00-000Z", "2026-03-23T12-15-00-000Z"]
  );

  const indexResult = updateExportIndex(baseDir, latestDir);
  const indexFile = JSON.parse(fs.readFileSync(indexResult.indexPath, "utf8"));
  assert.equal(indexFile[0].snapshotName, "2026-03-23T12-16-00-000Z");
  const historyText = fs.readFileSync(indexResult.historyPath, "utf8");
  assert.match(historyText, /# zkTransfer Ops Export History/);
  assert.match(historyText, /2026-03-23T12-16-00-000Z/);
});

test("renderSnapshotHistory includes latest dir and readiness summary", () => {
  const output = renderSnapshotHistory(
    [
      {
        snapshotName: "2026-03-23T12-16-00-000Z",
        generatedAt: "2026-03-23T12:16:00.000Z",
        snapshotDir: "/tmp/snapshots/2026-03-23T12-16-00-000Z",
        blockingIssueCount: 1,
        configReady: true,
        healthReady: false
      }
    ],
    "/tmp/latest"
  );

  assert.match(output, /Latest export: `\/tmp\/latest`/);
  assert.match(output, /ready: config=`true`, health=`false`, blockingIssues=`1`/);
});
