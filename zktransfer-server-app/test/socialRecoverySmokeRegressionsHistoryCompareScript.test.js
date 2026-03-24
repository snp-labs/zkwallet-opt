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
    path.join(os.tmpdir(), "zktransfer-social-regressions-history-compare-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(appDir, "scripts", "social-recovery-smoke-regressions-history-compare.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-compare.mjs")
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

test("social-recovery-smoke-regressions-history:compare summarizes latest two history bundles", async () => {
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
        snapshotCount: 3,
        stableCount: 1,
        unstableCount: 2,
        gateFailingCount: 2,
        gateIssueCount: 5,
        snapshots: [
          { name: "alpha", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 2 },
          { name: "beta", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0 },
          { name: "gamma", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 3 },
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
        snapshotCount: 3,
        stableCount: 2,
        unstableCount: 1,
        gateFailingCount: 1,
        gateIssueCount: 1,
        snapshots: [
          { name: "alpha", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0 },
          { name: "beta", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0 },
          { name: "legacy", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 1 },
        ],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-compare.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-compare.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /unstableCountDelta: 1/);
    assert.match(text.stdout, /gateFailingCountDelta: 1/);
    assert.match(text.stdout, /gateIssueCountDelta: 4/);
    assert.match(text.stdout, /worseningDetected: true/);
    assert.match(text.stdout, /addedUnstable: gamma/);
    assert.match(text.stdout, /addedGateFailing: gamma/);
    assert.match(text.stdout, /changedToUnstable: alpha/);
    assert.match(text.stdout, /changedToGateFailing: alpha/);
    assert.match(text.stdout, /added: gamma/);
    assert.match(text.stdout, /removed: legacy/);
    assert.match(text.stdout, /alpha: stable -> unstable/);
    assert.match(text.stdout, /alpha: passing -> failing/);

    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.latest.name, "snap-2");
    assert.equal(parsed.previous.name, "snap-1");
    assert.equal(parsed.unstableCountDelta, 1);
    assert.equal(parsed.gateFailingCountDelta, 1);
    assert.equal(parsed.gateIssueCountDelta, 4);
    assert.equal(parsed.worseningDetected, true);
    assert.equal(parsed.worseningSignalCount, 7);
    assert.equal(parsed.latest.gateIssueCount, 5);
    assert.equal(parsed.previous.gateIssueCount, 1);
    assert.deepEqual(parsed.addedSnapshotNames, ["gamma"]);
    assert.deepEqual(parsed.addedUnstableSnapshotNames, ["gamma"]);
    assert.deepEqual(parsed.addedGateFailingSnapshotNames, ["gamma"]);
    assert.deepEqual(parsed.changedToUnstableNames, ["alpha"]);
    assert.deepEqual(parsed.changedToGateFailingNames, ["alpha"]);
    assert.deepEqual(parsed.removedSnapshotNames, ["legacy"]);
    assert.deepEqual(parsed.unchangedSnapshotNames, ["beta"]);
    assert.deepEqual(parsed.changedStatuses, [
      { name: "alpha", previousStatus: "stable", latestStatus: "unstable" },
    ]);
    assert.deepEqual(parsed.changedGateStatuses, [
      { name: "alpha", previousGateStatus: "passing", latestGateStatus: "failing" },
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-history:compare supports explicit snapshot names", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const latestDir = path.join(snapshotsDir, "snap-3");
  const middleDir = path.join(snapshotsDir, "snap-2");
  const previousDir = path.join(snapshotsDir, "snap-1");

  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(middleDir, { recursive: true });
  fs.mkdirSync(previousDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-3", snapshotDir: latestDir },
          { name: "snap-2", snapshotDir: middleDir },
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
      { snapshotCount: 1, stableCount: 1, unstableCount: 0, gateFailingCount: 0, snapshots: [] },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(middleDir, "regressions-history.json"),
    JSON.stringify(
      {
        snapshotCount: 2,
        stableCount: 1,
        unstableCount: 1,
        gateFailingCount: 1,
        gateIssueCount: 2,
        snapshots: [],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(previousDir, "regressions-history.json"),
    JSON.stringify(
      {
        snapshotCount: 4,
        stableCount: 3,
        unstableCount: 1,
        gateFailingCount: 0,
        gateIssueCount: 5,
        snapshots: [],
      },
      null,
      2
    )
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-compare.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--latest-name",
        "snap-3",
        "--previous-name",
        "snap-1",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.latest.name, "snap-3");
    assert.equal(parsed.previous.name, "snap-1");
    assert.equal(parsed.snapshotCountDelta, -3);
    assert.equal(parsed.unstableCountDelta, -1);
    assert.equal(parsed.gateFailingCountDelta, 0);
    assert.equal(parsed.gateIssueCountDelta, -5);
    assert.equal(parsed.worseningDetected, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
