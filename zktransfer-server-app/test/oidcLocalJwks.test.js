import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import net from "node:net";
import path from "node:path";
import {
  clearJwksCache,
  getProviderRsaPublicKeyFromJwt,
  verifyOidcJwt,
} from "../src/lib/oidc.js";

const execFileAsync = promisify(execFile);
const appDir = process.cwd();

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForOutput(stream, pattern) {
  return await new Promise((resolve, reject) => {
    let buffered = "";
    const onData = (chunk) => {
      buffered += chunk.toString("utf8");
      if (pattern.test(buffered)) {
        cleanup();
        resolve(buffered);
      }
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`dev OIDC JWKS server exited before ready (code ${code})`));
    };
    const cleanup = () => {
      stream.off("data", onData);
    };
    stream.on("data", onData);
    process.once("exit", onExit);
  });
}

function decodeBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

test("verifyOidcJwt accepts a locally minted RS256 token via override JWKS", async () => {
  await execFileAsync("node", [path.join(appDir, "scripts", "dev-oidc-keypair.mjs")], {
    cwd: appDir,
    encoding: "utf8",
  });

  const port = await getFreePort();
  const issuer = `http://127.0.0.1:${port}/google`;
  const jwksUri = `http://127.0.0.1:${port}/jwks`;
  const jwksServer = spawn("node", [path.join(appDir, "scripts", "dev-oidc-jwks-server.mjs")], {
    cwd: appDir,
    env: {
      ...process.env,
      DEV_OIDC_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const restoreIssuer = process.env.OIDC_GOOGLE_ISSUER_OVERRIDE;
  const restoreJwks = process.env.OIDC_GOOGLE_JWKS_URI_OVERRIDE;

  try {
    await waitForOutput(jwksServer.stdout, /\[dev-oidc-jwks\] serving /u);
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(appDir, "scripts", "dev-oidc-mint.mjs"),
        "--provider",
        "google",
        "--issuer",
        issuer,
        "--audience",
        "dev-zkwallet-client",
        "--sub",
        "google-local-user",
        "--nonce",
        "nonce-123",
      ],
      {
        cwd: appDir,
        encoding: "utf8",
      }
    );
    const minted = JSON.parse(stdout);

    process.env.OIDC_GOOGLE_ISSUER_OVERRIDE = issuer;
    process.env.OIDC_GOOGLE_JWKS_URI_OVERRIDE = jwksUri;
    clearJwksCache();

    const verified = await verifyOidcJwt(minted.jwt, "google");
    const publicKey = await getProviderRsaPublicKeyFromJwt(minted.jwt, "google");

    assert.equal(verified.iss, issuer);
    assert.equal(verified.sub, "google-local-user");
    assert.equal(verified.aud, "dev-zkwallet-client");
    assert.equal(verified.nonce, "nonce-123");
    assert.equal(decodeBase64url(publicKey.n).length, 256);
    assert.equal(decodeBase64url(publicKey.e).length, 3);
  } finally {
    clearJwksCache();
    if (restoreIssuer === undefined) {
      delete process.env.OIDC_GOOGLE_ISSUER_OVERRIDE;
    } else {
      process.env.OIDC_GOOGLE_ISSUER_OVERRIDE = restoreIssuer;
    }
    if (restoreJwks === undefined) {
      delete process.env.OIDC_GOOGLE_JWKS_URI_OVERRIDE;
    } else {
      process.env.OIDC_GOOGLE_JWKS_URI_OVERRIDE = restoreJwks;
    }
    jwksServer.kill("SIGTERM");
    await new Promise((resolve) => jwksServer.once("exit", () => resolve()));
  }
});
