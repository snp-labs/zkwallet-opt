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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-verify-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "verify-deployment.sh"),
    path.join(tempDir, "scripts", "verify-deployment.sh")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "check-runtime-deps.sh"),
    path.join(tempDir, "scripts", "check-runtime-deps.sh")
  );
  return tempDir;
}

function createFakeBin() {
  const tempBin = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-verify-bin-"));
  writeExecutable(
    path.join(tempBin, "sudo"),
    "#!/usr/bin/env bash\nexec \"$@\"\n"
  );
  writeExecutable(
    path.join(tempBin, "systemctl"),
    [
      "#!/usr/bin/env bash",
      "if [[ \"$1\" == \"is-active\" ]]; then",
      "  exit 0",
      "fi",
      "echo unknown command >&2",
      "exit 1"
    ].join("\n") + "\n"
  );
  writeExecutable(
    path.join(tempBin, "curl"),
    "#!/usr/bin/env bash\nprintf '%s' \"${FAKE_CURL_RESPONSE}\"\n"
  );
  return tempBin;
}

test("verify:deployment succeeds when health reports pinned proof-input policy", () => {
  const tempDir = createTempApp();
  const tempBin = createFakeBin();
  fs.writeFileSync(
    path.join(tempDir, ".env"),
    ["HOST=127.0.0.1", "PORT=4010"].join("\n")
  );

  try {
    const stdout = execFileSync("bash", [path.join(tempDir, "scripts", "verify-deployment.sh")], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${tempBin}:${process.env.PATH}`,
        FAKE_CURL_RESPONSE: JSON.stringify({
          ready: true,
          jwtSecretConfigured: true,
          usingDefaultJwtSecret: false,
          usingPlaceholderJwtSecret: false,
          allowLegacyProofInputs: false,
          proofInputPolicyPinned: true,
          checks: {
            proofBinaryExists: true,
            proofInputBuilderExists: true,
            jwtSecretConfigured: true,
            proofInputPolicyPinned: true
          }
        })
      }
    });

    assert.match(stdout, /"ready": true/);
    assert.match(stdout, /"proofInputPolicyPinned": true/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});

test("verify:deployment fails when proof-input policy is not pinned", () => {
  const tempDir = createTempApp();
  const tempBin = createFakeBin();
  fs.writeFileSync(
    path.join(tempDir, ".env"),
    ["HOST=127.0.0.1", "PORT=4010"].join("\n")
  );

  try {
    assert.throws(
      () =>
        execFileSync("bash", [path.join(tempDir, "scripts", "verify-deployment.sh")], {
          cwd: tempDir,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${tempBin}:${process.env.PATH}`,
            HEALTH_RETRY_COUNT: "1",
            FAKE_CURL_RESPONSE: JSON.stringify({
              ready: true,
              jwtSecretConfigured: true,
              usingDefaultJwtSecret: false,
              usingPlaceholderJwtSecret: false,
              allowLegacyProofInputs: true,
              proofInputPolicyPinned: false,
              checks: {
                proofBinaryExists: true,
                proofInputBuilderExists: true,
                jwtSecretConfigured: true,
                proofInputPolicyPinned: false
              }
            })
          },
          stdio: "pipe"
        }),
      (error) => {
        assert.match(error.stderr, /ALLOW_LEGACY_PROOF_INPUTS must be pinned to 0/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});
