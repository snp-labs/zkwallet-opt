import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-doctor-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-doctor.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-doctor.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-doctor succeeds when regression artifacts are aligned", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-changes.json"),
    JSON.stringify({ regressions: { regressionCount: 1 } }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-doctor.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.nextCommand, "npm run social-recovery:smoke:regressions:changes");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-doctor fails when unstable regression artifacts are incomplete", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );

  try {
    await assert.rejects(
      execFileAsync(
        "node",
        [
          path.join(tempDir, "scripts", "social-recovery-smoke-regressions-doctor.mjs"),
          "--json",
          "--base-dir",
          baseDir,
        ],
        { cwd: tempDir, encoding: "utf8" }
      ),
      (error) => {
        const parsed = JSON.parse(error.stdout);
        assert.equal(parsed.ok, false);
        assert.match(parsed.issues.join("\n"), /regressions-changes\.json|regressions-compare\.json/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-doctor fails when saved regression integrity reports issues", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 0 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-integrity.json"),
    JSON.stringify({ ok: false, issues: ["checksum mismatch"] }, null, 2)
  );

  try {
    await assert.rejects(
      execFileAsync(
        "node",
        [
          path.join(tempDir, "scripts", "social-recovery-smoke-regressions-doctor.mjs"),
          "--json",
          "--base-dir",
          baseDir,
        ],
        { cwd: tempDir, encoding: "utf8" }
      ),
      (error) => {
        const parsed = JSON.parse(error.stdout);
        assert.equal(parsed.ok, false);
        assert.match(parsed.issues.join("\n"), /regressions-integrity\.json reports integrity issues/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
