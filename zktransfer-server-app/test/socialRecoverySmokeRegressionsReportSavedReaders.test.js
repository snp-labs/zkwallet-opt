import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "zktransfer-social-regressions-report-readers-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  for (const fileName of [
    "social-recovery-smoke-saved-artifact-core.mjs",
    "social-recovery-smoke-regressions-report-latest.mjs",
    "social-recovery-smoke-regressions-report-previous.mjs",
    "social-recovery-smoke-regressions-report-snapshot.mjs",
  ]) {
    fs.copyFileSync(
      path.join(process.cwd(), "scripts", fileName),
      path.join(tempDir, "scripts", fileName)
    );
  }
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

function seedSnapshot(snapshotDir, nameSuffix) {
  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(path.join(snapshotDir, "regressions-report.md"), `# report ${nameSuffix}\n`);
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-report.json"),
    JSON.stringify({ doctor: { ok: nameSuffix !== "previous" } }, null, 2)
  );
}

test("saved regressions report readers reopen latest, previous, and snapshot variants", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const previousDir = path.join(snapshotsDir, "snap-1");
  const latestSnapshotDir = path.join(snapshotsDir, "snap-2");

  seedSnapshot(latestDir, "latest");
  seedSnapshot(previousDir, "previous");
  seedSnapshot(latestSnapshotDir, "named");
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", snapshotDir: latestSnapshotDir },
          { name: "snap-1", snapshotDir: previousDir },
        ],
      },
      null,
      2
    )
  );

  try {
    const latest = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-report-latest.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const previous = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-report-previous.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const snapshot = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-report-snapshot.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    const parsedLatest = JSON.parse(latest.stdout);
    assert.equal(parsedLatest.report.doctor.ok, true);
    assert.match(parsedLatest.reportPath, /regressions-report\.md$/);
    assert.match(previous.stdout, /report previous/);
    const parsedSnapshot = JSON.parse(snapshot.stdout);
    assert.equal(parsedSnapshot.snapshot.name, "snap-2");
    assert.equal(parsedSnapshot.report.doctor.ok, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
