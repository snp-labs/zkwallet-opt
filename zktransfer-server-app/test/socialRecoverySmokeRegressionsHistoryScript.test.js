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
    path.join(os.tmpdir(), "zktransfer-social-regressions-history-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "snapshots"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(appDir, "scripts", "social-recovery-smoke-regressions-history.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history.mjs")
  );
  fs.copyFileSync(
    path.join(appDir, "scripts", "social-recovery-smoke-regressions-history-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-regressions-history prints recent regression timeline", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          {
            name: "snap-4",
            stabilityOk: false,
            regressionsGateOk: false,
            regressionsGateIssueCount: 2,
            changedFieldsCount: 3,
            changedArtifactsCount: 2,
            submitTransactionHash: "0xaaa",
          },
          {
            name: "snap-3",
            stabilityOk: true,
            regressionsGateOk: true,
            regressionsGateIssueCount: 0,
            changedFieldsCount: 0,
            changedArtifactsCount: 0,
          },
          {
            name: "snap-2",
            stabilityOk: false,
            regressionsGateOk: true,
            regressionsGateIssueCount: 1,
            changedFieldsCount: 1,
            changedArtifactsCount: 1,
            submitTransactionHash: "0xbbb",
          },
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
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history.mjs"),
        "--base-dir",
        baseDir,
        "--window",
        "2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /recentSnapshotCount: 2/);
    assert.match(text.stdout, /snap-4: status=unstable/);
    assert.match(text.stdout, /snap-4: status=unstable, gate=fail/);
    assert.match(text.stdout, /gateIssues=2/);
    assert.match(text.stdout, /snap-3: status=stable/);
    assert.match(text.stdout, /gateFailingCount: 1/);
    assert.match(text.stdout, /gateIssueCount: 2/);

    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.windowSize, 10);
    assert.equal(parsed.recentSnapshotCount, 3);
    assert.equal(parsed.snapshotCount, 3);
    assert.equal(parsed.stableCount, 1);
    assert.equal(parsed.unstableCount, 2);
    assert.equal(parsed.gateFailingCount, 1);
    assert.equal(parsed.gateIssueCount, 3);
    assert.equal(parsed.snapshots[0].name, "snap-4");
    assert.equal(parsed.snapshots[0].regressionsGateOk, false);
    assert.equal(parsed.snapshots[0].regressionsGateIssueCount, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-history supports unstable-only filtering", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-3", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 2, changedFieldsCount: 2 },
          { name: "snap-2", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0, changedFieldsCount: 0 },
          { name: "snap-1", stabilityOk: false, regressionsGateOk: true, regressionsGateIssueCount: 1, changedFieldsCount: 1 },
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
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--unstable-only",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.unstableOnly, true);
    assert.equal(parsed.snapshotCount, 2);
    assert.equal(parsed.stableCount, 0);
    assert.equal(parsed.unstableCount, 2);
    assert.equal(parsed.gateFailingCount, 1);
    assert.equal(parsed.gateIssueCount, 3);
    assert.deepEqual(
      parsed.snapshots.map((snapshot) => snapshot.name),
      ["snap-3", "snap-1"]
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-history supports gate-failing-only filtering", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-3", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 2, changedFieldsCount: 2 },
          { name: "snap-2", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0, changedFieldsCount: 0 },
          { name: "snap-1", stabilityOk: false, regressionsGateOk: true, regressionsGateIssueCount: 1, changedFieldsCount: 1 },
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
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--gate-failing-only",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.unstableOnly, false);
    assert.equal(parsed.gateFailingOnly, true);
    assert.equal(parsed.snapshotCount, 1);
    assert.equal(parsed.gateFailingCount, 1);
    assert.equal(parsed.gateIssueCount, 2);
    assert.deepEqual(
      parsed.snapshots.map((snapshot) => snapshot.name),
      ["snap-3"]
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
