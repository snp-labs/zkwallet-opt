import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function createTempBin() {
  const tempBin = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-bin-"));
  const nodePath = execFileSync("bash", ["-lc", "command -v node"], {
    encoding: "utf8"
  }).trim();
  const bashPath = execFileSync("bash", ["-lc", "command -v bash"], {
    encoding: "utf8"
  }).trim();
  const dirnamePath = execFileSync("bash", ["-lc", "command -v dirname"], {
    encoding: "utf8"
  }).trim();
  fs.symlinkSync(nodePath, path.join(tempBin, "node"));
  fs.symlinkSync(bashPath, path.join(tempBin, "bash"));
  fs.symlinkSync(dirnamePath, path.join(tempBin, "dirname"));
  return tempBin;
}

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-status-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src", "lib"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src", "services"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "deployment-status.sh"),
    path.join(tempDir, "scripts", "deployment-status.sh")
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
  return tempDir;
}

test("deployment:status reports missing runtime commands and readiness recommendations", () => {
  const tempDir = createTempApp();
  const tempBin = createTempBin();
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
    const stdout = execFileSync("bash", [path.join(tempDir, "scripts", "deployment-status.sh")], {
      cwd: tempDir,
      env: {
        ...process.env,
        PATH: tempBin
      },
      encoding: "utf8"
    });
    const body = JSON.parse(stdout);

    assert.equal(body.serviceName, "zktransfer-server-app");
    assert.deepEqual(body.missingDeps, ["npm", "curl", "sudo", "systemctl"]);
    assert.equal(body.config.ready, true);
    assert.equal(body.config.proofInputPolicyPinned, true);
    assert.equal(body.config.socialRecoveryReady, false);
    assert.deepEqual(body.blockingIssues, [
      "missing runtime commands: npm, curl, sudo, systemctl",
      "social recovery is not fully configured",
      "health endpoint is unavailable"
    ]);
    assert.equal(body.suggestedCommand, "npm run install:systemd:dry-run");
    assert.ok(
      body.recommendations.includes(
        "Install missing runtime commands: npm, curl, sudo, systemctl."
      )
    );
    assert.ok(
      body.recommendations.includes(
        "Use npm run install:systemd:dry-run to validate prechecks before moving to a systemd host."
      )
    );
    assert.ok(body.recommendations.includes("Install the systemd unit with npm run install:systemd when ready."));
    assert.ok(
      body.recommendations.includes(
        "Set ZKPASSKEY_RPC_URL, ZKPASSKEY_ENTRY_POINT_ADDRESS, ZKPASSKEY_RELAYER_PRIVATE_KEY, ZKPASSKEY_MERKLE_TREE_ADDRESS, ZKPASSKEY_FACTORY_ADDRESS, and ZKPASSKEY_VERIFIER_ADDRESS to enable on-chain social recovery."
      )
    );
    assert.ok(
      body.recommendations.includes(
        "Provide a valid ZKPASSKEY_PK_PATH for server-side social recovery proving."
      )
    );
    assert.ok(
      body.recommendations.includes(
        "Set ZKPASSKEY_RECOVERY_FUNDING_WEI to a positive value before running fresh social recovery submit flows."
      )
    );
    assert.ok(body.recommendations.includes("Start the server before expecting /health output."));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});
