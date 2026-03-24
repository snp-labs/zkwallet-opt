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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-smoke-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery:smoke executes create, challenge, and submit in order", async () => {
  const tempDir = createTempApp();
  const inputPath = path.join(tempDir, "tmp", "social-recovery-smoke-input.json");
  const seenRequests = [];

  fs.writeFileSync(
    inputPath,
    JSON.stringify(
      {
        providers: ["google", "kakao"],
        txKeyAddress: "0x1111111111111111111111111111111111111111",
        newTxKeyAddress: "0x2222222222222222222222222222222222222222",
        create: {
          jwts: ["create-google", "create-kakao"],
        },
        challenge: {
          jwts: ["challenge-google", "challenge-kakao"],
        },
        submit: {
          jwts: ["submit-google", "submit-kakao"],
        },
      },
      null,
      2
    )
  );

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    seenRequests.push({ method: req.method, url: req.url, body });

    res.setHeader("content-type", "application/json");
    if (req.url === "/v1/social-login/create-account") {
      res.end(
        JSON.stringify({
          accountData: {
            accountId: "account-1",
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
            nonce: "0xabc",
            random: "0xdef",
            userOpHash: "0x123",
            zkAccountAddress: "0x3333333333333333333333333333333333333333",
          },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/recovery-submit") {
      res.end(
        JSON.stringify({
          account: {
            accountId: "account-1",
            chainAccount: {
              zkAccountAddress: "0x3333333333333333333333333333333333333333",
            },
          },
          challenge: {
            counter: "1",
          },
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
      [path.join(tempDir, "scripts", "social-recovery-smoke.mjs"), "--json"],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          SOCIAL_RECOVERY_SMOKE_INPUT_PATH: inputPath,
          SOCIAL_RECOVERY_BASE_URL: `http://127.0.0.1:${address.port}`,
        },
      }
    );

    const result = JSON.parse(stdout);
    assert.equal(result.accountId, "account-1");
    assert.equal(
      result.zkAccountAddress,
      "0x3333333333333333333333333333333333333333"
    );
    assert.equal(result.challenge.random, "0xdef");
    assert.equal(result.submit.transactionHash, "0x999");
    assert.deepEqual(
      seenRequests.map((entry) => entry.url),
      [
        "/v1/social-login/create-account",
        "/v1/social-login/recovery-challenge",
        "/v1/social-login/recovery-submit",
      ]
    );
    assert.deepEqual(seenRequests[2].body, {
      jwts: ["submit-google", "submit-kakao"],
      providers: ["google", "kakao"],
      newTxKeyAddress: "0x2222222222222222222222222222222222222222",
      random: "0xdef",
    });
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery:smoke writes redacted artifacts without raw JWT leakage", async () => {
  const tempDir = createTempApp();
  const inputPath = path.join(tempDir, "tmp", "social-recovery-smoke-input.json");
  const outputDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    inputPath,
    JSON.stringify(
      {
        providers: ["google"],
        txKeyAddress: "0x1111111111111111111111111111111111111111",
        newTxKeyAddress: "0x2222222222222222222222222222222222222222",
        create: {
          providers: ["google"],
          jwts: [
            "eyJhbGciOiJSUzI1NiIsImtpZCI6ImNyZWF0ZS1raWQifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJ6a3Bhc3NrZXktY2xpZW50Iiwic3ViIjoiY3JlYXRlLXN1YmplY3QiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMzYwMH0.signature"
          ],
        },
        challenge: {
          providers: ["google"],
          jwts: [
            "eyJhbGciOiJSUzI1NiIsImtpZCI6ImNoYWxsZW5nZS1raWQifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJ6a3Bhc3NrZXktY2xpZW50Iiwic3ViIjoiY2hhbGxlbmdlLXN1YmplY3QiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMzYwMH0.signature"
          ],
        },
        submit: {
          providers: ["google"],
          jwts: [
            "eyJhbGciOiJSUzI1NiIsImtpZCI6InN1Ym1pdC1raWQifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJ6a3Bhc3NrZXktY2xpZW50Iiwic3ViIjoic3VibWl0LXN1YmplY3QiLCJub25jZSI6IjB4YWJjIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.signature"
          ],
        },
      },
      null,
      2
    )
  );

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    JSON.parse(Buffer.concat(chunks).toString("utf8"));
    res.setHeader("content-type", "application/json");
    if (req.url === "/v1/social-login/create-account") {
      res.end(
        JSON.stringify({
          accountData: { accountId: "account-2" },
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
            nonce: "0xabc",
            random: "0xdef",
            userOpHash: "0x123",
            zkAccountAddress: "0x3333333333333333333333333333333333333333",
          },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/recovery-submit") {
      res.end(
        JSON.stringify({
          account: {
            accountId: "account-2",
            chainAccount: {
              zkAccountAddress: "0x3333333333333333333333333333333333333333",
            },
          },
          challenge: {
            counter: "2",
          },
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
      [
        path.join(tempDir, "scripts", "social-recovery-smoke.mjs"),
        "--json",
        "--output-dir",
        outputDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          SOCIAL_RECOVERY_SMOKE_INPUT_PATH: inputPath,
          SOCIAL_RECOVERY_BASE_URL: `http://127.0.0.1:${address.port}`,
        },
      }
    );

    const result = JSON.parse(stdout);
    assert.equal(result.artifactsDir, outputDir);

    const report = fs.readFileSync(path.join(outputDir, "report.md"), "utf8");
    const redactedInput = JSON.parse(
      fs.readFileSync(path.join(outputDir, "input.redacted.json"), "utf8")
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputDir, "manifest.json"), "utf8")
    );

    assert.match(report, /Social Recovery Smoke Report/);
    assert.equal(report.includes("create-subject"), false);
    assert.equal(report.includes("submit-subject"), false);
    assert.equal(report.includes(".signature"), false);
    assert.equal(redactedInput.submit.jwtSummaries[0].payload.nonceMatchesExpected, true);
    assert.equal(typeof redactedInput.create.jwtSummaries[0].sha256, "string");
    assert.equal(redactedInput.create.jwtSummaries[0].sha256.length, 64);
    assert.equal(manifest.submitTransactionHash, "0x999");
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
