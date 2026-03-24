import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-next-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-next.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-next.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-next recommends export when no saved report exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-next.mjs"),
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /social-recovery:smoke:export/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.hasLatestReport, false);
    assert.match(parsed.command, /social-recovery:smoke:export/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-next recommends changes when compare output exists", async () => {
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
        path.join(tempDir, "scripts", "social-recovery-smoke-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.snapshotCount, 2);
    assert.equal(parsed.recentRegressionCount, 1);
    assert.equal(parsed.hasCompare, true);
    assert.equal(parsed.hasChecksumsCompare, true);
    assert.equal(parsed.hasRegressionsCompare, true);
    assert.equal(parsed.command, "npm run social-recovery:smoke:regressions:changes");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
