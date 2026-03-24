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
    path.join(os.tmpdir(), "zktransfer-social-regressions-compare-snapshot-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-compare-snapshot.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare-snapshot.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-compare-snapshot prints named snapshot compare", async () => {
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
      { snapshots: [{ name: "snap-2", snapshotDir: snapTwoDir }, { name: "snap-1", snapshotDir: snapOneDir }] },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(snapOneDir, "regressions-compare.txt"), "# Compare One\n");
  fs.writeFileSync(path.join(snapTwoDir, "regressions-compare.txt"), "# Compare Two\n");
  fs.writeFileSync(
    path.join(snapOneDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapTwoDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 0 }, null, 2)
  );

  try {
    const defaultText = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare-snapshot.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const namedJson = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare-snapshot.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-1",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(defaultText.stdout, /Compare Two/);
    const parsed = JSON.parse(namedJson.stdout);
    assert.equal(parsed.snapshot.name, "snap-1");
    assert.equal(parsed.compare.regressionCountDelta, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
