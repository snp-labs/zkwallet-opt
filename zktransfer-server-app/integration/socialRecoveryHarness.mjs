import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export const appDir = "/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app";
export const contractDir = "/Users/hyunokoh/Documents/zkWallet/vendor/zkpasskey/contract";
const hardhatCliPath =
  "/Users/hyunokoh/Documents/zkWallet/vendor/zkpasskey/contract/node_modules/hardhat/internal/cli/cli.js";

export function preferredPathEnv() {
  return `/opt/homebrew/bin:${process.env.PATH || ""}`;
}

export function findNode() {
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

export async function getAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function waitForOutput(streams, pattern, label, timeoutMs = 20000) {
  let buffered = "";
  const startedAt = Date.now();

  return await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      buffered += chunk.toString("utf8");
      if (pattern.test(buffered)) {
        cleanup();
        resolve(buffered);
      } else if (Date.now() - startedAt > timeoutMs) {
        cleanup();
        reject(new Error(`Timed out waiting for ${label}:\n${buffered}`));
      }
    };

    const cleanup = () => {
      for (const stream of streams) {
        stream.off("data", onData);
      }
    };

    for (const stream of streams) {
      stream.on("data", onData);
    }
  });
}

export async function startLocalnet() {
  const port = await getAvailablePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const nodePath = findNode();
  const child = spawn(
    nodePath,
    [hardhatCliPath, "node", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: contractDir,
      env: {
        ...process.env,
        PATH: preferredPathEnv(),
        HARDHAT_DISABLE_TELEMETRY_PROMPT: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  await waitForOutput(
    [child.stdout, child.stderr],
    /Started HTTP and WebSocket JSON-RPC server/u,
    "hardhat localnet"
  );

  return {
    rpcUrl,
    child,
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

export async function startDevOidcJwksServer() {
  const nodePath = findNode();
  const port = await getAvailablePort();

  execFileSync(nodePath, [path.join(appDir, "scripts", "dev-oidc-keypair.mjs")], {
    cwd: appDir,
    env: {
      ...process.env,
      PATH: preferredPathEnv(),
    },
    encoding: "utf8",
  });

  const child = spawn(nodePath, [path.join(appDir, "scripts", "dev-oidc-jwks-server.mjs")], {
    cwd: appDir,
    env: {
      ...process.env,
      PATH: preferredPathEnv(),
      DEV_OIDC_HOST: "127.0.0.1",
      DEV_OIDC_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitForOutput(
    [child.stdout, child.stderr],
    /\[dev-oidc-jwks\] serving /u,
    "dev OIDC JWKS server"
  );

  return {
    jwksBaseUrl: `http://127.0.0.1:${port}`,
    child,
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

export function bootstrapLocalContracts(rpcUrl) {
  const nodePath = findNode();
  const stdout = execFileSync(
    nodePath,
    [path.join(appDir, "scripts", "bootstrap-zkpasskey-localnet.mjs"), "--json"],
    {
      cwd: appDir,
      env: {
        ...process.env,
        PATH: preferredPathEnv(),
        ZKPASSKEY_LOCALNET_RPC_URL: rpcUrl,
      },
      encoding: "utf8",
    }
  );
  return JSON.parse(stdout);
}

export async function startServer({
  rpcUrl,
  bootstrapEnv,
  jwksBaseUrl,
  dataFile,
  recoveryFundingWei = "100000000000000000",
}) {
  const nodePath = findNode();
  const port = await getAvailablePort();
  const child = spawn(nodePath, ["src/index.js"], {
    cwd: appDir,
    env: {
      ...process.env,
      PATH: preferredPathEnv(),
      PORT: String(port),
      HOST: "127.0.0.1",
      DATA_FILE: dataFile,
      OIDC_GOOGLE_ISSUER_OVERRIDE: `${jwksBaseUrl}/google`,
      OIDC_GOOGLE_JWKS_URI_OVERRIDE: `${jwksBaseUrl}/jwks`,
      OIDC_KAKAO_ISSUER_OVERRIDE: `${jwksBaseUrl}/kakao`,
      OIDC_KAKAO_JWKS_URI_OVERRIDE: `${jwksBaseUrl}/jwks`,
      OIDC_APPLE_ISSUER_OVERRIDE: `${jwksBaseUrl}/apple`,
      OIDC_APPLE_JWKS_URI_OVERRIDE: `${jwksBaseUrl}/jwks`,
      ZKPASSKEY_RPC_URL: rpcUrl,
      ZKPASSKEY_ENTRY_POINT_ADDRESS: bootstrapEnv.ZKPASSKEY_ENTRY_POINT_ADDRESS,
      ZKPASSKEY_RELAYER_PRIVATE_KEY: bootstrapEnv.ZKPASSKEY_RELAYER_PRIVATE_KEY,
      ZKPASSKEY_MERKLE_TREE_ADDRESS: bootstrapEnv.ZKPASSKEY_MERKLE_TREE_ADDRESS,
      ZKPASSKEY_FACTORY_ADDRESS: bootstrapEnv.ZKPASSKEY_FACTORY_ADDRESS,
      ZKPASSKEY_VERIFIER_ADDRESS: bootstrapEnv.ZKPASSKEY_VERIFIER_ADDRESS,
      ZKPASSKEY_BENEFICIARY_ADDRESS: bootstrapEnv.ZKPASSKEY_BENEFICIARY_ADDRESS,
      ZKPASSKEY_CREATE_ACCOUNT_FUNDING_WEI: "0",
      ZKPASSKEY_RECOVERY_FUNDING_WEI: recoveryFundingWei,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitForOutput(
    [child.stdout, child.stderr],
    /\[zktransfer-server-app\] listening on /u,
    "zktransfer server"
  );

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    child,
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

export function runDevOidcSmoke({ baseUrl, jwksBaseUrl }) {
  const nodePath = findNode();
  const stdout = execFileSync(
    nodePath,
    [path.join(appDir, "scripts", "social-recovery-dev-oidc-smoke.mjs"), "--json"],
    {
      cwd: appDir,
      env: {
        ...process.env,
        PATH: preferredPathEnv(),
        SOCIAL_RECOVERY_BASE_URL: baseUrl,
        DEV_OIDC_BASE_URL: jwksBaseUrl,
      },
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 4,
    }
  );
  return JSON.parse(stdout);
}

export async function runSocialRecoveryLocalDemo(options = {}) {
  const recoveryFundingWei =
    options.recoveryFundingWei || process.env.ZKPASSKEY_RECOVERY_FUNDING_WEI || "100000000000000000";
  const dataFile =
    options.dataFile ||
    path.join(
      os.tmpdir(),
      `zktransfer-social-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
    );

  const localnet = await startLocalnet();
  const jwksServer = await startDevOidcJwksServer();
  let server = null;

  try {
    const deployed = bootstrapLocalContracts(localnet.rpcUrl);
    server = await startServer({
      rpcUrl: localnet.rpcUrl,
      bootstrapEnv: deployed.env,
      jwksBaseUrl: jwksServer.jwksBaseUrl,
      dataFile,
      recoveryFundingWei,
    });

    const result = runDevOidcSmoke({
      baseUrl: server.baseUrl,
      jwksBaseUrl: jwksServer.jwksBaseUrl,
    });
    const persisted = JSON.parse(fs.readFileSync(dataFile, "utf8"));

    return {
      result,
      environment: {
        rpcUrl: localnet.rpcUrl,
        jwksBaseUrl: jwksServer.jwksBaseUrl,
        serverBaseUrl: server.baseUrl,
        recoveryFundingWei,
        dataFile,
      },
      bootstrap: deployed,
      persisted,
    };
  } finally {
    if (server) {
      await server.stop();
    }
    await jwksServer.stop();
    await localnet.stop();
    if (!options.keepDataFile) {
      fs.rmSync(dataFile, { force: true });
    }
  }
}
