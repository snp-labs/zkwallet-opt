import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const scriptPath = "/Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-run.sh";

function createTempApp(rootDir, name) {
  const appDir = path.join(rootDir, name);
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(
    path.join(appDir, "package.json"),
    JSON.stringify({ name, scripts: {} }, null, 2)
  );
  return appDir;
}

function createFakeNpm(binDir) {
  const fakeNpmPath = path.join(binDir, "npm");
  fs.writeFileSync(
    fakeNpmPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s|%s\\n' "$PWD" "$*" >> "\${NPM_LOG:?}"
if [[ -n "\${FAIL_APP_DIR_BASENAME:-}" && "$PWD" == *"/\${FAIL_APP_DIR_BASENAME}" ]]; then
  exit 2
fi
`,
    { mode: 0o755 }
  );
}

test("zktransfer-ops-run executes the requested npm script in both service directories", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-run-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const serverDir = createTempApp(tempDir, "server-app");
  const platformDir = createTempApp(tempDir, "platform-server-app");
  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "deployment:status"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath,
      ZKTRANSFER_SERVER_APP_DIR: serverDir,
      ZKTRANSFER_PLATFORM_SERVER_APP_DIR: platformDir
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    `${serverDir}|run deployment:status`,
    `${platformDir}|run deployment:status`
  ]);
});

test("zktransfer-ops-run continues after one failure and exits non-zero", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-run-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const serverDir = createTempApp(tempDir, "server-app");
  const platformDir = createTempApp(tempDir, "platform-server-app");
  const logPath = path.join(tempDir, "npm.log");

  let error;
  try {
    execFileSync("bash", [scriptPath, "check:ready"], {
      cwd: "/Users/hyunokoh/Documents/zkWallet",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        NPM_LOG: logPath,
        FAIL_APP_DIR_BASENAME: path.basename(platformDir),
        ZKTRANSFER_SERVER_APP_DIR: serverDir,
        ZKTRANSFER_PLATFORM_SERVER_APP_DIR: platformDir
      },
      encoding: "utf8",
      stdio: "pipe"
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert.ok(error);
  assert.equal(error.status, 1);

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    `${serverDir}|run check:ready`,
    `${platformDir}|run check:ready`
  ]);
  assert.match(error.stderr, /zktransfer-custody-platform-server: command failed/);
});

test("zktransfer-ops-run rejects unsupported commands", () => {
  let error;
  try {
    execFileSync("bash", [scriptPath, "install:systemd"], {
      cwd: "/Users/hyunokoh/Documents/zkWallet",
      encoding: "utf8",
      stdio: "pipe"
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert.ok(error);
  assert.equal(error.status, 1);
  assert.match(error.stderr, /Allowed commands:/);
});
