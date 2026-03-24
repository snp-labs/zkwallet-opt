import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-stability-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "snapshots"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-stability.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-stability.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-stability-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-stability-core.mjs")
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

test("social-recovery-smoke-stability succeeds for stable recent snapshots", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-3", changedFieldsCount: 0, changedArtifactsCount: 0 },
          { name: "snap-2", changedFieldsCount: 0, changedArtifactsCount: 0 },
          { name: "snap-1", changedFieldsCount: 1, changedArtifactsCount: 0 },
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
        path.join(tempDir, "scripts", "social-recovery-smoke-stability.mjs"),
        "--base-dir",
        baseDir,
        "--require-last-two",
        "--max-average-fields",
        "0.5",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-stability.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--require-last-two",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Social Recovery Smoke Stability/);
    assert.match(text.stdout, /ok: true/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.options.requireLastTwoStable, true);
    assert.equal(parsed.trend.lastTwoStable, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-stability fails when latest snapshots remain unstable", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", changedFieldsCount: 1, changedArtifactsCount: 0 },
          { name: "snap-1", changedFieldsCount: 0, changedArtifactsCount: 0 },
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
          path.join(tempDir, "scripts", "social-recovery-smoke-stability.mjs"),
          "--base-dir",
          baseDir,
          "--require-last-two",
        ],
        { cwd: tempDir, encoding: "utf8" }
      ),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stdout, /latest snapshot is not stable/);
        assert.match(error.stdout, /last two snapshots are not both stable/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
