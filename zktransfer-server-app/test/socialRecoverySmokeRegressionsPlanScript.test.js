import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-plan-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-plan.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-plan starts with export when no regression bundle exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.match(parsed.steps[0], /social-recovery:smoke:export/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prefers regressions changes when available", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-changes.json"),
    JSON.stringify({ regressions: { regressionCount: 2 } }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:changes",
      "npm run social-recovery:smoke:regressions:overview",
      "npm run social-recovery:smoke:regressions:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prefers regressions gate when saved gate is failing", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-gate.json"),
    JSON.stringify({ ok: false, issueCount: 2, issues: ["gate failed"] }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
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
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:gate",
      "npm run social-recovery:smoke:regressions:report",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prioritizes integrity when saved integrity is failing", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-integrity.json"),
    JSON.stringify({ ok: false, issues: ["missing regressions-status.txt"] }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsIntegrity, true);
    assert.equal(parsed.regressionsIntegrityOk, false);
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:integrity",
      "npm run social-recovery:smoke:regressions:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prefers regressions history when only timeline artifact exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify({ snapshotCount: 5, unstableCount: 2 }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistory, true);
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:history:unstable",
      "npm run social-recovery:smoke:regressions",
      "npm run social-recovery:smoke:regressions:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prefers gate-failing history when saved timeline shows gate failures", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify({ snapshotCount: 5, unstableCount: 2, gateFailingCount: 1 }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.regressionsHistoryGateFailingCount, 1);
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:history:gate-failing",
      "npm run social-recovery:smoke:regressions:history",
      "npm run social-recovery:smoke:regressions:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prefers gate-failing compare check when saved artifact is failing", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare-check.json"),
    JSON.stringify({ ok: false, issueCount: 2 }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistoryGateFailingCompareCheck, true);
    assert.equal(parsed.regressionsHistoryGateFailingCompareCheckOk, false);
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check",
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
      "npm run social-recovery:smoke:regressions:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prefers gate-failing compare when saved delta exists without check failure", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare.json"),
    JSON.stringify({ gateFailingCountDelta: 1, worseningDetected: false }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistoryGateFailingCompare, true);
    assert.equal(parsed.regressionsHistoryGateFailingCompareWorseningDetected, false);
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:history:gate-failing:compare",
      "npm run social-recovery:smoke:regressions:history:gate-failing",
      "npm run social-recovery:smoke:regressions:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prefers history compare check when timeline delta worsens", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify({ snapshotCount: 5, unstableCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare.json"),
    JSON.stringify(
      {
        unstableCountDelta: 1,
        changedStatuses: [{ name: "snap-3" }],
        worseningDetected: true,
      },
      null,
      2
    )
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistoryCompare, true);
    assert.equal(parsed.regressionsHistoryCompareWorseningDetected, true);
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:history:compare:check",
      "npm run social-recovery:smoke:regressions:history:compare",
      "npm run social-recovery:smoke:regressions:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-regressions-plan prefers saved history compare check artifact when it is failing", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare-check.json"),
    JSON.stringify({ ok: false, issueCount: 1 }, null, 2)
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hasRegressionsHistoryCompareCheck, true);
    assert.equal(parsed.regressionsHistoryCompareCheckOk, false);
    assert.deepEqual(parsed.steps, [
      "npm run social-recovery:smoke:regressions:history:compare:check",
      "npm run social-recovery:smoke:regressions:history:compare",
      "npm run social-recovery:smoke:regressions:doctor",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
