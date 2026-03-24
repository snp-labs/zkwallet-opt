import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
}

function createTempWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zkpasskey-bootstrap-"));
  const appDir = path.join(tempRoot, "zktransfer-server-app");
  const scriptsDir = path.join(appDir, "scripts");
  const contractDir = path.join(tempRoot, "vendor", "zkpasskey", "contract");

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(contractDir, { recursive: true });

  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "bootstrap-zkpasskey-localnet.mjs"),
    path.join(scriptsDir, "bootstrap-zkpasskey-localnet.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), ".env.example"),
    path.join(appDir, ".env.example")
  );

  return { tempRoot, appDir };
}

function createFakeBin(logPath, payload) {
  const tempBin = fs.mkdtempSync(path.join(os.tmpdir(), "zkpasskey-bootstrap-bin-"));
  writeExecutable(
    path.join(tempBin, "npm"),
    [
      "#!/usr/bin/env bash",
      "echo \"$PWD::$*\" >> \"$FAKE_NPM_LOG\"",
      "cat <<'JSON'",
      JSON.stringify(payload, null, 2),
      "JSON"
    ].join("\n") + "\n"
  );
  return tempBin;
}

function createPayload() {
  return {
    network: {
      name: "localnet",
      chainId: "8216"
    },
    deployer: "0x1111111111111111111111111111111111111111",
    entryPointAddress: "0x2222222222222222222222222222222222222222",
    merkleTreeAddress: "0x3333333333333333333333333333333333333333",
    factoryAddress: "0x4444444444444444444444444444444444444444",
    verifierLogicAddress: "0x5555555555555555555555555555555555555555",
    beneficiaryAddress: "0x6666666666666666666666666666666666666666",
    env: {
      ZKPASSKEY_RPC_URL: "http://127.0.0.1:8545",
      ZKPASSKEY_ENTRY_POINT_ADDRESS: "0x2222222222222222222222222222222222222222",
      ZKPASSKEY_RELAYER_PRIVATE_KEY:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ZKPASSKEY_MERKLE_TREE_ADDRESS: "0x3333333333333333333333333333333333333333",
      ZKPASSKEY_FACTORY_ADDRESS: "0x4444444444444444444444444444444444444444",
      ZKPASSKEY_VERIFIER_ADDRESS: "0x5555555555555555555555555555555555555555",
      ZKPASSKEY_BENEFICIARY_ADDRESS: "0x6666666666666666666666666666666666666666"
    }
  };
}

test("bootstrap:zkpasskey:localnet prints env block without writing .env by default", () => {
  const { tempRoot, appDir } = createTempWorkspace();
  const logPath = path.join(tempRoot, "npm.log");
  const tempBin = createFakeBin(logPath, createPayload());

  try {
    const stdout = execFileSync(
      "node",
      [path.join(appDir, "scripts", "bootstrap-zkpasskey-localnet.mjs")],
      {
        cwd: appDir,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${tempBin}:${process.env.PATH}`,
          FAKE_NPM_LOG: logPath
        }
      }
    );

    assert.match(stdout, /deployed local zkpasskey contracts/);
    assert.match(stdout, /ZKPASSKEY_ENTRY_POINT_ADDRESS=0x2222/);
    assert.match(stdout, /ZKPASSKEY_RELAYER_PRIVATE_KEY=0xaaaa/);
    assert.equal(fs.existsSync(path.join(appDir, ".env")), false);

    const log = fs.readFileSync(logPath, "utf8");
    assert.match(log, /vendor\/zkpasskey\/contract::run deploy:localnet --silent/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});

test("bootstrap:zkpasskey:localnet writes local relayer env values when requested", () => {
  const { tempRoot, appDir } = createTempWorkspace();
  const logPath = path.join(tempRoot, "npm.log");
  const tempBin = createFakeBin(logPath, createPayload());

  try {
    const stdout = execFileSync(
      "node",
      [path.join(appDir, "scripts", "bootstrap-zkpasskey-localnet.mjs"), "--write-env"],
      {
        cwd: appDir,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${tempBin}:${process.env.PATH}`,
          FAKE_NPM_LOG: logPath
        }
      }
    );

    const envContents = fs.readFileSync(path.join(appDir, ".env"), "utf8");
    assert.match(stdout, /wrote zkpasskey env values/);
    assert.match(envContents, /^JWT_SECRET=replace-with-a-real-secret$/m);
    assert.match(envContents, /^ZKPASSKEY_ENTRY_POINT_ADDRESS=0x2222222222222222222222222222222222222222$/m);
    assert.match(envContents, /^ZKPASSKEY_RELAYER_PRIVATE_KEY=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$/m);
    assert.match(envContents, /^ZKPASSKEY_CREATE_ACCOUNT_FUNDING_WEI=0$/m);
    assert.match(envContents, /^ZKPASSKEY_RECOVERY_FUNDING_WEI=0$/m);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});
