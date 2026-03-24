import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { execFileSync } from "node:child_process";
import { ethers } from "ethers";
import { ZkPasskeyRelayerService } from "../src/services/zkpasskeyRelayerService.js";

async function isPortServingJsonRpc(url) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function findNode() {
  const candidates = ["/opt/homebrew/bin/node", "node"];
  for (const candidate of candidates) {
    try {
      const resolved = execFileSync("bash", ["-lc", `command -v "${candidate}"`], {
        encoding: "utf8",
      }).trim();
      if (resolved) {
        return resolved;
      }
    } catch {}
  }
  throw new Error("node executable not found");
}

async function getAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startLocalnet() {
  const port = await getAvailablePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const nodePath = findNode();
  const hardhatCliPath =
    "/Users/hyunokoh/Documents/zkWallet/vendor/zkpasskey/contract/node_modules/hardhat/internal/cli/cli.js";
  const child = spawn(
    nodePath,
    [hardhatCliPath, "node", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: "/Users/hyunokoh/Documents/zkWallet/vendor/zkpasskey/contract",
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`,
        HARDHAT_DISABLE_TELEMETRY_PROMPT: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let started = false;
  let output = "";
  const onData = (chunk) => {
    output += chunk.toString("utf8");
    if (output.includes("Started HTTP and WebSocket JSON-RPC server")) {
      started = true;
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  const startedAt = Date.now();
  while (!started) {
    if (child.exitCode !== null) {
      throw new Error(`hardhat localnet exited early:\n${output}`);
    }
    if (Date.now() - startedAt > 15000) {
      child.kill("SIGTERM");
      throw new Error(`Timed out waiting for hardhat localnet:\n${output}`);
    }
    await delay(100);
  }

  return {
    child,
    rpcUrl,
    async stop() {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await delay(250);
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }
    },
  };
}

function bootstrapLocalContracts(rpcUrl) {
  const stdout = execFileSync(
    "node",
    ["/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/scripts/bootstrap-zkpasskey-localnet.mjs", "--json"],
    {
      cwd: "/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app",
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`,
        ZKPASSKEY_LOCALNET_RPC_URL: rpcUrl,
      },
      encoding: "utf8",
    }
  );
  return JSON.parse(stdout);
}

test("zkpasskey relayer deploys account and manages on-chain merkle proof on localnet", async () => {
  const localnet = await startLocalnet();

  try {
    assert.equal(await isPortServingJsonRpc(localnet.rpcUrl), true);
    const deployed = bootstrapLocalContracts(localnet.rpcUrl);
    const relayer = new ZkPasskeyRelayerService({
      config: {
        zkpasskeyRpcUrl: deployed.env.ZKPASSKEY_RPC_URL,
        zkpasskeyEntryPointAddress: deployed.env.ZKPASSKEY_ENTRY_POINT_ADDRESS,
        zkpasskeyRelayerPrivateKey: deployed.env.ZKPASSKEY_RELAYER_PRIVATE_KEY,
        zkpasskeyBeneficiaryAddress: deployed.env.ZKPASSKEY_BENEFICIARY_ADDRESS,
        zkpasskeyMerkleTreeAddress: deployed.env.ZKPASSKEY_MERKLE_TREE_ADDRESS,
        zkpasskeyFactoryAddress: deployed.env.ZKPASSKEY_FACTORY_ADDRESS,
        zkpasskeyVerifierAddress: deployed.env.ZKPASSKEY_VERIFIER_ADDRESS,
        zkpasskeyCreateAccountFundingWei: "0",
        zkpasskeyRecoveryFundingWei: "0",
        zkpasskeyVerificationGasLimit: 1500000,
        zkpasskeyCallGasLimit: 1500000,
        zkpasskeyPreVerificationGas: 100000,
        zkpasskeyMaxFeePerGas: "1000000000",
        zkpasskeyMaxPriorityFeePerGas: "1000000000",
      },
    });

    assert.equal(relayer.isConfigured(), true);

    const chainAccount = await relayer.deploySocialAccount({
      accountId: "1".padStart(64, "0"),
      txKeyAddress: "0x1111111111111111111111111111111111111111",
      anchorParts: ["1", "2", "3"],
      threshold: { n: 3, k: 2 },
    });

    assert.equal(chainAccount.mode, "onchain");
    assert.ok(chainAccount.zkAccountAddress);
    assert.ok(chainAccount.masterKeyVerifierAddress);

    const accountState = await relayer.getRecoveryAccountState({
      zkAccountAddress: chainAccount.zkAccountAddress,
    });
    assert.equal(
      accountState.txKeyAddress.toLowerCase(),
      "0x1111111111111111111111111111111111111111"
    );
    assert.equal(
      accountState.masterKeyVerifierAddress.toLowerCase(),
      chainAccount.masterKeyVerifierAddress.toLowerCase()
    );
    assert.equal(accountState.recoveryCounter, "0");

    const leaf = "0x7ce340b267441a163b9558c9d3354a70abd890590f5fd153c730c18ec7bb02e";
    const pubkeyHash = ethers.keccak256(ethers.toUtf8Bytes("google:test-rsa-key"));
    const insertResult = await relayer.ensureMerkleLeaf({ leaf, pubkeyHash });
    assert.ok(insertResult.leafIndex >= 0);

    const proof = await relayer.getMerkleProofByPubkeyHash(pubkeyHash);
    assert.equal(proof.leafIndex, insertResult.leafIndex);
    assert.ok(Array.isArray(proof.path));
    assert.equal(proof.path.length, 3);

    const prepared = await relayer.prepareRecoveryOperation({
      zkAccountAddress: chainAccount.zkAccountAddress,
      newTxKeyAddress: "0x2222222222222222222222222222222222222222",
      expectedCounter: "0",
    });
    assert.equal(
      prepared.accountState.zkAccountAddress.toLowerCase(),
      chainAccount.zkAccountAddress.toLowerCase()
    );
    assert.ok(prepared.userOp.callData.startsWith("0x"));
    assert.ok(prepared.userOpHash.startsWith("0x"));
    assert.ok(prepared.signedUserOpHash.startsWith("0x"));
  } finally {
    await localnet.stop();
  }
}, 30000);
