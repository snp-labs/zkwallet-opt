import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "zktransfer-social-regressions-integrity-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  for (const fileName of [
    "social-recovery-smoke-regressions-integrity.mjs",
    "social-recovery-smoke-regressions-integrity-core.mjs",
    "social-recovery-smoke-bundle-core.mjs",
  ]) {
    fs.copyFileSync(
      path.join(process.cwd(), "scripts", fileName),
      path.join(tempDir, "scripts", fileName)
    );
  }
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

function seedRegressionBundle(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const files = [
    "regressions.txt",
    "regressions.json",
    "regressions-history.txt",
    "regressions-history.json",
    "regressions-history-gate-failing.txt",
    "regressions-history-gate-failing.json",
    "regressions-history-gate-failing-compare.txt",
    "regressions-history-gate-failing-compare.json",
    "regressions-history-gate-failing-compare-check.txt",
    "regressions-history-gate-failing-compare-check.json",
    "regressions-history-compare.txt",
    "regressions-history-compare.json",
    "regressions-history-compare-check.txt",
    "regressions-history-compare-check.json",
    "regressions-compare.txt",
    "regressions-compare.json",
    "regressions-changes.txt",
    "regressions-changes.json",
    "regressions-status.txt",
    "regressions-status.json",
    "regressions-overview.md",
    "regressions-overview.json",
    "regressions-next.txt",
    "regressions-plan.txt",
    "regressions-plan.json",
    "regressions-summary.md",
    "regressions-summary.json",
    "regressions-doctor.txt",
    "regressions-doctor.json",
    "regressions-gate.txt",
    "regressions-gate.json",
    "regressions-report.md",
    "regressions-report.json",
  ];
  for (const fileName of files) {
    fs.writeFileSync(path.join(dir, fileName), fileName.endsWith(".json") ? "{}" : `${fileName}\n`);
  }
  const checksums = files.map((fileName) => ({
    path: fileName,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(dir, fileName)))
      .digest("hex"),
  }));
  fs.writeFileSync(
    path.join(dir, "checksums.json"),
    JSON.stringify({ files: checksums }, null, 2)
  );
}

test("social-recovery-smoke-regressions-integrity passes for a complete regression sub-bundle", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const snapshotDir = path.join(snapshotsDir, "snap-1");
  seedRegressionBundle(latestDir);
  seedRegressionBundle(snapshotDir);
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify({ snapshots: [{ name: "snap-1", snapshotDir }] }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-integrity.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.issues.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-integrity fails when regression sub-bundle is incomplete", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(path.join(latestDir, "regressions.json"), "{}");

  try {
    await assert.rejects(
      execFileAsync(
        "node",
        [
          path.join(tempDir, "scripts", "social-recovery-smoke-regressions-integrity.mjs"),
          "--json",
          "--base-dir",
          baseDir,
        ],
        { cwd: tempDir, encoding: "utf8" }
      ),
      (error) => {
        const parsed = JSON.parse(error.stdout);
        assert.equal(parsed.ok, false);
        assert.match(parsed.issues.join("\n"), /regression bundle is missing files|snapshots\/index\.json/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
