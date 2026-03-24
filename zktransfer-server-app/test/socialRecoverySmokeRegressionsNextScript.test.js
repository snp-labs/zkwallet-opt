import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-next-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-next.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-next recommends export when no saved regression bundle exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.match(parsed.command, /social-recovery:smoke:export/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next recommends regressions:changes when combined artifact exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-changes.json"),
    JSON.stringify({ regressions: { regressionCount: 1 } }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsChanges, true);
    assert.equal(parsed.command, "npm run social-recovery:smoke:regressions:changes");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next prefers regressions:gate when saved gate is failing", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-gate.json"),
    JSON.stringify({ ok: false, issueCount: 2, issues: ["gate failed"] }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsGate, true);
    assert.equal(parsed.regressionsGateOk, false);
    assert.equal(parsed.regressionsGateIssueCount, 2);
    assert.equal(parsed.command, "npm run social-recovery:smoke:regressions:gate");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next recommends regressions:history:unstable when only history is available", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify({ snapshotCount: 3, unstableCount: 1 }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistory, true);
    assert.equal(parsed.command, "npm run social-recovery:smoke:regressions:history:unstable");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next recommends regressions:history:gate-failing when saved history shows gate-failing snapshots", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify({ snapshotCount: 3, unstableCount: 1, gateFailingCount: 1 }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.regressionsHistoryGateFailingCount, 1);
    assert.equal(parsed.command, "npm run social-recovery:smoke:regressions:history:gate-failing");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next prefers gate-failing compare check when saved artifact is failing", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare-check.json"),
    JSON.stringify({ ok: false, issueCount: 2 }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistoryGateFailingCompareCheck, true);
    assert.equal(parsed.regressionsHistoryGateFailingCompareCheckOk, false);
    assert.equal(parsed.regressionsHistoryGateFailingCompareCheckIssueCount, 2);
    assert.equal(
      parsed.command,
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check"
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next prefers gate-failing compare when saved delta exists without check failure", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare.json"),
    JSON.stringify({ gateFailingCountDelta: 1, worseningDetected: false }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistoryGateFailingCompare, true);
    assert.equal(parsed.regressionsHistoryGateFailingCompareWorseningDetected, false);
    assert.equal(
      parsed.command,
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare"
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next recommends regressions:history:compare:check when history delta worsens", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify({ snapshotCount: 3, unstableCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare.json"),
    JSON.stringify(
      {
        unstableCountDelta: 1,
        changedStatuses: [{ name: "snap-1" }],
        worseningDetected: true,
        worseningSignalCount: 2,
      },
      null,
      2
    )
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistoryCompare, true);
    assert.equal(parsed.regressionsHistoryCompareWorseningDetected, true);
    assert.equal(
      parsed.command,
      "npm run social-recovery:smoke:regressions:history:compare:check"
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next prefers saved history compare check artifact when it is failing", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare-check.json"),
    JSON.stringify({ ok: false, issueCount: 1 }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistoryCompareCheck, true);
    assert.equal(parsed.regressionsHistoryCompareCheckOk, false);
    assert.equal(
      parsed.command,
      "npm run social-recovery:smoke:regressions:history:compare:check"
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-next recommends regressions:integrity when saved integrity is failing", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-integrity.json"),
    JSON.stringify({ ok: false, issues: ["bad checksum"] }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsIntegrity, true);
    assert.equal(parsed.regressionsIntegrityOk, false);
    assert.equal(parsed.command, "npm run social-recovery:smoke:regressions:integrity");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
