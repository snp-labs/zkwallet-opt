import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-trend-latest-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "latest"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-trend-latest.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-trend-latest.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-trend-latest prints latest trend and JSON", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const trendPath = path.join(latestDir, "trend.txt");

  fs.writeFileSync(trendPath, "# Social Recovery Smoke Trend\n\n- latestStable: true\n");
  fs.writeFileSync(
    path.join(latestDir, "trend.json"),
    JSON.stringify(
      {
        latestSnapshotName: "snap-2",
        latestStable: true,
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-trend-latest.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-trend-latest.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /latestStable: true/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.trendPath, trendPath);
    assert.equal(parsed.trend.latestSnapshotName, "snap-2");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
