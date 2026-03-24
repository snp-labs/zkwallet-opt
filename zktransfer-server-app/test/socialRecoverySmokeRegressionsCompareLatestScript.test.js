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
    path.join(os.tmpdir(), "zktransfer-social-regressions-compare-latest-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "latest"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-compare-latest.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare-latest.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-compare-latest prints latest regressions compare and JSON", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const comparePath = path.join(latestDir, "regressions-compare.txt");

  fs.writeFileSync(comparePath, "# Social Recovery Smoke Regressions Compare\n\n- regressionCountDelta: 1\n");
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1, addedSnapshotNames: ["snap-2"] }, null, 2)
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare-latest.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare-latest.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /regressionCountDelta: 1/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.comparePath, comparePath);
    assert.equal(parsed.compare.regressionCountDelta, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
