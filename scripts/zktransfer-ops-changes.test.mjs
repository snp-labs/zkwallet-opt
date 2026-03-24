import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderLatestChanges, resolveLatestComparisonPaths } from "./zktransfer-ops-changes.mjs";

test("resolveLatestComparisonPaths returns compare artifact locations", () => {
  const paths = resolveLatestComparisonPaths("/tmp/zktransfer-ops-export");
  assert.equal(paths.latestDir, "/tmp/zktransfer-ops-export/latest");
  assert.equal(paths.compareTextPath, "/tmp/zktransfer-ops-export/latest/compare.txt");
  assert.equal(paths.compareJsonPath, "/tmp/zktransfer-ops-export/latest/compare.json");
});

test("renderLatestChanges returns the saved compare text when present", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-changes-"));
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  const compareTextPath = path.join(latestDir, "compare.txt");
  fs.writeFileSync(compareTextPath, "zkTransfer Ops Compare\nNo changes.\n");

  const output = renderLatestChanges({
    latestDir,
    compareTextPath,
    compareJsonPath: path.join(latestDir, "compare.json")
  });

  assert.equal(output, "zkTransfer Ops Compare\nNo changes.\n");
});

test("renderLatestChanges explains how to create an export when compare artifacts are missing", () => {
  const output = renderLatestChanges({
    latestDir: "/tmp/missing/latest",
    compareTextPath: "/tmp/missing/latest/compare.txt",
    compareJsonPath: "/tmp/missing/latest/compare.json"
  });

  assert.match(output, /zkTransfer Ops Changes/);
  assert.match(output, /No latest comparison artifact found/);
  assert.match(output, /scripts\/zktransfer-ops\.sh export/);
});
