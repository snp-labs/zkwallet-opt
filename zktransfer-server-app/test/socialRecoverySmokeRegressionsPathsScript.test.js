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
    path.join(os.tmpdir(), "zktransfer-social-regressions-paths-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-paths.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-paths.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-regressions-paths reports regression artifact locations", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-9", snapshotDir: "/tmp/snap-9" },
          { name: "snap-8", snapshotDir: "/tmp/snap-8" },
        ],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-paths.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-paths.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /snapshotCount: 2/);
    assert.match(text.stdout, /latestSnapshotName: snap-9/);
    assert.match(text.stdout, /latestRegressionsPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingComparePath:/);
    assert.match(text.stdout, /latestRegressionsHistoryGateFailingCompareCheckPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryComparePath:/);
    assert.match(text.stdout, /latestRegressionsComparePath:/);
    assert.match(text.stdout, /latestRegressionsChangesPath:/);
    assert.match(text.stdout, /latestRegressionsStatusPath:/);
    assert.match(text.stdout, /latestRegressionsOverviewPath:/);
    assert.match(text.stdout, /latestRegressionsPlanPath:/);
    assert.match(text.stdout, /latestRegressionsNextPath:/);
    assert.match(text.stdout, /latestRegressionsSummaryPath:/);
    assert.match(text.stdout, /latestRegressionsDoctorPath:/);
    assert.match(text.stdout, /latestRegressionsReportPath:/);
    assert.match(text.stdout, /latestRegressionsIntegrityPath:/);

    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.snapshotCount, 2);
    assert.equal(parsed.latestSnapshotName, "snap-9");
    assert.equal(parsed.previousSnapshotName, "snap-8");
    assert.match(parsed.latestRegressionsPath, /regressions\.txt$/);
    assert.match(parsed.latestRegressionsHistoryPath, /regressions-history\.txt$/);
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
    assert.match(
      parsed.latestRegressionsHistoryComparePath,
      /regressions-history-compare\.txt$/
    );
    assert.match(
      parsed.latestRegressionsHistoryCompareCheckPath,
      /regressions-history-compare-check\.txt$/
    );
    assert.match(parsed.latestRegressionsComparePath, /regressions-compare\.txt$/);
    assert.match(parsed.latestRegressionsChangesPath, /regressions-changes\.txt$/);
    assert.match(parsed.latestRegressionsStatusPath, /regressions-status\.txt$/);
    assert.match(parsed.latestRegressionsOverviewPath, /regressions-overview\.md$/);
    assert.match(parsed.latestRegressionsPlanPath, /regressions-plan\.txt$/);
    assert.match(parsed.latestRegressionsNextPath, /regressions-next\.txt$/);
    assert.match(parsed.latestRegressionsSummaryPath, /regressions-summary\.md$/);
    assert.match(parsed.latestRegressionsDoctorPath, /regressions-doctor\.txt$/);
    assert.match(parsed.latestRegressionsGatePath, /regressions-gate\.txt$/);
    assert.match(parsed.latestRegressionsReportPath, /regressions-report\.md$/);
    assert.match(parsed.latestRegressionsIntegrityPath, /regressions-integrity\.txt$/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
