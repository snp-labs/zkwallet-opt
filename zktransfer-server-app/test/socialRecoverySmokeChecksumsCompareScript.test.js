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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-checksum-compare-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  for (const fileName of [
    "social-recovery-smoke-checksums-compare.mjs",
    "social-recovery-smoke-compare-core.mjs",
    "social-recovery-smoke-bundle-core.mjs",
  ]) {
    fs.copyFileSync(
      path.join(process.cwd(), "scripts", fileName),
      path.join(tempDir, "scripts", fileName)
    );
  }
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

function writeChecksums(dir, manifestValue, reportValue) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ value: manifestValue }, null, 2));
  fs.writeFileSync(path.join(dir, "report.md"), `# ${reportValue}\n`);
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

test("social-recovery-smoke-checksums:compare compares latest and previous snapshots", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const latestDir = path.join(snapshotsDir, "snap-2");
  const previousDir = path.join(snapshotsDir, "snap-1");

  writeChecksums(latestDir, "latest", "Latest");
  writeChecksums(previousDir, "previous", "Previous");
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", snapshotDir: latestDir },
          { name: "snap-1", snapshotDir: previousDir },
        ],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-checksums-compare.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-checksums-compare.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Changed artifacts:/);
    assert.match(text.stdout, /manifest\.json:/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.latest.name, "snap-2");
    assert.equal(parsed.previous.name, "snap-1");
    assert.equal(parsed.changedArtifacts.some((entry) => entry.path === "manifest.json"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-checksums:compare supports explicit snapshot names", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const latestDir = path.join(snapshotsDir, "snap-3");
  const middleDir = path.join(snapshotsDir, "snap-2");
  const previousDir = path.join(snapshotsDir, "snap-1");

  writeChecksums(latestDir, "same", "Latest");
  writeChecksums(middleDir, "same", "Middle");
  writeChecksums(previousDir, "old", "Previous");
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-3", snapshotDir: latestDir },
          { name: "snap-2", snapshotDir: middleDir },
          { name: "snap-1", snapshotDir: previousDir },
        ],
      },
      null,
      2
    )
  );

  try {
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-checksums-compare.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--latest-name",
        "snap-2",
        "--previous-name",
        "snap-1",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.latest.name, "snap-2");
    assert.equal(parsed.previous.name, "snap-1");
    assert.equal(parsed.changedArtifacts.some((entry) => entry.path === "manifest.json"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
