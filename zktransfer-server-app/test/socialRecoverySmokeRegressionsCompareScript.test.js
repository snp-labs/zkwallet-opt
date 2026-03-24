import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-compare-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-compare.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-compare-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-regressions:compare summarizes latest two regression bundles", async () => {
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
          { name: "snap-2", snapshotDir: latestDir },
          { name: "snap-1", snapshotDir: previousDir },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify(
      {
        regressionCount: 2,
        ok: false,
        regressions: [{ name: "snap-2" }, { name: "snap-legacy" }],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(previousDir, "regressions.json"),
    JSON.stringify(
      {
        regressionCount: 1,
        ok: false,
        regressions: [{ name: "snap-legacy" }],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /regressionCountDelta: 1/);
    assert.match(text.stdout, /added: snap-2/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.latest.name, "snap-2");
    assert.equal(parsed.previous.name, "snap-1");
    assert.equal(parsed.regressionCountDelta, 1);
    assert.deepEqual(parsed.addedSnapshotNames, ["snap-2"]);
    assert.deepEqual(parsed.removedSnapshotNames, []);
    assert.deepEqual(parsed.unchangedSnapshotNames, ["snap-legacy"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
