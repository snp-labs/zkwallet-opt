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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-doctor-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-doctor.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-doctor.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-overview-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-overview-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-bundle-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-bundle-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

function seedSnapshot(snapshotDir) {
  fs.mkdirSync(snapshotDir, { recursive: true });
  for (const fileName of [
    "manifest.json",
    "report.md",
    "result.json",
    "input.redacted.json",
    "compare.txt",
    "compare.json",
    "changes.txt",
    "changes.json",
    "trend.txt",
    "trend.json",
    "stability.txt",
    "stability.json",
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
    "regressions-integrity.txt",
    "regressions-integrity.json",
    "checksums-compare.txt",
    "checksums-compare.json",
    "overview.md",
    "overview.json",
    "plan.txt",
    "plan.json",
    "summary.md",
    "summary.json",
    "next.txt",
  ]) {
    const contents = fileName.endsWith(".json") ? "{}" : `${fileName}\n`;
    fs.writeFileSync(path.join(snapshotDir, fileName), contents);
  }
  writeChecksums(snapshotDir);
}

function writeChecksums(snapshotDir) {
  const checksumTargets = [
    "manifest.json",
    "report.md",
    "result.json",
    "input.redacted.json",
    "compare.txt",
    "compare.json",
    "changes.txt",
    "changes.json",
    "trend.txt",
    "trend.json",
    "stability.txt",
    "stability.json",
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
    "regressions-integrity.txt",
    "regressions-integrity.json",
    "checksums-compare.txt",
    "checksums-compare.json",
    "overview.md",
    "overview.json",
    "plan.txt",
    "plan.json",
    "summary.md",
    "summary.json",
    "next.txt",
  ];
  const checksums = checksumTargets.map((fileName) => ({
    path: fileName,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(snapshotDir, fileName)))
      .digest("hex"),
  }));
  fs.writeFileSync(
    path.join(snapshotDir, "checksums.json"),
    JSON.stringify({ files: checksums }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "checksums.txt"),
    checksums.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n")
  );
}

test("social-recovery-smoke-doctor succeeds for a complete saved export bundle", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const snapshotDir = path.join(snapshotsDir, "snap-1");
  seedSnapshot(latestDir);
  seedSnapshot(snapshotDir);
  fs.writeFileSync(
    path.join(latestDir, "manifest.json"),
    JSON.stringify({ accountId: "account-1" }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "compare.json"),
    JSON.stringify({ changedFields: [], unchangedFields: ["accountId"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "stability.json"),
    JSON.stringify({ ok: true, reasons: [] }, null, 2)
  );
  writeChecksums(latestDir);
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify({ snapshots: [{ name: "snap-1", snapshotDir }] }, null, 2)
  );
  fs.writeFileSync(path.join(baseDir, "history.md"), "# history\n");
  fs.writeFileSync(
    path.join(baseDir, "export-manifest.json"),
    JSON.stringify({ latestIndexPath: path.join(snapshotsDir, "index.json") }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-doctor.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );
    const result = JSON.parse(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.integrity.ok, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-doctor fails when saved export artifacts are incomplete", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    await assert.rejects(
      execFileAsync(
        "node",
        [
          path.join(tempDir, "scripts", "social-recovery-smoke-doctor.mjs"),
          "--json",
          "--base-dir",
          baseDir,
        ],
        {
          cwd: tempDir,
          encoding: "utf8",
        }
      ),
      (error) => {
        const result = JSON.parse(error.stdout);
        assert.equal(result.ok, false);
        assert.equal(result.integrity.ok, false);
        assert.match(result.nextCommand, /social-recovery:smoke:export/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
