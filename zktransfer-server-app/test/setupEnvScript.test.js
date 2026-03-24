import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function createTempApp(scriptPath, envExamplePath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-setup-env-"));
  const scriptsDir = path.join(tempDir, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.copyFileSync(scriptPath, path.join(scriptsDir, "ensure-jwt-secret.sh"));
  fs.copyFileSync(envExamplePath, path.join(tempDir, ".env.example"));
  return tempDir;
}

test("setup:env appends missing fail-closed defaults without overwriting explicit values", () => {
  const tempDir = createTempApp(
    path.join(process.cwd(), "scripts", "ensure-jwt-secret.sh"),
    path.join(process.cwd(), ".env.example")
  );
  const envPath = path.join(tempDir, ".env");
  fs.writeFileSync(
    envPath,
    [
      "HOST=0.0.0.0",
      "JWT_SECRET=replace-with-a-real-secret",
      "ALLOW_LEGACY_PROOF_INPUTS=1"
    ].join("\n")
  );

  try {
    execFileSync("bash", [path.join(tempDir, "scripts", "ensure-jwt-secret.sh")], {
      cwd: tempDir,
      stdio: "pipe"
    });

    const env = fs.readFileSync(envPath, "utf8");
    assert.match(env, /^CIRCUITS_ROOT=\/Users\/hyunokoh\/Documents\/zkWallet\/zk-wallet-circuits$/m);
    assert.match(env, /^ALLOW_LEGACY_PROOF_INPUTS=1$/m);
    assert.doesNotMatch(env, /^JWT_SECRET=replace-with-a-real-secret$/m);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
