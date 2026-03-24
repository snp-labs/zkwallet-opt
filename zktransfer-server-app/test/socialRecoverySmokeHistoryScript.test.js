import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-history-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "snapshots"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-history.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-history.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-history prints stored history and JSON summary", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "history.md"),
    "# Social Recovery Smoke History\n\n- snapshots: 2\n- gateFailingSnapshots: 1\n- gateIssues: 2\n"
  );
  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          {
            name: "snap-2",
            snapshotDir: "/tmp/snap-2",
            changedFieldsCount: 2,
            changedArtifactsCount: 1,
            stabilityOk: false,
            regressionsGateOk: false,
            regressionsGateIssueCount: 2,
          },
          {
            name: "snap-1",
            snapshotDir: "/tmp/snap-1",
            changedFieldsCount: 0,
            changedArtifactsCount: 0,
            stabilityOk: true,
            regressionsGateOk: true,
            regressionsGateIssueCount: 0,
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
        path.join(tempDir, "scripts", "social-recovery-smoke-history.mjs"),
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
        path.join(tempDir, "scripts", "social-recovery-smoke-history.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /Social Recovery Smoke History/);
    assert.match(text.stdout, /gateFailingSnapshots: 1/);
    assert.match(text.stdout, /gateIssues: 2/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.snapshotCount, 2);
    assert.equal(parsed.gateFailingCount, 1);
    assert.equal(parsed.gateIssueCount, 2);
    assert.equal(parsed.snapshots[0].name, "snap-2");
    assert.equal(parsed.snapshots[0].changedFieldsCount, 2);
    assert.equal(parsed.snapshots[0].changedArtifactsCount, 1);
    assert.equal(parsed.snapshots[0].stabilityOk, false);
    assert.equal(parsed.snapshots[0].regressionsGateOk, false);
    assert.equal(parsed.snapshots[0].regressionsGateIssueCount, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-history filters stable and unstable snapshots", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-3", stabilityOk: false, regressionsGateOk: false, regressionsGateIssueCount: 2 },
          { name: "snap-2", stabilityOk: true, regressionsGateOk: true, regressionsGateIssueCount: 0 },
          { name: "snap-1", stabilityOk: false, regressionsGateOk: true, regressionsGateIssueCount: 1 },
        ],
      },
      null,
      2
    )
  );

  try {
    const stableJson = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-history.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--stable-only",
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );
    const unstableText = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-history.mjs"),
        "--base-dir",
        baseDir,
        "--unstable-only",
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );
    const gateFailingJson = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-history.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--gate-failing-only",
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    const parsed = JSON.parse(stableJson.stdout);
    const gateFailingParsed = JSON.parse(gateFailingJson.stdout);
    assert.equal(parsed.snapshotCount, 1);
    assert.equal(parsed.stableCount, 1);
    assert.equal(parsed.unstableCount, 0);
    assert.equal(parsed.gateFailingCount, 0);
    assert.equal(parsed.gateIssueCount, 0);
    assert.equal(parsed.filter, "stable-only");
    assert.equal(parsed.snapshots[0].name, "snap-2");
    assert.match(unstableText.stdout, /unstableSnapshots: 2/);
    assert.match(unstableText.stdout, /filter: unstable-only/);
    assert.equal(gateFailingParsed.snapshotCount, 1);
    assert.equal(gateFailingParsed.gateFailingCount, 1);
    assert.equal(gateFailingParsed.gateIssueCount, 2);
    assert.equal(gateFailingParsed.filter, "gate-failing-only");
    assert.equal(gateFailingParsed.snapshots[0].name, "snap-3");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
