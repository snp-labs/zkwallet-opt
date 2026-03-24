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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-smoke-check-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-check.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-check.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

function createInputFile(tempDir, payload) {
  const inputPath = path.join(tempDir, "tmp", "social-recovery-smoke-input.json");
  fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2));
  return inputPath;
}

test("social-recovery-smoke-check passes for ready server and filled JWT input", async () => {
  const tempDir = createTempApp();
  const inputPath = createInputFile(tempDir, {
    txKeyAddress: "0x1111111111111111111111111111111111111111",
    newTxKeyAddress: "0x2222222222222222222222222222222222222222",
    create: {
      providers: ["google", "kakao", "apple", "google", "kakao", "apple"],
      jwts: ["a", "b", "c", "d", "e", "f"],
    },
    challenge: {
      providers: ["google", "kakao", "apple"],
      jwts: ["g", "h", "i"],
    },
    submit: {
      providers: ["google", "kakao", "apple"],
      jwts: ["j", "k", "l"],
    },
  });

  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/health") {
      res.end(
        JSON.stringify({
          ready: true,
          socialRecoveryReady: true,
          jwtSecretConfigured: true,
          proofInputPolicyPinned: true,
          zkpasskeyRelayerConfigured: true,
          zkpasskeyRecoveryFundingConfigured: true,
          zkpasskeyNapiAvailable: true,
          zkpasskeyPkExists: true,
          socialRecoveryChecks: {
            zkpasskeyNapiAvailable: true,
            zkpasskeyRelayerConfigured: true,
            zkpasskeyPkExists: true,
            zkpasskeyRecoveryFundingConfigured: true,
          },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/providers") {
      res.end(
        JSON.stringify({
          providers: [{ id: "google" }, { id: "kakao" }, { id: "apple" }],
          threshold: { n: 6, k: 3 },
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
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-check.mjs"),
        "--json",
        "--base-url",
        `http://127.0.0.1:${address.port}`,
        "--input",
        inputPath,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    const result = JSON.parse(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
    assert.equal(result.threshold.n, 6);
    assert.equal(result.serverChecks.socialRecoveryReady, true);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-check fails for placeholder JWTs and unhealthy server", async () => {
  const tempDir = createTempApp();
  const inputPath = createInputFile(tempDir, {
    providers: ["google", "kakao", "apple"],
    txKeyAddress: "0x1111111111111111111111111111111111111111",
    newTxKeyAddress: "0x2222222222222222222222222222222222222222",
    create: {
      providers: ["google", "kakao", "apple", "google", "kakao", "apple"],
      jwts: [
        "PASTE_CREATE_GOOGLE_1_JWT_HERE",
        "PASTE_CREATE_KAKAO_1_JWT_HERE",
        "PASTE_CREATE_APPLE_1_JWT_HERE",
        "PASTE_CREATE_GOOGLE_2_JWT_HERE",
        "PASTE_CREATE_KAKAO_2_JWT_HERE",
        "PASTE_CREATE_APPLE_2_JWT_HERE",
      ],
    },
    challenge: {
      providers: ["google", "kakao", "apple"],
      jwts: [
        "PASTE_CHALLENGE_GOOGLE_1_JWT_HERE",
        "PASTE_CHALLENGE_KAKAO_1_JWT_HERE",
        "PASTE_CHALLENGE_APPLE_1_JWT_HERE",
      ],
    },
    submit: {
      providers: ["google", "kakao", "apple"],
      jwts: [
        "PASTE_SUBMIT_GOOGLE_1_JWT_HERE",
        "PASTE_SUBMIT_KAKAO_1_JWT_HERE",
        "PASTE_SUBMIT_APPLE_1_JWT_HERE",
      ],
    },
  });

  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/health") {
      res.end(
        JSON.stringify({
          ready: false,
          socialRecoveryReady: false,
          jwtSecretConfigured: false,
          proofInputPolicyPinned: true,
          zkpasskeyRelayerConfigured: false,
          zkpasskeyRecoveryFundingConfigured: false,
          zkpasskeyNapiAvailable: false,
          zkpasskeyPkExists: false,
          socialRecoveryChecks: {
            zkpasskeyNapiAvailable: false,
            zkpasskeyRelayerConfigured: false,
            zkpasskeyPkExists: false,
            zkpasskeyRecoveryFundingConfigured: false,
          },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/providers") {
      res.end(
        JSON.stringify({
          providers: [{ id: "google" }, { id: "kakao" }, { id: "apple" }],
          threshold: { n: 6, k: 3 },
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
    await assert.rejects(
      execFileAsync(
        "node",
        [
          path.join(tempDir, "scripts", "social-recovery-smoke-check.mjs"),
          "--json",
          "--base-url",
          `http://127.0.0.1:${address.port}`,
          "--input",
          inputPath,
        ],
        {
          cwd: tempDir,
          encoding: "utf8",
        }
      ),
      (error) => {
        const result = JSON.parse(error.stdout);
        assert.equal(result.ok, false);
        assert.match(
          result.issues.join("\n"),
          /placeholder JWT|socialRecoveryReady=false/
        );
        return true;
      }
    );
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
