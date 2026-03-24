import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";

test("loadConfig reads .env values when process env is unset", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-config-"));
  const envFilePath = path.join(tempDir, ".env");
  fs.writeFileSync(
    envFilePath,
    [
      "HOST=0.0.0.0",
      "PORT=4999",
      "JWT_SECRET=env-file-secret",
      "ALLOW_LEGACY_PROOF_INPUTS=0",
      "SUPPORTED_NETWORKS=hardhat-local"
    ].join("\n")
  );

  try {
    const config = loadConfig({
      env: {},
      envFilePath
    });
    assert.equal(config.host, "0.0.0.0");
    assert.equal(config.port, 4999);
    assert.equal(config.jwtSecret, "env-file-secret");
    assert.equal(config.jwtSecretConfigured, true);
    assert.equal(config.usingDefaultJwtSecret, false);
    assert.equal(config.usingPlaceholderJwtSecret, false);
    assert.equal(config.allowLegacyProofInputs, false);
    assert.equal(config.proofInputPolicyPinned, true);
    assert.deepEqual(config.supportedNetworks, ["hardhat-local"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadConfig prefers process env over .env values", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-config-"));
  const envFilePath = path.join(tempDir, ".env");
  fs.writeFileSync(
    envFilePath,
    ["HOST=0.0.0.0", "ALLOW_LEGACY_PROOF_INPUTS=1"].join("\n")
  );

  try {
    const config = loadConfig({
      env: {
        HOST: "127.0.0.1",
        ALLOW_LEGACY_PROOF_INPUTS: "0",
        JWT_SECRET: "process-secret"
      },
      envFilePath
    });
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.jwtSecret, "process-secret");
    assert.equal(config.jwtSecretConfigured, true);
    assert.equal(config.usingDefaultJwtSecret, false);
    assert.equal(config.usingPlaceholderJwtSecret, false);
    assert.equal(config.allowLegacyProofInputs, false);
    assert.equal(config.proofInputPolicyPinned, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadConfig marks positive recovery funding as configured", () => {
  const config = loadConfig({
    env: {
      JWT_SECRET: "process-secret",
      ZKPASSKEY_RECOVERY_FUNDING_WEI: "100000000000000000"
    },
    envFilePath: path.join(os.tmpdir(), "does-not-exist.env")
  });

  assert.equal(config.zkpasskeyRecoveryFundingWei, "100000000000000000");
  assert.equal(config.zkpasskeyRecoveryFundingConfigured, true);
});

test("loadConfig treats zero recovery funding as not configured", () => {
  const config = loadConfig({
    env: {
      JWT_SECRET: "process-secret",
      ZKPASSKEY_RECOVERY_FUNDING_WEI: "0"
    },
    envFilePath: path.join(os.tmpdir(), "does-not-exist.env")
  });

  assert.equal(config.zkpasskeyRecoveryFundingWei, "0");
  assert.equal(config.zkpasskeyRecoveryFundingConfigured, false);
});

test("loadConfig treats placeholder JWT secret as not configured", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-config-"));
  const envFilePath = path.join(tempDir, ".env");
  fs.writeFileSync(envFilePath, "JWT_SECRET=replace-with-a-real-secret\n");

  try {
    const config = loadConfig({
      env: {},
      envFilePath
    });
    assert.equal(config.jwtSecret, "replace-with-a-real-secret");
    assert.equal(config.jwtSecretConfigured, false);
    assert.equal(config.usingDefaultJwtSecret, false);
    assert.equal(config.usingPlaceholderJwtSecret, true);
    assert.equal(config.proofInputPolicyPinned, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
