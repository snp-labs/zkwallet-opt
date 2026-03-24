import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderLatestReport, resolveLatestPaths } from "./zktransfer-ops-latest.mjs";

test("resolveLatestPaths returns latest artifact locations", () => {
  const paths = resolveLatestPaths("/tmp/zktransfer-ops-export");
  assert.equal(paths.latestDir, "/tmp/zktransfer-ops-export/latest");
  assert.equal(paths.reportPath, "/tmp/zktransfer-ops-export/latest/report.md");
  assert.equal(paths.summaryPath, "/tmp/zktransfer-ops-export/latest/summary.md");
  assert.equal(paths.manifestPath, "/tmp/zktransfer-ops-export/latest/manifest.json");
});

test("renderLatestReport returns the saved report when it exists", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-latest-"));
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  const reportPath = path.join(latestDir, "report.md");
  fs.writeFileSync(reportPath, "# Saved Report\n");

  const output = renderLatestReport({
    latestDir,
    reportPath,
    summaryPath: path.join(latestDir, "summary.md"),
    manifestPath: path.join(latestDir, "manifest.json")
  });

  assert.equal(output, "# Saved Report\n");
});

test("renderLatestReport explains how to create an export when none exists", () => {
  const output = renderLatestReport({
    latestDir: "/tmp/missing/latest",
    reportPath: "/tmp/missing/latest/report.md",
    summaryPath: "/tmp/missing/latest/summary.md",
    manifestPath: "/tmp/missing/latest/manifest.json"
  });

  assert.match(output, /zkTransfer Ops Latest/);
  assert.match(output, /No latest exported report found/);
  assert.match(output, /scripts\/zktransfer-ops\.sh export/);
});
