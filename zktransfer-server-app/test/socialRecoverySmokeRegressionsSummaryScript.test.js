import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-regressions-summary-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-summary.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-summary.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-overview.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-overview.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-regressions-summary prints overview, paths, and history preview", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "regressions.json"),
    JSON.stringify({ regressionCount: 1, windowSize: 10, regressions: [{ name: "snap-2" }] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-history.json"),
    JSON.stringify({ snapshotCount: 3, unstableCount: 1, gateFailingCount: 1 }, null, 2)
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
    JSON.stringify({ regressions: { regressionCount: 1 } }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-gate.json"),
    JSON.stringify({ ok: false, issueCount: 2, issues: ["gate failed"] }, null, 2)
  );
  fs.writeFileSync(path.join(baseDir, "history.md"), "# History\n\n- snapshots: 2\n");

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-summary.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-summary.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Regressions Summary/);
    assert.match(text.stdout, /latestRegressionsHistoryPath/);
    assert.match(text.stdout, /latestRegressionsHistoryJsonPath/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingPath/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingJsonPath/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingComparePath/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareJsonPath/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareCheckPath/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareCheckJsonPath/);
    assert.match(text.stdout, /latestRegressionsHistoryComparePath/);
    assert.match(text.stdout, /latestRegressionsHistoryCompareCheckPath/);
    assert.match(text.stdout, /hasRegressionsHistoryCompare: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailing: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailingCompare: true/);
    assert.match(text.stdout, /hasRegressionsHistoryGateFailingCompareCheck: true/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareCheckOk: false/);
    assert.match(text.stdout, /regressionsHistoryGateFailingCompareCheckIssueCount: 4/);
    assert.match(text.stdout, /hasRegressionsGate: true/);
    assert.match(text.stdout, /regressionsGateOk: false/);
    assert.match(text.stdout, /regressionsGateIssueCount: 2/);
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
    assert.match(text.stdout, /latestRegressionsChangesPath/);
    assert.match(text.stdout, /latestRegressionsGatePath/);
    assert.match(text.stdout, /latestRegressionsGateJsonPath/);
    assert.match(text.stdout, /History Preview/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.overview.regressionCount, 1);
    assert.equal(parsed.overview.hasRegressionsGate, true);
    assert.equal(parsed.overview.regressionsGateOk, false);
    assert.equal(parsed.overview.regressionsGateIssueCount, 2);
    assert.equal(parsed.overview.hasRegressionsHistory, true);
    assert.equal(parsed.overview.hasRegressionsHistoryGateFailing, true);
    assert.equal(parsed.overview.hasRegressionsHistoryGateFailingCompare, true);
    assert.equal(parsed.overview.hasRegressionsHistoryGateFailingCompareCheck, true);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCompareCheckOk, false);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCompareCheckIssueCount, 4);
    assert.equal(parsed.overview.hasRegressionsHistoryCompare, true);
    assert.equal(parsed.overview.hasRegressionsHistoryCompareCheck, true);
    assert.equal(parsed.overview.regressionsHistoryCompareCheckOk, false);
    assert.equal(parsed.overview.regressionsHistoryCompareCheckIssueCount, 2);
    assert.equal(parsed.overview.regressionsHistorySnapshotCount, 3);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCount, 1);
    assert.equal(parsed.overview.regressionsHistoryGateFailingSnapshotCount, 1);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCompareGateFailingCountDelta, 1);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCompareGateIssueCountDelta, 4);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCompareAddedGateFailingCount, 1);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCompareChangedToGateFailingCount, 1);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCompareWorseningDetected, true);
    assert.equal(parsed.overview.regressionsHistoryGateFailingCompareWorseningSignalCount, 3);
    assert.equal(parsed.overview.regressionsHistoryCompareChangedStatusCount, 1);
    assert.equal(parsed.overview.regressionsHistoryCompareGateFailingCountDelta, 1);
    assert.equal(parsed.overview.regressionsHistoryCompareGateIssueCountDelta, 4);
    assert.equal(parsed.overview.regressionsHistoryCompareAddedGateFailingCount, 1);
    assert.equal(parsed.overview.regressionsHistoryCompareChangedToGateFailingCount, 1);
    assert.equal(parsed.overview.regressionsHistoryCompareWorseningSignalCount, 7);
    assert.equal(
      parsed.paths.latestRegressionsHistoryPath.endsWith("regressions-history.txt"),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryJsonPath.endsWith("regressions-history.json"),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryGateFailingPath.endsWith(
        "regressions-history-gate-failing.txt"
      ),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryGateFailingJsonPath.endsWith(
        "regressions-history-gate-failing.json"
      ),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryGateFailingComparePath.endsWith(
        "regressions-history-gate-failing-compare.txt"
      ),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryGateFailingCompareJsonPath.endsWith(
        "regressions-history-gate-failing-compare.json"
      ),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryGateFailingCompareCheckPath.endsWith(
        "regressions-history-gate-failing-compare-check.txt"
      ),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryGateFailingCompareCheckJsonPath.endsWith(
        "regressions-history-gate-failing-compare-check.json"
      ),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryComparePath.endsWith(
        "regressions-history-compare.txt"
      ),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsHistoryCompareCheckPath.endsWith(
        "regressions-history-compare-check.txt"
      ),
      true
    );
    assert.equal(parsed.paths.latestRegressionsChangesPath.endsWith("regressions-changes.txt"), true);
    assert.equal(parsed.paths.latestRegressionsGatePath.endsWith("regressions-gate.txt"), true);
    assert.equal(parsed.paths.latestRegressionsGateJsonPath.endsWith("regressions-gate.json"), true);
    assert.match(parsed.historyPreview, /snapshots: 2/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
