import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-paths-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-paths.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-paths.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-paths reports export locations and snapshot names", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", snapshotDir: "/tmp/snap-2" },
          { name: "snap-1", snapshotDir: "/tmp/snap-1" },
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
        path.join(tempDir, "scripts", "social-recovery-smoke-paths.mjs"),
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
        path.join(tempDir, "scripts", "social-recovery-smoke-paths.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /snapshotCount: 2/);
    assert.match(text.stdout, /latestSnapshotName: snap-2/);
    assert.match(text.stdout, /latestPlanPath:/);
    assert.match(text.stdout, /latestSummaryPath:/);
    assert.match(text.stdout, /latestChangesPath:/);
    assert.match(text.stdout, /latestTrendPath:/);
    assert.match(text.stdout, /latestStabilityPath:/);
    assert.match(text.stdout, /latestRegressionsPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryPath:/);
    assert.match(text.stdout, /latestRegressionsHistoryComparePath:/);
    assert.match(text.stdout, /latestRegressionsHistoryCompareCheckPath:/);
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
    assert.match(text.stdout, /latestChecksumsPath:/);
    assert.match(text.stdout, /latestChecksumsComparePath:/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.snapshotCount, 2);
    assert.equal(parsed.latestSnapshotName, "snap-2");
    assert.equal(parsed.previousSnapshotName, "snap-1");
    assert.match(parsed.latestPlanPath, /plan\.txt$/);
    assert.match(parsed.latestSummaryPath, /summary\.md$/);
    assert.match(parsed.latestChangesPath, /changes\.txt$/);
    assert.match(parsed.latestTrendPath, /trend\.txt$/);
    assert.match(parsed.latestStabilityPath, /stability\.txt$/);
    assert.match(parsed.latestRegressionsPath, /regressions\.txt$/);
    assert.match(parsed.latestRegressionsHistoryPath, /regressions-history\.txt$/);
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
    assert.match(parsed.latestChecksumsPath, /checksums\.json$/);
    assert.match(parsed.latestChecksumsComparePath, /checksums-compare\.txt$/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
