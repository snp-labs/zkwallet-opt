import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-trend-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "snapshots"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-trend.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-trend.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-trend-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-trend-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-trend summarizes recent change counts", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-3", changedFieldsCount: 0, changedArtifactsCount: 0 },
          { name: "snap-2", changedFieldsCount: 1, changedArtifactsCount: 2 },
          { name: "snap-1", changedFieldsCount: 3, changedArtifactsCount: 1 },
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
        path.join(tempDir, "scripts", "social-recovery-smoke-trend.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-trend.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--window",
        "2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Social Recovery Smoke Trend/);
    assert.match(text.stdout, /latestStable: true/);
    assert.match(text.stdout, /snap-3: fields=0, artifacts=0/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.snapshotCount, 3);
    assert.equal(parsed.windowSize, 2);
    assert.equal(parsed.latestSnapshotName, "snap-3");
    assert.equal(parsed.previousSnapshotName, "snap-2");
    assert.equal(parsed.latestStable, true);
    assert.equal(parsed.lastTwoStable, false);
    assert.equal(parsed.averageChangedFieldsCount, 0.5);
    assert.equal(parsed.averageChangedArtifactsCount, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
