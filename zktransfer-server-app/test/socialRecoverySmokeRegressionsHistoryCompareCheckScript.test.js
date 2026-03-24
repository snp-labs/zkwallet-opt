import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

function createTempApp() {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "zktransfer-social-regressions-history-compare-check-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(appDir, "scripts", "social-recovery-smoke-regressions-history-compare-check.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-compare-check.mjs")
  );
  fs.copyFileSync(
    path.join(
      appDir,
      "scripts",
      "social-recovery-smoke-regressions-history-compare-core.mjs"
    ),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-compare-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-regressions-history:compare:check fails on worsening unstable history", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const latestDir = path.join(snapshotsDir, "snap-2");
  const previousDir = path.join(snapshotsDir, "snap-1");

  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(previousDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", snapshotDir: latestDir },
          { name: "snap-1", snapshotDir: previousDir },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify(
      {
        snapshotCount: 2,
        stableCount: 0,
        unstableCount: 2,
        gateFailingCount: 2,
        gateIssueCount: 5,
        snapshots: [
          { name: "alpha", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 3 },
          { name: "beta", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 2 },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(previousDir, "regressions-history.json"),
    JSON.stringify(
      {
        snapshotCount: 2,
        stableCount: 1,
        unstableCount: 1,
        gateFailingCount: 1,
        gateIssueCount: 1,
        snapshots: [
          { name: "alpha", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0 },
          { name: "beta", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 1 },
        ],
      },
      null,
      2
    )
  );

  try {
    await assert.rejects(
      execFileAsync(
        "node",
        [
          path.join(
            tempDir,
            "scripts",
            "social-recovery-smoke-regressions-history-compare-check.mjs"
          ),
          "--json",
          "--base-dir",
          baseDir,
        ],
        { cwd: tempDir, encoding: "utf8" }
      ),
      (error) => {
        const parsed = JSON.parse(error.stdout);
        assert.equal(parsed.ok, false);
        assert.equal(parsed.issueCount, 5);
        assert.match(parsed.issues[0], /unstable snapshot count increased/);
        assert.match(parsed.issues[1], /flipped to unstable: alpha/);
        assert.match(parsed.issues[2], /gate-failing snapshot count increased/);
        assert.match(parsed.issues[3], /gate issue count increased by 4/);
        assert.match(parsed.issues[4], /flipped to gate-failing: alpha/);
        assert.equal(parsed.gateIssueCountDelta, 4);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-history:compare:check passes when instability improves", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const latestDir = path.join(snapshotsDir, "snap-2");
  const previousDir = path.join(snapshotsDir, "snap-1");

  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(previousDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", snapshotDir: latestDir },
          { name: "snap-1", snapshotDir: previousDir },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify(
      {
        snapshotCount: 2,
        stableCount: 2,
        unstableCount: 0,
        gateFailingCount: 0,
        gateIssueCount: 0,
        snapshots: [
          { name: "alpha", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0 },
          { name: "beta", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0 },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(previousDir, "regressions-history.json"),
    JSON.stringify(
      {
        snapshotCount: 2,
        stableCount: 1,
        unstableCount: 1,
        gateFailingCount: 1,
        gateIssueCount: 2,
        snapshots: [
          { name: "alpha", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 2 },
          { name: "beta", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0 },
        ],
      },
      null,
      2
    )
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-compare-check.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.issueCount, 0);
    assert.equal(parsed.worseningDetected, false);
    assert.equal(parsed.gateIssueCountDelta, -2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
