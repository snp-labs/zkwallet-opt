import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-gate-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  for (const fileName of [
    "social-recovery-smoke-regressions-gate.mjs",
    "social-recovery-smoke-regressions-gate-core.mjs",
  ]) {
    fs.copyFileSync(
      path.join(process.cwd(), "scripts", fileName),
      path.join(tempDir, "scripts", fileName)
    );
  }
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-gate passes when integrity, doctor, and compare-check all pass", async () => {
  const tempDir = createTempApp();
  const latestDir = path.join(tempDir, "tmp", "social-recovery-smoke-report", "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(path.join(latestDir, "regressions.json"), JSON.stringify({ regressionCount: 0 }, null, 2));
  fs.writeFileSync(path.join(latestDir, "regressions-integrity.json"), JSON.stringify({ ok: true, issues: [] }, null, 2));
  fs.writeFileSync(path.join(latestDir, "regressions-doctor.json"), JSON.stringify({ ok: true, issues: [] }, null, 2));
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare-check.json"),
    JSON.stringify({ ok: true, issueCount: 0 }, null, 2)
  );
  fs.writeFileSync(path.join(latestDir, "regressions-history-compare-check.json"), JSON.stringify({ ok: true, issueCount: 0 }, null, 2));

  try {
    const { stdout } = await execFileAsync(
      "node",
      [path.join(tempDir, "scripts", "social-recovery-smoke-regressions-gate.mjs"), "--json"],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.issueCount, 0);
    assert.equal(parsed.hasRegressionsHistoryGateFailingCompareCheck, true);
    assert.equal(parsed.regressionsHistoryGateFailingCompareCheckOk, true);
    assert.equal(parsed.nextCommand, "npm run social-recovery:smoke:regressions:report");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-gate fails when compare-check is failing", async () => {
  const tempDir = createTempApp();
  const latestDir = path.join(tempDir, "tmp", "social-recovery-smoke-report", "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(path.join(latestDir, "regressions.json"), JSON.stringify({ regressionCount: 2 }, null, 2));
  fs.writeFileSync(path.join(latestDir, "regressions-integrity.json"), JSON.stringify({ ok: true, issues: [] }, null, 2));
  fs.writeFileSync(path.join(latestDir, "regressions-doctor.json"), JSON.stringify({ ok: true, issues: [] }, null, 2));
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare-check.json"),
    JSON.stringify({ ok: true, issueCount: 0 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare-check.json"),
    JSON.stringify({ ok: false, issueCount: 2, issues: ["worsened"] }, null, 2)
  );

  try {
    await assert.rejects(
      execFileAsync(
        "node",
        [path.join(tempDir, "scripts", "social-recovery-smoke-regressions-gate.mjs"), "--json"],
        { cwd: tempDir, encoding: "utf8" }
      ),
      (error) => {
        const parsed = JSON.parse(error.stdout);
        assert.equal(parsed.ok, false);
        assert.equal(parsed.regressionsHistoryCompareCheckIssueCount, 2);
        assert.match(parsed.issues.join("\n"), /history-compare-check/);
        assert.equal(
          parsed.nextCommand,
          "npm run social-recovery:smoke:regressions:history:compare:check"
        );
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-gate fails when gate-failing compare-check is failing", async () => {
  const tempDir = createTempApp();
  const latestDir = path.join(tempDir, "tmp", "social-recovery-smoke-report", "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(path.join(latestDir, "regressions.json"), JSON.stringify({ regressionCount: 2 }, null, 2));
  fs.writeFileSync(path.join(latestDir, "regressions-integrity.json"), JSON.stringify({ ok: true, issues: [] }, null, 2));
  fs.writeFileSync(path.join(latestDir, "regressions-doctor.json"), JSON.stringify({ ok: true, issues: [] }, null, 2));
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare-check.json"),
    JSON.stringify({ ok: false, issueCount: 3, issues: ["gate failures worsened"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare-check.json"),
    JSON.stringify({ ok: true, issueCount: 0 }, null, 2)
  );

  try {
    await assert.rejects(
      execFileAsync(
        "node",
        [path.join(tempDir, "scripts", "social-recovery-smoke-regressions-gate.mjs"), "--json"],
        { cwd: tempDir, encoding: "utf8" }
      ),
      (error) => {
        const parsed = JSON.parse(error.stdout);
        assert.equal(parsed.ok, false);
        assert.equal(parsed.hasRegressionsHistoryGateFailingCompareCheck, true);
        assert.equal(parsed.regressionsHistoryGateFailingCompareCheckOk, false);
        assert.equal(parsed.regressionsHistoryGateFailingCompareCheckIssueCount, 3);
        assert.match(parsed.issues.join("\n"), /gate-failing-compare-check/);
        assert.equal(
          parsed.nextCommand,
          "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check"
        );
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
