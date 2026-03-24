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
    path.join(os.tmpdir(), "zktransfer-social-regressions-history-gate-failing-compare-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(
      appDir,
      "scripts",
      "social-recovery-smoke-regressions-history-gate-failing-compare.mjs"
    ),
    path.join(
      tempDir,
      "scripts",
      "social-recovery-smoke-regressions-history-gate-failing-compare.mjs"
    )
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

test("social-recovery-smoke-regressions-history:gate-failing:compare summarizes latest two gate-failing history bundles", async () => {
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
    path.join(latestDir, "regressions-history-gate-failing.json"),
    JSON.stringify(
      {
        snapshotCount: 2,
        stableCount: 0,
        unstableCount: 2,
        gateFailingCount: 2,
        gateIssueCount: 5,
        gateFailingOnly: true,
        snapshots: [
          { name: "alpha", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 2 },
          { name: "gamma", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 3 },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(previousDir, "regressions-history-gate-failing.json"),
    JSON.stringify(
      {
        snapshotCount: 1,
        stableCount: 1,
        unstableCount: 0,
        gateFailingCount: 1,
        gateIssueCount: 1,
        gateFailingOnly: true,
        snapshots: [{ name: "alpha", stabilityOk: true, regressionsGateOk: false, regressionsGateIssueCount: 1 }],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-compare.mjs"
        ),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-compare.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Gate-Failing History Compare/);
    assert.match(text.stdout, /gateFailingCountDelta: 1/);
    assert.match(text.stdout, /gateIssueCountDelta: 4/);
    assert.match(text.stdout, /addedGateFailing: gamma/);
    assert.match(text.stdout, /changedToUnstable: alpha/);

    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.gateFailingCountDelta, 1);
    assert.equal(parsed.gateIssueCountDelta, 4);
    assert.deepEqual(parsed.addedGateFailingSnapshotNames, ["gamma"]);
    assert.deepEqual(parsed.changedToUnstableNames, ["alpha"]);
    assert.equal(parsed.worseningDetected, true);
    assert.equal(parsed.worseningSignalCount, 6);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
