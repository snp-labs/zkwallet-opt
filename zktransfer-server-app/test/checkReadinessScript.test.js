import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-ready-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src", "lib"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src", "services"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "check-readiness.mjs"),
    path.join(tempDir, "scripts", "check-readiness.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "src", "config.js"),
    path.join(tempDir, "src", "config.js")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "src", "lib", "oidc.js"),
    path.join(tempDir, "src", "lib", "oidc.js")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "src", "lib", "socialRecoveryStatus.js"),
    path.join(tempDir, "src", "lib", "socialRecoveryStatus.js")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "src", "services", "zkpasskeyService.js"),
    path.join(tempDir, "src", "services", "zkpasskeyService.js")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("check:ready succeeds with pinned proof-input policy and configured JWT secret", () => {
  const tempDir = createTempApp();
  const proofBinaryPath = path.join(tempDir, "prove_zkwallet_from_input");
  const proofInputBuilderPath = path.join(tempDir, "build_zkwallet_demo_input");
  fs.writeFileSync(proofBinaryPath, "");
  fs.writeFileSync(proofInputBuilderPath, "");
  fs.writeFileSync(
    path.join(tempDir, ".env"),
    [
      "JWT_SECRET=test-secret",
      "ALLOW_LEGACY_PROOF_INPUTS=0",
      `PROOF_BINARY_PATH=${proofBinaryPath}`,
      `PROOF_INPUT_BUILDER_PATH=${proofInputBuilderPath}`
    ].join("\n")
  );

  try {
    const stdout = execFileSync("node", [path.join(tempDir, "scripts", "check-readiness.mjs")], {
      cwd: tempDir,
      encoding: "utf8"
    });
    const body = JSON.parse(stdout);

    assert.equal(body.app, "zktransfer-server-app");
    assert.equal(body.ready, true);
    assert.equal(body.jwtSecretConfigured, true);
    assert.equal(body.proofInputPolicyPinned, true);
    assert.equal(body.socialRecoveryReady, false);
    assert.deepEqual(body.checks, {
      proofBinaryExists: true,
      proofInputBuilderExists: true,
      jwtSecretConfigured: true,
      proofInputPolicyPinned: true
    });
    assert.deepEqual(body.socialRecoveryChecks, {
      zkpasskeyNapiAvailable: false,
      zkpasskeyRelayerConfigured: false,
      zkpasskeyPkExists: false,
      zkpasskeyRecoveryFundingConfigured: false
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("check:ready fails when legacy proof-input policy is not pinned", () => {
  const tempDir = createTempApp();
  const proofBinaryPath = path.join(tempDir, "prove_zkwallet_from_input");
  const proofInputBuilderPath = path.join(tempDir, "build_zkwallet_demo_input");
  fs.writeFileSync(proofBinaryPath, "");
  fs.writeFileSync(proofInputBuilderPath, "");
  fs.writeFileSync(
    path.join(tempDir, ".env"),
    [
      "JWT_SECRET=test-secret",
      "ALLOW_LEGACY_PROOF_INPUTS=1",
      `PROOF_BINARY_PATH=${proofBinaryPath}`,
      `PROOF_INPUT_BUILDER_PATH=${proofInputBuilderPath}`
    ].join("\n")
  );

  try {
    assert.throws(
      () =>
        execFileSync("node", [path.join(tempDir, "scripts", "check-readiness.mjs")], {
          cwd: tempDir,
          encoding: "utf8",
          stdio: "pipe"
        }),
      (error) => {
        const body = JSON.parse(error.stdout);
        assert.equal(body.ready, false);
        assert.equal(body.proofInputPolicyPinned, false);
        assert.equal(body.checks.proofInputPolicyPinned, false);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
