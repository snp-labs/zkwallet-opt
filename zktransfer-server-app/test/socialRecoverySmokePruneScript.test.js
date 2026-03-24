import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-prune-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-prune.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-prune.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

function seedExportDir(baseDir) {
  const snapshotsDir = path.join(baseDir, "snapshots");
  fs.mkdirSync(snapshotsDir, { recursive: true });
  const snapshots = [
    { name: "snap-3", generatedAt: "2026-03-24T12:00:00Z" },
    { name: "snap-2", generatedAt: "2026-03-24T11:00:00Z" },
    { name: "snap-1", generatedAt: "2026-03-24T10:00:00Z" },
  ].map((entry) => ({
    ...entry,
    snapshotDir: path.join(snapshotsDir, entry.name),
    accountId: entry.name,
  }));

  for (const snapshot of snapshots) {
    fs.mkdirSync(snapshot.snapshotDir, { recursive: true });
    fs.writeFileSync(path.join(snapshot.snapshotDir, "report.md"), `# ${snapshot.name}\n`);
  }

  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify({ snapshots }, null, 2)
  );
  fs.writeFileSync(
    path.join(baseDir, "history.md"),
    "# Social Recovery Smoke History\n\n- snapshots: 3\n"
  );
}

test("social-recovery-smoke-prune dry-run leaves snapshots untouched", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  seedExportDir(baseDir);

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-prune.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--keep",
        "2",
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    const result = JSON.parse(stdout);
    assert.equal(result.apply, false);
    assert.deepEqual(result.prunedSnapshots, ["snap-1"]);
    assert.equal(
      fs.existsSync(path.join(baseDir, "snapshots", "snap-1", "report.md")),
      true
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-prune apply removes old snapshots and rewrites history", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  seedExportDir(baseDir);

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-prune.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--keep",
        "2",
        "--apply",
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    const result = JSON.parse(stdout);
    const nextIndex = JSON.parse(
      fs.readFileSync(path.join(baseDir, "snapshots", "index.json"), "utf8")
    );
    const nextHistory = fs.readFileSync(path.join(baseDir, "history.md"), "utf8");

    assert.equal(result.apply, true);
    assert.deepEqual(result.keptSnapshots, ["snap-3", "snap-2"]);
    assert.deepEqual(result.prunedSnapshots, ["snap-1"]);
    assert.equal(
      fs.existsSync(path.join(baseDir, "snapshots", "snap-1", "report.md")),
      false
    );
    assert.deepEqual(
      nextIndex.snapshots.map((entry) => entry.name),
      ["snap-3", "snap-2"]
    );
    assert.match(nextHistory, /snapshots: 2/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
