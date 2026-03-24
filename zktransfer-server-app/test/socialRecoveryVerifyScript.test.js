import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-recovery-verify-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "bin"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-verify.mjs"),
    path.join(tempDir, "scripts", "social-recovery-verify.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  const fakeNpmPath = path.join(tempDir, "bin", "fake-npm.mjs");
  fs.writeFileSync(
    fakeNpmPath,
    `#!/usr/bin/env node
import fs from "node:fs";
const logPath = process.env.SOCIAL_RECOVERY_VERIFY_LOG_PATH;
const failOn = process.env.SOCIAL_RECOVERY_VERIFY_FAIL_ON || "";
const line = process.argv.slice(2).join(" ");
if (logPath) {
  fs.appendFileSync(logPath, line + "\\n");
}
if (failOn && line === failOn) {
  process.exit(7);
}
`,
    "utf8"
  );
  fs.chmodSync(fakeNpmPath, 0o755);
  return { tempDir, fakeNpmPath };
}

test("social-recovery:verify runs default phases in order", async () => {
  const { tempDir, fakeNpmPath } = createTempApp();
  const logPath = path.join(tempDir, "verify.log");

  try {
    const { stdout } = await execFileAsync(
      "node",
      [path.join(tempDir, "scripts", "social-recovery-verify.mjs")],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          SOCIAL_RECOVERY_VERIFY_NPM_BIN: fakeNpmPath,
          SOCIAL_RECOVERY_VERIFY_LOG_PATH: logPath,
        },
      }
    );

    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    assert.deepEqual(lines, ["test", "run social-recovery:smoke:regressions:summary"]);
    assert.match(stdout, /Full test suite/);
    assert.match(stdout, /Saved regressions summary/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery:verify runs local demo when requested", async () => {
  const { tempDir, fakeNpmPath } = createTempApp();
  const logPath = path.join(tempDir, "verify.log");

  try {
    await execFileAsync(
      "node",
      [path.join(tempDir, "scripts", "social-recovery-verify.mjs"), "--with-local-demo"],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          SOCIAL_RECOVERY_VERIFY_NPM_BIN: fakeNpmPath,
          SOCIAL_RECOVERY_VERIFY_LOG_PATH: logPath,
        },
      }
    );

    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    assert.deepEqual(lines, [
      "test",
      "run social-recovery:smoke:regressions:summary",
      "run social-recovery:local-demo -- --json",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery:verify returns failing exit code from a phase", async () => {
  const { tempDir, fakeNpmPath } = createTempApp();
  const logPath = path.join(tempDir, "verify.log");

  try {
    await assert.rejects(
      execFileAsync("node", [path.join(tempDir, "scripts", "social-recovery-verify.mjs")], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          SOCIAL_RECOVERY_VERIFY_NPM_BIN: fakeNpmPath,
          SOCIAL_RECOVERY_VERIFY_LOG_PATH: logPath,
          SOCIAL_RECOVERY_VERIFY_FAIL_ON: "run social-recovery:smoke:regressions:summary",
        },
      }),
      (error) => {
        assert.equal(error.code, 7);
        const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
        assert.deepEqual(lines, ["test", "run social-recovery:smoke:regressions:summary"]);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
