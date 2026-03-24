import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-report-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  for (const fileName of [
    "social-recovery-smoke-regressions-report.mjs",
    "social-recovery-smoke-regressions-summary.mjs",
    "social-recovery-smoke-regressions-overview.mjs",
    "social-recovery-smoke-regressions-plan.mjs",
    "social-recovery-smoke-regressions-doctor.mjs",
  ]) {
    fs.copyFileSync(
      path.join(process.cwd(), "scripts", fileName),
      path.join(tempDir, "scripts", fileName)
    );
  }
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-report combines summary, plan, and doctor", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 2, windowSize: 10, regressions: [{ name: "snap-2" }] }, null, 2)
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
        addedGateFailingSnapshotNames: ["snap-2"],
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
    JSON.stringify({ ok: false, issueCount: 4 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history-compare.json"),
    JSON.stringify(
      {
        unstableCountDelta: 1,
        gateFailingCountDelta: 1,
        gateIssueCountDelta: 4,
        changedStatuses: [{ name: "snap-2" }],
        addedUnstableSnapshotNames: ["snap-2"],
        changedToUnstableNames: ["snap-2"],
        addedGateFailingSnapshotNames: ["snap-2"],
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
    JSON.stringify({ ok: false, issueCount: 2 }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1, addedSnapshotNames: ["snap-2"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-changes.json"),
    JSON.stringify({ regressions: { regressionCount: 2 } }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-integrity.json"),
    JSON.stringify({ ok: false, issues: ["missing regressions-summary.md"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-gate.json"),
    JSON.stringify({ ok: false, issueCount: 3, issues: ["gate failed"] }, null, 2)
  );
  fs.writeFileSync(path.join(baseDir, "history.md"), "# History\n\n- snapshots: 2\n");

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-report.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-report.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Regressions Report/);
    assert.match(text.stdout, /Regressions Summary/);
    assert.match(text.stdout, /## Plan/);
    assert.match(text.stdout, /## Gate/);
    assert.match(text.stdout, /## Doctor/);
    assert.match(text.stdout, /hasRegressionsHistory: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailing: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailingCompare: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailingCompareCheck: true/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareCheckOk: false/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareCheckIssueCount: 4/);
    assert.match(text.stdout, /hasRegressionsGate: true/);
    assert.match(text.stdout, /regressionsGateOk: false/);
    assert.match(text.stdout, /regressionsGateIssueCount: 3/);
    assert.match(text.stdout, /hasRegressionsHistoryCompare: true/);
    assert.match(text.stdout, /hasRegressionsHistoryCompareCheck: true/);
    assert.match(text.stdout, /regressionsHistoryCompareCheckOk: false/);
    assert.match(text.stdout, /regressionsHistoryCompareCheckIssueCount: 2/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingSnapshotCount: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareGateFailingCountDelta: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareGateIssueCountDelta: 4/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareAddedGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareChangedToGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareWorseningDetected: true/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareWorseningSignalCount: 3/);
    assert.match(text.stdout, /regressionsHistoryCompareGateFailingCountDelta: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareGateIssueCountDelta: 4/);
    assert.match(text.stdout, /regressionsHistoryCompareAddedGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareChangedToGateFailingCount: 1/);
    assert.match(text.stdout, /regressionsHistoryCompareWorseningSignalCount: 7/);
    assert.match(text.stdout, /regressionsIntegrityOk: false/);
    assert.match(text.stdout, /latestRegressionsHistoryJsonPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingJsonPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingComparePath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareJsonPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareCheckPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareCheckJsonPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryComparePath:/);
    assert.match(text.stdout, /latestRegressionsHistoryCompareCheckPath:/);
    assert.match(text.stdout, /latestRegressionsIntegrityPath:/);
    assert.match(text.stdout, /latestRegressionsGatePath:/);
    assert.match(text.stdout, /latestRegressionsGateJsonPath:/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.summary.overview.regressionCount, 2);
    assert.equal(parsed.summary.overview.hasRegressionsGate, true);
    assert.equal(parsed.summary.overview.regressionsGateOk, false);
    assert.equal(parsed.summary.overview.regressionsGateIssueCount, 3);
    assert.equal(parsed.summary.overview.hasRegressionsHistory, true);
    assert.equal(parsed.summary.overview.hasRegressionsHistoryGateFailing, true);
    assert.equal(parsed.summary.overview.hasRegressionsHistoryGateFailingCompare, true);
    assert.equal(parsed.summary.overview.hasRegressionsHistoryGateFailingCompareCheck, true);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCompareCheckOk, false);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCompareCheckIssueCount, 4);
    assert.equal(parsed.summary.overview.hasRegressionsHistoryCompare, true);
    assert.equal(parsed.summary.overview.hasRegressionsHistoryCompareCheck, true);
    assert.equal(parsed.summary.overview.regressionsHistoryCompareCheckOk, false);
    assert.equal(parsed.summary.overview.regressionsHistoryCompareCheckIssueCount, 2);
    assert.equal(parsed.summary.overview.regressionsHistorySnapshotCount, 4);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCount, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingSnapshotCount, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCompareGateFailingCountDelta, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCompareGateIssueCountDelta, 4);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCompareAddedGateFailingCount, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCompareChangedToGateFailingCount, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCompareWorseningDetected, true);
    assert.equal(parsed.summary.overview.regressionsHistoryGateFailingCompareWorseningSignalCount, 3);
    assert.equal(parsed.summary.overview.regressionsHistoryCompareChangedStatusCount, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryCompareGateFailingCountDelta, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryCompareGateIssueCountDelta, 4);
    assert.equal(parsed.summary.overview.regressionsHistoryCompareAddedGateFailingCount, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryCompareChangedToGateFailingCount, 1);
    assert.equal(parsed.summary.overview.regressionsHistoryCompareWorseningSignalCount, 7);
    assert.equal(parsed.summary.overview.regressionsIntegrityOk, false);
    assert.equal(parsed.summary.paths.latestRegressionsGatePath.endsWith("regressions-gate.txt"), true);
    assert.equal(parsed.summary.paths.latestRegressionsGateJsonPath.endsWith("regressions-gate.json"), true);
    assert.equal(
      parsed.summary.paths.latestRegressionsHistoryGateFailingPath.endsWith(
        "regressions-history-gate-failing.txt"
      ),
      true
    );
    assert.equal(
      parsed.summary.paths.latestRegressionsHistoryGateFailingJsonPath.endsWith(
        "regressions-history-gate-failing.json"
      ),
      true
    );
    assert.equal(
      parsed.summary.paths.latestRegressionsHistoryGateFailingComparePath.endsWith(
        "regressions-history-gate-failing-compare.txt"
      ),
      true
    );
    assert.equal(
      parsed.summary.paths.latestRegressionsHistoryGateFailingCompareJsonPath.endsWith(
        "regressions-history-gate-failing-compare.json"
      ),
      true
    );
    assert.equal(
      parsed.summary.paths.latestRegressionsHistoryGateFailingCompareCheckPath.endsWith(
        "regressions-history-gate-failing-compare-check.txt"
      ),
      true
    );
    assert.equal(
      parsed.summary.paths.latestRegressionsHistoryGateFailingCompareCheckJsonPath.endsWith(
        "regressions-history-gate-failing-compare-check.json"
      ),
      true
    );
    assert.equal(
      parsed.summary.paths.latestRegressionsIntegrityPath.endsWith("regressions-integrity.txt"),
      true
    );
    assert.equal(parsed.plan.steps[0], "npm run social-recovery:smoke:regressions:gate");
    assert.equal(parsed.doctor.ok, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
