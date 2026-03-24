import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-changes-previous-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-changes-previous.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-changes-previous.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-changes:previous prints the second-most-recent snapshot changes", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const snapOneDir = path.join(snapshotsDir, "snap-1");
  const snapTwoDir = path.join(snapshotsDir, "snap-2");

  fs.mkdirSync(snapOneDir, { recursive: true });
  fs.mkdirSync(snapTwoDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", snapshotDir: snapTwoDir },
          { name: "snap-1", snapshotDir: snapOneDir },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(snapOneDir, "changes.txt"), "# Previous Changes\n");
  fs.writeFileSync(path.join(snapTwoDir, "changes.txt"), "# Latest Changes\n");
  fs.writeFileSync(
    path.join(snapOneDir, "changes.json"),
    JSON.stringify({ compare: { changedFields: [{ label: "submitTransactionHash" }] } }, null, 2)
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-changes-previous.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-changes-previous.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Previous Changes/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.snapshot.name, "snap-1");
    assert.equal(parsed.changes.compare.changedFields[0].label, "submitTransactionHash");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
