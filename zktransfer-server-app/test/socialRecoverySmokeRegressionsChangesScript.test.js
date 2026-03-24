import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-changes-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "latest"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-changes.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-changes.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-changes prints latest stored regression diff bundle", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");

  fs.writeFileSync(path.join(latestDir, "regressions.txt"), "# Social Recovery Smoke Regressions\n");
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.txt"),
    "# Social Recovery Smoke Regressions Compare\n\n- regressionCountDelta: 1\n"
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-changes.txt"),
    "# Social Recovery Smoke Regressions\n\n# Social Recovery Smoke Regressions Compare\n"
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-changes.json"),
    JSON.stringify(
      {
        regressions: { regressionCount: 1 },
        regressionsCompare: { regressionCountDelta: 1 },
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-changes.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-changes.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Regressions Compare/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.changes.regressions.regressionCount, 1);
    assert.equal(parsed.changes.regressionsCompare.regressionCountDelta, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
