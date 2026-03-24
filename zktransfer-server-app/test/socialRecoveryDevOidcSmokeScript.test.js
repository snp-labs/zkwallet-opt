import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-dev-oidc-smoke-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-dev-oidc-smoke.mjs"),
    path.join(tempDir, "scripts", "social-recovery-dev-oidc-smoke.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "dev-oidc-keypair.mjs"),
    path.join(tempDir, "scripts", "dev-oidc-keypair.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "dev-oidc-mint.mjs"),
    path.join(tempDir, "scripts", "dev-oidc-mint.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

function decodeJwtPayload(rawJwt) {
  const payload = rawJwt.split(".")[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

test("social-recovery:dev-oidc:smoke mints stage JWTs and submits nonce-bound recovery", async () => {
  const tempDir = createTempApp();
  const seenRequests = [];

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body =
      req.method === "GET" ? null : JSON.parse(Buffer.concat(chunks).toString("utf8"));
    seenRequests.push({ method: req.method, url: req.url, body });

    res.setHeader("content-type", "application/json");
    if (req.url === "/v1/social-login/providers") {
      res.end(
        JSON.stringify({
          providers: [{ id: "google" }, { id: "kakao" }, { id: "apple" }],
          threshold: { n: 6, k: 3 },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/create-account") {
      res.end(
        JSON.stringify({
          accountData: {
            accountId: "account-dev-1",
          },
          chainAccount: {
            zkAccountAddress: "0x3333333333333333333333333333333333333333",
          },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/recovery-challenge") {
      res.end(
        JSON.stringify({
          challenge: {
            nonce: "nonce-from-challenge",
            random: "0xabc",
            userOpHash: "0x123",
          },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/recovery-submit") {
      res.end(
        JSON.stringify({
          submission: {
            transactionHash: "0x999",
            userOpHash: "0x123",
          },
        })
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "unexpected route" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  try {
    const { stdout } = await execFileAsync(
      "node",
      [path.join(tempDir, "scripts", "social-recovery-dev-oidc-smoke.mjs"), "--json"],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          SOCIAL_RECOVERY_BASE_URL: `http://127.0.0.1:${address.port}`,
          DEV_OIDC_BASE_URL: "http://127.0.0.1:4400",
        },
      }
    );

    const result = JSON.parse(stdout);
    assert.deepEqual(result.create.providers, [
      "google",
      "kakao",
      "apple",
      "google",
      "kakao",
      "apple",
    ]);
    assert.deepEqual(result.create.subjects, [
      "google-dev-user-1",
      "kakao-dev-user-1",
      "apple-dev-user-1",
      "google-dev-user-2",
      "kakao-dev-user-2",
      "apple-dev-user-2",
    ]);
    assert.deepEqual(result.challenge.providers, ["google", "kakao", "apple"]);
    assert.deepEqual(result.challenge.subjects, [
      "google-dev-user-1",
      "kakao-dev-user-1",
      "apple-dev-user-1",
    ]);
    assert.equal(result.submit.transactionHash, "0x999");
    assert.equal(result.submit.nonceFromJwt, "nonce-from-challenge");
    assert.equal(
      result.oidcOverrides.OIDC_APPLE_JWKS_URI_OVERRIDE,
      "http://127.0.0.1:4400/jwks"
    );
    assert.equal(
      seenRequests.map((entry) => entry.url).join(","),
      [
        "/v1/social-login/providers",
        "/v1/social-login/create-account",
        "/v1/social-login/recovery-challenge",
        "/v1/social-login/recovery-submit",
      ].join(",")
    );
    assert.equal(seenRequests[1].body.jwts.length, 6);
    assert.equal(seenRequests[2].body.jwts.length, 3);
    assert.equal(seenRequests[3].body.jwts.length, 3);
    assert.equal(
      decodeJwtPayload(seenRequests[3].body.jwts[0]).nonce,
      "nonce-from-challenge"
    );
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
