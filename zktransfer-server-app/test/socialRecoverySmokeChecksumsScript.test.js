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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-checksums-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-checksums.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-checksums.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-bundle-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-bundle-core.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

function seedChecksums(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ accountId: "a-1" }, null, 2));
  fs.writeFileSync(path.join(dir, "report.md"), "# Report\n");
  const files = ["manifest.json", "report.md"].map((fileName) => ({
    path: fileName,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(dir, fileName)))
      .digest("hex"),
  }));
  fs.writeFileSync(path.join(dir, "checksums.json"), JSON.stringify({ files }, null, 2));
  fs.writeFileSync(
    path.join(dir, "checksums.txt"),
    files.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n"
  );
}

test("social-recovery-smoke-checksums prints latest checksum bundle", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  seedChecksums(latestDir);

  try {
    const text = await execFileAsync(
      "node",
      [path.join(tempDir, "scripts", "social-recovery-smoke-checksums.mjs"), "--base-dir", baseDir],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-checksums.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Social Recovery Smoke Checksums/);
    assert.match(text.stdout, /snapshotName: \(latest\)/);
    const result = JSON.parse(json.stdout);
    assert.equal(result.target.kind, "latest");
    assert.equal(result.checksums.files.length, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-checksums prints named snapshot checksum text", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const snapshotDir = path.join(snapshotsDir, "snap-1");
  seedChecksums(snapshotDir);
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify({ snapshots: [{ name: "snap-1", snapshotDir }] }, null, 2)
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-checksums.mjs"),
        "--text",
        "--base-dir",
        baseDir,
        "--name",
        "snap-1",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /manifest\.json/);
    assert.match(text.stdout, /report\.md/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
