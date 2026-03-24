import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-compare-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-compare.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-compare.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-compare-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-compare-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-compare summarizes latest two snapshots", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const latestDir = path.join(snapshotsDir, "snap-2");
  const previousDir = path.join(snapshotsDir, "snap-1");

  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(previousDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", generatedAt: "2026-03-24T10:00:00Z", snapshotDir: latestDir },
          { name: "snap-1", generatedAt: "2026-03-24T09:00:00Z", snapshotDir: previousDir },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "manifest.json"),
    JSON.stringify(
      {
        accountId: "account-1",
        zkAccountAddress: "0xabc",
        submitTransactionHash: "0x222",
        submitUserOpHash: "0xbbb",
        challengeNonce: "0xnonce-2",
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(previousDir, "manifest.json"),
    JSON.stringify(
      {
        accountId: "account-1",
        zkAccountAddress: "0xabc",
        submitTransactionHash: "0x111",
        submitUserOpHash: "0xaaa",
        challengeNonce: "0xnonce-1",
      },
      null,
      2
    )
  );
  for (const dir of [latestDir, previousDir]) {
    fs.writeFileSync(path.join(dir, "report.md"), `# ${path.basename(dir)}\n`);
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ ok: true }, null, 2));
    fs.writeFileSync(
      path.join(dir, "input.redacted.json"),
      JSON.stringify({ providers: ["google"] }, null, 2)
    );
    const files = ["manifest.json", "report.md", "result.json", "input.redacted.json"].map(
      (fileName) => ({
        path: fileName,
        sha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(dir, fileName)))
          .digest("hex"),
      })
    );
    fs.writeFileSync(path.join(dir, "checksums.json"), JSON.stringify({ files }, null, 2));
  }

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-compare.mjs"),
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-compare.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /Changed fields:/);
    assert.match(text.stdout, /submitTransactionHash: 0x111 -> 0x222/);
    assert.match(text.stdout, /Artifact checksum changes:/);
    assert.match(text.stdout, /manifest\.json:/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.latest.name, "snap-2");
    assert.equal(parsed.previous.name, "snap-1");
    assert.deepEqual(
      parsed.changedFields.map((entry) => entry.label).sort(),
      ["challengeNonce", "submitTransactionHash", "submitUserOpHash"]
    );
    assert.deepEqual(parsed.unchangedFields.sort(), ["accountId", "zkAccountAddress"]);
    assert.equal(parsed.changedArtifacts.some((entry) => entry.path === "manifest.json"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
