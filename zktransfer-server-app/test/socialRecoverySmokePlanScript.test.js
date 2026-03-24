import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-plan-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-plan.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-plan.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-overview-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-overview-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-plan-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-plan-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-plan starts with export when no report exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-plan.mjs"),
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
    assert.match(result.steps[0], /social-recovery:smoke:export/);
    assert.equal(result.steps[1], "npm run social-recovery:smoke:doctor");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-plan includes latest then export when compare is unavailable", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(path.join(latestDir, "report.md"), "# Latest Report\n");
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify({ snapshots: [{ name: "snap-1" }] }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-plan.mjs"),
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
    assert.equal(result.steps[0], "npm run social-recovery:smoke:latest");
    assert.match(result.steps[1], /social-recovery:smoke:export/);
    assert.equal(result.steps[2], "npm run social-recovery:smoke:doctor");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-plan prefers changes/overview/doctor when compare exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(path.join(latestDir, "report.md"), "# Latest Report\n");
  fs.writeFileSync(
    path.join(latestDir, "compare.json"),
    JSON.stringify({ changedFields: [{ label: "submitTransactionHash" }] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "checksums-compare.json"),
    JSON.stringify({ changedArtifacts: [{ path: "manifest.json" }] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1, addedSnapshotNames: ["snap-2"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      { snapshots: [{ name: "snap-2", stabilityOk: false }, { name: "snap-1", stabilityOk: true }] },
      null,
      2
    )
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-plan.mjs"),
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
    assert.deepEqual(result.steps, [
      "npm run social-recovery:smoke:regressions:changes",
      "npm run social-recovery:smoke:checksums:changes",
      "npm run social-recovery:smoke:changes",
      "npm run social-recovery:smoke:overview",
      "npm run social-recovery:smoke:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
