import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
}

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-install-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "deploy", "systemd"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "install-systemd-service.sh"),
    path.join(tempDir, "scripts", "install-systemd-service.sh")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "check-runtime-deps.sh"),
    path.join(tempDir, "scripts", "check-runtime-deps.sh")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "ensure-jwt-secret.sh"),
    path.join(tempDir, "scripts", "ensure-jwt-secret.sh")
  );
  fs.copyFileSync(
    path.join(process.cwd(), ".env.example"),
    path.join(tempDir, ".env.example")
  );
  fs.writeFileSync(
    path.join(tempDir, "deploy", "systemd", "zktransfer-server-app.service"),
    "[Unit]\nDescription=test\n"
  );
  return tempDir;
}

function createFakeBin(logPath) {
  const tempBin = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-install-bin-"));
  writeExecutable(
    path.join(tempBin, "npm"),
    [
      "#!/usr/bin/env bash",
      "echo \"$*\" >> \"$FAKE_NPM_LOG\"",
      "if [[ \"$1 $2\" == \"run check:ready\" ]]; then",
      "  exit 0",
      "fi",
      "echo unexpected npm invocation >&2",
      "exit 1"
    ].join("\n") + "\n"
  );
  writeExecutable(path.join(tempBin, "curl"), "#!/usr/bin/env bash\nexit 0\n");
  writeExecutable(
    path.join(tempBin, "sudo"),
    "#!/usr/bin/env bash\necho sudo-called >> \"$FAKE_NPM_LOG\"\nexit 99\n"
  );
  writeExecutable(
    path.join(tempBin, "systemctl"),
    "#!/usr/bin/env bash\necho systemctl-called >> \"$FAKE_NPM_LOG\"\nexit 99\n"
  );
  return tempBin;
}

test("install:systemd dry-run stops before sudo/systemctl and still runs prechecks", () => {
  const tempDir = createTempApp();
  const logPath = path.join(tempDir, "npm.log");
  const tempBin = createFakeBin(logPath);
  const envPath = path.join(tempDir, ".env");
  fs.writeFileSync(
    envPath,
    ["JWT_SECRET=test-secret", "ALLOW_LEGACY_PROOF_INPUTS=0"].join("\n")
  );

  try {
    const envBefore = fs.readFileSync(envPath, "utf8");
    const stdout = execFileSync("bash", [path.join(tempDir, "scripts", "install-systemd-service.sh")], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${tempBin}:${process.env.PATH}`,
        INSTALL_SYSTEMD_DRY_RUN: "1",
        FAKE_NPM_LOG: logPath
      }
    });

    const log = fs.readFileSync(logPath, "utf8");
    assert.match(log, /run check:ready/);
    assert.doesNotMatch(log, /sudo-called/);
    assert.doesNotMatch(log, /systemctl-called/);
    assert.match(stdout, /dry-run enabled/);
    assert.match(stdout, /not modifying/);
    assert.match(stdout, /using existing \.env for readiness precheck/);
    assert.match(stdout, /would copy/);
    assert.equal(fs.readFileSync(envPath, "utf8"), envBefore);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});

test("install:systemd dry-run does not run readiness when .env is missing", () => {
  const tempDir = createTempApp();
  const logPath = path.join(tempDir, "npm.log");
  const tempBin = createFakeBin(logPath);

  try {
    const stdout = execFileSync("bash", [path.join(tempDir, "scripts", "install-systemd-service.sh")], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${tempBin}:${process.env.PATH}`,
        INSTALL_SYSTEMD_DRY_RUN: "1",
        FAKE_NPM_LOG: logPath
      }
    });

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
    assert.equal(log, "");
    assert.match(stdout, /dry-run: \.env is missing; run npm run setup:env/);
    assert.match(stdout, /skipping unit installation and deployment verification/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});
