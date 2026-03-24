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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-smoke-template-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-template.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-template.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-template builds n/k-aligned placeholder JSON", async () => {
  const tempDir = createTempApp();
  const outputPath = path.join(tempDir, "tmp", "template.json");

  const server = http.createServer((req, res) => {
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
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "unexpected route" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-template.mjs"),
        "--json",
        "--base-url",
        `http://127.0.0.1:${address.port}`,
        "--output",
        outputPath,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    const parsed = JSON.parse(stdout);
    const written = JSON.parse(fs.readFileSync(outputPath, "utf8"));

    assert.equal(parsed.outputPath, outputPath);
    assert.equal(written._meta.threshold.n, 6);
    assert.equal(written._meta.threshold.k, 3);
    assert.deepEqual(written.providers, [
      "google",
      "kakao",
      "apple",
      "google",
      "kakao",
      "apple",
    ]);
    assert.deepEqual(written.challenge.providers, ["google", "kakao", "apple"]);
    assert.equal(written.create.jwts.length, 6);
    assert.equal(written.challenge.jwts.length, 3);
    assert.equal(written.submit.jwts.length, 3);
    assert.match(written.create.jwts[0], /^PASTE_CREATE_GOOGLE_1_JWT_HERE$/);
    assert.match(written.create.jwts[3], /^PASTE_CREATE_GOOGLE_2_JWT_HERE$/);
    assert.match(written.submit.jwts[2], /^PASTE_SUBMIT_APPLE_1_JWT_HERE$/);
    assert.match(written.txKeyAddress, /^0x[0-9a-f]{40}$/);
    assert.match(written.newTxKeyAddress, /^0x[0-9a-f]{40}$/);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
