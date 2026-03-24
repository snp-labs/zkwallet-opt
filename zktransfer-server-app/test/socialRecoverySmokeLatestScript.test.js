import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-latest-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "latest"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-latest.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-latest.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-latest prints latest report and manifest JSON", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const reportPath = path.join(latestDir, "report.md");

  fs.writeFileSync(reportPath, "# Latest Report\n\n- txHash: 0x123\n");
  fs.writeFileSync(
    path.join(latestDir, "manifest.json"),
    JSON.stringify(
      {
        accountId: "latest-account",
        submitTransactionHash: "0x123",
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-latest.mjs"),
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-latest.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /Latest Report/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.reportPath, reportPath);
    assert.equal(parsed.manifest.accountId, "latest-account");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
