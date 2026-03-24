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
    path.join(os.tmpdir(), "zktransfer-social-regressions-changes-snapshot-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-changes-snapshot.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-changes-snapshot.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-changes-snapshot prints named snapshot regression changes", async () => {
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
  fs.writeFileSync(path.join(snapOneDir, "regressions-changes.txt"), "# Regression Changes One\n");
  fs.writeFileSync(path.join(snapTwoDir, "regressions-changes.txt"), "# Regression Changes Two\n");
  fs.writeFileSync(
    path.join(snapOneDir, "regressions-changes.json"),
    JSON.stringify(
      { regressions: { regressionCount: 3 }, regressionsCompare: { regressionCountDelta: 2 } },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(snapTwoDir, "regressions-changes.json"),
    JSON.stringify(
      { regressions: { regressionCount: 0 }, regressionsCompare: { regressionCountDelta: 0 } },
      null,
      2
    )
  );

  try {
    const defaultText = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-changes-snapshot.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const namedJson = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-changes-snapshot.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-1",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(defaultText.stdout, /Regression Changes Two/);
    const parsed = JSON.parse(namedJson.stdout);
    assert.equal(parsed.snapshot.name, "snap-1");
    assert.equal(parsed.changes.regressions.regressionCount, 3);
    assert.equal(parsed.changes.regressionsCompare.regressionCountDelta, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
