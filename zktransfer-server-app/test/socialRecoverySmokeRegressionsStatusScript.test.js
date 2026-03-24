import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-status-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-status.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-status.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-status summarizes saved regression artifacts", async () => {
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
    JSON.stringify({ snapshotCount: 4, unstableCount: 2, gateFailingCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing.json"),
    JSON.stringify({ snapshotCount: 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare.json"),
    JSON.stringify(
      {
        gateFailingCountDelta: 1,
        gateIssueCountDelta: 4,
        addedGateFailingSnapshotNames: ["snap-4"],
        changedToGateFailingNames: ["snap-2"],
        worseningDetected: true,
        worseningSignalCount: 3,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-gate-failing-compare-check.json"),
    JSON.stringify({ ok: false, issueCount: 4, issues: ["gate failures increased"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare.json"),
    JSON.stringify(
      {
        unstableCountDelta: 1,
        gateFailingCountDelta: 1,
        gateIssueCountDelta: 4,
        changedStatuses: [{ name: "snap-2" }],
        addedUnstableSnapshotNames: ["snap-4"],
        changedToUnstableNames: ["snap-2"],
        addedGateFailingSnapshotNames: ["snap-4"],
        changedToGateFailingNames: ["snap-2"],
        worseningDetected: true,
        worseningSignalCount: 7,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare-check.json"),
    JSON.stringify({ ok: false, issueCount: 2, issues: ["unstable count increased"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1, addedSnapshotNames: ["snap-3"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-changes.json"),
    JSON.stringify({ regressions: { regressionCount: 2 } }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-integrity.json"),
    JSON.stringify({ ok: false, issues: ["missing regressions-report.md"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-gate.json"),
    JSON.stringify({ ok: false, issueCount: 3, issues: ["gate failed"] }, null, 2)
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-status.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-status.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /regressionCount: 2/);
    assert.match(text.stdout, /hasRegressionsHistory: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailing: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailingCompare: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailingCompareCheck: true/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareCheckOk: false/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareCheckIssueCount: 4/);
    assert.match(text.stdout, /hasRegressionsHistoryCompare: true/);
    assert.match(text.stdout, /hasRegressionsHistoryCompareCheck: true/);
    assert.match(text.stdout, /regressionsHistoryCompareCheckIssueCount: 2/);
    assert.match(text.stdout, /regressionsHistorySnapshotCount: 4/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingSnapshotCount: 1/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingJsonPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingComparePath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareJsonPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareCheckPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareCheckJsonPath:/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareGateFailingCountDelta: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareGateIssueCountDelta: 4/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareAddedGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareChangedToGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareWorseningDetected: true/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareWorseningSignalCount: 3/);
    assert.match(text.stdout, /regressionsHistoryCompareChangedStatusCount: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareAddedUnstableCount: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareChangedToUnstableCount: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareGateFailingCountDelta: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareGateIssueCountDelta: 4/);
    assert.match(text.stdout, /regressionsHistoryCompareAddedGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareChangedToGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareWorseningDetected: true/);
    assert.match(text.stdout, /regressionsHistoryCompareWorseningSignalCount: 7/);
    assert.match(text.stdout, /regressionCountDelta: 1/);
    assert.match(text.stdout, /regressionsIntegrityOk: false/);
    assert.match(text.stdout, /hasRegressionsGate: true/);
    assert.match(text.stdout, /regressionsGateOk: false/);
    assert.match(text.stdout, /regressionsGateIssueCount: 3/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.hasRegressionsGate, true);
    assert.equal(parsed.regressionsGateOk, false);
    assert.equal(parsed.regressionsGateIssueCount, 3);
    assert.equal(parsed.hasRegressionsHistory, true);
    assert.equal(parsed.hasRegressionsHistoryGateFailing, true);
    assert.equal(parsed.hasRegressionsHistoryGateFailingCompare, true);
    assert.equal(parsed.hasRegressionsHistoryGateFailingCompareCheck, true);
    assert.equal(parsed.regressionsHistoryGateFailingCompareCheckOk, false);
    assert.equal(parsed.regressionsHistoryGateFailingCompareCheckIssueCount, 4);
    assert.equal(parsed.hasRegressionsHistoryCompare, true);
    assert.equal(parsed.hasRegressionsHistoryCompareCheck, true);
    assert.equal(parsed.regressionsHistoryCompareCheckOk, false);
    assert.equal(parsed.regressionsHistoryCompareCheckIssueCount, 2);
    assert.equal(parsed.hasRegressionsChanges, true);
    assert.equal(parsed.hasRegressionsIntegrity, true);
    assert.equal(parsed.regressionsIntegrityOk, false);
    assert.equal(parsed.regressionsIntegrityIssueCount, 1);
    assert.equal(parsed.regressionCount, 2);
    assert.equal(parsed.regressionsHistorySnapshotCount, 4);
    assert.equal(parsed.regressionsHistoryUnstableCount, 2);
    assert.equal(parsed.regressionsHistoryGateFailingCount, 1);
    assert.equal(parsed.regressionsHistoryGateFailingSnapshotCount, 1);
    assert.match(
      parsed.latestRegressionsHistoryGateFailingPath,
      /regressions-history-gate-failing\.txt$/
    );
    assert.match(
      parsed.latestRegressionsHistoryGateFailingJsonPath,
      /regressions-history-gate-failing\.json$/
    );
    assert.match(
      parsed.latestRegressionsHistoryGateFailingComparePath,
      /regressions-history-gate-failing-compare\.txt$/
    );
    assert.match(
      parsed.latestRegressionsHistoryGateFailingCompareJsonPath,
      /regressions-history-gate-failing-compare\.json$/
    );
    assert.match(
      parsed.latestRegressionsHistoryGateFailingCompareCheckPath,
      /regressions-history-gate-failing-compare-check\.txt$/
    );
    assert.match(
      parsed.latestRegressionsHistoryGateFailingCompareCheckJsonPath,
      /regressions-history-gate-failing-compare-check\.json$/
    );
    assert.equal(parsed.regressionsHistoryGateFailingCompareGateFailingCountDelta, 1);
    assert.equal(parsed.regressionsHistoryGateFailingCompareGateIssueCountDelta, 4);
    assert.equal(parsed.regressionsHistoryGateFailingCompareAddedGateFailingCount, 1);
    assert.equal(parsed.regressionsHistoryGateFailingCompareChangedToGateFailingCount, 1);
    assert.equal(parsed.regressionsHistoryGateFailingCompareWorseningDetected, true);
    assert.equal(parsed.regressionsHistoryGateFailingCompareWorseningSignalCount, 3);
    assert.equal(parsed.regressionsHistoryCompareChangedStatusCount, 1);
    assert.equal(parsed.regressionsHistoryCompareAddedUnstableCount, 1);
    assert.equal(parsed.regressionsHistoryCompareChangedToUnstableCount, 1);
    assert.equal(parsed.regressionsHistoryCompareGateFailingCountDelta, 1);
    assert.equal(parsed.regressionsHistoryCompareGateIssueCountDelta, 4);
    assert.equal(parsed.regressionsHistoryCompareAddedGateFailingCount, 1);
    assert.equal(parsed.regressionsHistoryCompareChangedToGateFailingCount, 1);
    assert.equal(parsed.regressionsHistoryCompareWorseningDetected, true);
    assert.equal(parsed.regressionsHistoryCompareWorseningSignalCount, 7);
    assert.equal(parsed.regressionsHistoryCompareUnstableCountDelta, 1);
    assert.equal(parsed.regressionCountDelta, 1);
    assert.equal(parsed.suggestedCommands[0], "npm run social-recovery:smoke:regressions:gate");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
