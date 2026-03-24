import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "snapshots"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-regressions lists recent unstable snapshots", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-3", stabilityOk: false, changedFieldsCount: 2, changedArtifactsCount: 1 },
          { name: "snap-2", stabilityOk: true, changedFieldsCount: 0, changedArtifactsCount: 0 },
          { name: "snap-1", stabilityOk: false, changedFieldsCount: 1, changedArtifactsCount: 0 },
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
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions.mjs"),
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
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /regressionCount: 1/);
    assert.match(text.stdout, /snap-3: fields=2, artifacts=1/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.snapshotCount, 3);
    assert.equal(parsed.regressionCount, 2);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.regressions[0].name, "snap-3");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions --check fails when regressions exist", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    path.join(baseDir, "snapshots", "index.json"),
    JSON.stringify(
      {
        snapshots: [{ name: "snap-1", stabilityOk: false, changedFieldsCount: 1 }],
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
          path.join(tempDir, "scripts", "social-recovery-smoke-regressions.mjs"),
          "--check",
          "--base-dir",
          baseDir,
        ],
        { cwd: tempDir, encoding: "utf8" }
      ),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stdout, /regressionCount: 1/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
