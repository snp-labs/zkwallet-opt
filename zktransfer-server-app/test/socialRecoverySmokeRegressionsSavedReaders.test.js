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
    path.join(os.tmpdir(), "zktransfer-social-regressions-saved-readers-")
  );
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  for (const fileName of [
    "social-recovery-smoke-saved-artifact-core.mjs",
    "social-recovery-smoke-regressions-status-latest.mjs",
    "social-recovery-smoke-regressions-status-previous.mjs",
    "social-recovery-smoke-regressions-status-snapshot.mjs",
    "social-recovery-smoke-regressions-overview-latest.mjs",
    "social-recovery-smoke-regressions-overview-previous.mjs",
    "social-recovery-smoke-regressions-overview-snapshot.mjs",
    "social-recovery-smoke-regressions-history-latest.mjs",
    "social-recovery-smoke-regressions-history-previous.mjs",
    "social-recovery-smoke-regressions-history-snapshot.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-latest.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-previous.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-snapshot.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-compare-latest.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-compare-previous.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-compare-snapshot.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-compare-check-latest.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-compare-check-previous.mjs",
    "social-recovery-smoke-regressions-history-gate-failing-compare-check-snapshot.mjs",
    "social-recovery-smoke-regressions-history-compare-latest.mjs",
    "social-recovery-smoke-regressions-history-compare-previous.mjs",
    "social-recovery-smoke-regressions-history-compare-snapshot.mjs",
    "social-recovery-smoke-regressions-history-compare-check-latest.mjs",
    "social-recovery-smoke-regressions-history-compare-check-previous.mjs",
    "social-recovery-smoke-regressions-history-compare-check-snapshot.mjs",
    "social-recovery-smoke-regressions-summary-latest.mjs",
    "social-recovery-smoke-regressions-summary-previous.mjs",
    "social-recovery-smoke-regressions-summary-snapshot.mjs",
    "social-recovery-smoke-regressions-plan-latest.mjs",
    "social-recovery-smoke-regressions-plan-previous.mjs",
    "social-recovery-smoke-regressions-plan-snapshot.mjs",
    "social-recovery-smoke-regressions-doctor-latest.mjs",
    "social-recovery-smoke-regressions-doctor-previous.mjs",
    "social-recovery-smoke-regressions-doctor-snapshot.mjs",
    "social-recovery-smoke-regressions-gate-latest.mjs",
    "social-recovery-smoke-regressions-gate-previous.mjs",
    "social-recovery-smoke-regressions-gate-snapshot.mjs",
    "social-recovery-smoke-regressions-integrity-latest.mjs",
    "social-recovery-smoke-regressions-integrity-previous.mjs",
    "social-recovery-smoke-regressions-integrity-snapshot.mjs",
    "social-recovery-smoke-regressions-next-latest.mjs",
    "social-recovery-smoke-regressions-next-previous.mjs",
    "social-recovery-smoke-regressions-next-snapshot.mjs",
  ]) {
    fs.copyFileSync(
      path.join(process.cwd(), "scripts", fileName),
      path.join(tempDir, "scripts", fileName)
    );
  }
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

function seedSnapshot(snapshotDir, nameSuffix) {
  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-status.txt"),
    `# status ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-status.json"),
    JSON.stringify({ regressionCount: nameSuffix === "latest" ? 2 : 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-overview.md"),
    `# overview ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-overview.json"),
    JSON.stringify({ next: { command: `cmd-${nameSuffix}` } }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history.txt"),
    `# history ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history.json"),
    JSON.stringify({ snapshotCount: nameSuffix === "latest" ? 2 : 1 }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-gate-failing.txt"),
    `# history-gate-failing ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-gate-failing.json"),
    JSON.stringify({ snapshotCount: nameSuffix === "latest" ? 1 : 0 }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-gate-failing-compare.txt"),
    `# history-gate-failing-compare ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-gate-failing-compare.json"),
    JSON.stringify({ gateFailingCountDelta: nameSuffix === "latest" ? 1 : 0 }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-gate-failing-compare-check.txt"),
    `# history-gate-failing-compare-check ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-gate-failing-compare-check.json"),
    JSON.stringify({ ok: nameSuffix !== "latest", issueCount: nameSuffix === "latest" ? 1 : 0 }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-compare.txt"),
    `# history-compare ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-compare.json"),
    JSON.stringify({ unstableCountDelta: nameSuffix === "latest" ? 1 : 0 }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-compare-check.txt"),
    `# history-compare-check ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-history-compare-check.json"),
    JSON.stringify({ ok: nameSuffix !== "latest", issueCount: nameSuffix === "latest" ? 1 : 0 }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-summary.md"),
    `# summary ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-summary.json"),
    JSON.stringify({ overview: { next: { command: `cmd-${nameSuffix}` } } }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-plan.txt"),
    `1. step-${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-plan.json"),
    JSON.stringify({ steps: [`step-${nameSuffix}`] }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-doctor.txt"),
    `# doctor ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-doctor.json"),
    JSON.stringify({ ok: nameSuffix !== "previous" }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-integrity.txt"),
    `# integrity ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-integrity.json"),
    JSON.stringify({ ok: nameSuffix !== "previous", issues: [] }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-gate.txt"),
    `# gate ${nameSuffix}\n`
  );
  fs.writeFileSync(
    path.join(snapshotDir, "regressions-gate.json"),
    JSON.stringify({ ok: nameSuffix === "named", issueCount: nameSuffix === "named" ? 0 : 1 }, null, 2)
  );
  fs.writeFileSync(path.join(snapshotDir, "regressions-next.txt"), `cmd-${nameSuffix}\n`);
}

test("saved regression artifact readers reopen latest, previous, and snapshot variants", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const previousDir = path.join(snapshotsDir, "snap-1");
  const latestSnapshotDir = path.join(snapshotsDir, "snap-2");

  seedSnapshot(latestDir, "latest");
  seedSnapshot(previousDir, "previous");
  seedSnapshot(latestSnapshotDir, "named");
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [
          { name: "snap-2", snapshotDir: latestSnapshotDir },
          { name: "snap-1", snapshotDir: previousDir },
        ],
      },
      null,
      2
    )
  );

  try {
    const statusLatest = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-status-latest.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const statusPrevious = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-status-previous.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const overviewSnapshot = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-overview-snapshot.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyPrevious = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-previous.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingLatest = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-latest.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingPrevious = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-previous.mjs"
        ),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingSnapshot = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-snapshot.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingCompareLatest = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-compare-latest.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingComparePrevious = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-compare-previous.mjs"
        ),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingCompareSnapshot = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-compare-snapshot.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingCompareCheckLatest = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-compare-check-latest.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingCompareCheckPrevious = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-compare-check-previous.mjs"
        ),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyGateFailingCompareCheckSnapshot = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-gate-failing-compare-check-snapshot.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyCompareLatest = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-compare-latest.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyComparePrevious = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-compare-previous.mjs"
        ),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyCompareSnapshot = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-compare-snapshot.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyCompareCheckLatest = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-compare-check-latest.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyCompareCheckPrevious = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-compare-check-previous.mjs"
        ),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const historyCompareCheckSnapshot = await execFileAsync(
      "node",
      [
        path.join(
          tempDir,
          "scripts",
          "social-recovery-smoke-regressions-history-compare-check-snapshot.mjs"
        ),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const summaryLatest = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-summary-latest.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const planPrevious = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-plan-previous.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const nextSnapshot = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-next-snapshot.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-1",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const doctorPrevious = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-doctor-previous.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const gateLatest = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-gate-latest.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const gatePrevious = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-gate-previous.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const gateSnapshot = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-gate-snapshot.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-2",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const integrityLatest = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-integrity-latest.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const integritySnapshot = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-regressions-integrity-snapshot.mjs"),
        "--json",
        "--base-dir",
        baseDir,
        "--name",
        "snap-1",
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    const parsedStatusLatest = JSON.parse(statusLatest.stdout);
    assert.equal(parsedStatusLatest.status.regressionCount, 2);
    assert.match(parsedStatusLatest.statusPath, /regressions-status\.txt$/);
    assert.match(statusPrevious.stdout, /status previous/);

    const parsedOverviewSnapshot = JSON.parse(overviewSnapshot.stdout);
    assert.equal(parsedOverviewSnapshot.snapshot.name, "snap-2");
    assert.equal(parsedOverviewSnapshot.overview.next.command, "cmd-named");

    const parsedHistoryPrevious = JSON.parse(historyPrevious.stdout);
    assert.equal(parsedHistoryPrevious.snapshot.name, "snap-1");
    assert.equal(parsedHistoryPrevious.history.snapshotCount, 1);

    const parsedHistoryGateFailingLatest = JSON.parse(historyGateFailingLatest.stdout);
    assert.equal(parsedHistoryGateFailingLatest.history.snapshotCount, 1);
    assert.match(
      parsedHistoryGateFailingLatest.historyPath,
      /regressions-history-gate-failing\.txt$/
    );

    assert.match(historyGateFailingPrevious.stdout, /history-gate-failing previous/);

    const parsedHistoryGateFailingSnapshot = JSON.parse(historyGateFailingSnapshot.stdout);
    assert.equal(parsedHistoryGateFailingSnapshot.snapshot.name, "snap-2");
    assert.equal(parsedHistoryGateFailingSnapshot.history.snapshotCount, 0);

    const parsedHistoryGateFailingCompareLatest = JSON.parse(
      historyGateFailingCompareLatest.stdout
    );
    assert.equal(parsedHistoryGateFailingCompareLatest.compare.gateFailingCountDelta, 1);
    assert.match(
      parsedHistoryGateFailingCompareLatest.comparePath,
      /regressions-history-gate-failing-compare\.txt$/
    );

    assert.match(
      historyGateFailingComparePrevious.stdout,
      /history-gate-failing-compare previous/
    );

    const parsedHistoryGateFailingCompareSnapshot = JSON.parse(
      historyGateFailingCompareSnapshot.stdout
    );
    assert.equal(parsedHistoryGateFailingCompareSnapshot.snapshot.name, "snap-2");
    assert.equal(parsedHistoryGateFailingCompareSnapshot.compare.gateFailingCountDelta, 0);

    const parsedHistoryGateFailingCompareCheckLatest = JSON.parse(
      historyGateFailingCompareCheckLatest.stdout
    );
    assert.equal(parsedHistoryGateFailingCompareCheckLatest.check.ok, false);
    assert.match(
      parsedHistoryGateFailingCompareCheckLatest.checkPath,
      /regressions-history-gate-failing-compare-check\.txt$/
    );

    assert.match(
      historyGateFailingCompareCheckPrevious.stdout,
      /history-gate-failing-compare-check previous/
    );

    const parsedHistoryGateFailingCompareCheckSnapshot = JSON.parse(
      historyGateFailingCompareCheckSnapshot.stdout
    );
    assert.equal(parsedHistoryGateFailingCompareCheckSnapshot.snapshot.name, "snap-2");
    assert.equal(parsedHistoryGateFailingCompareCheckSnapshot.check.ok, true);

    const parsedHistoryCompareLatest = JSON.parse(historyCompareLatest.stdout);
    assert.equal(parsedHistoryCompareLatest.compare.unstableCountDelta, 1);
    assert.match(parsedHistoryCompareLatest.comparePath, /regressions-history-compare\.txt$/);

    assert.match(historyComparePrevious.stdout, /history-compare previous/);

    const parsedHistoryCompareSnapshot = JSON.parse(historyCompareSnapshot.stdout);
    assert.equal(parsedHistoryCompareSnapshot.snapshot.name, "snap-2");
    assert.equal(parsedHistoryCompareSnapshot.compare.unstableCountDelta, 0);

    const parsedHistoryCompareCheckLatest = JSON.parse(historyCompareCheckLatest.stdout);
    assert.equal(parsedHistoryCompareCheckLatest.check.ok, false);
    assert.match(
      parsedHistoryCompareCheckLatest.checkPath,
      /regressions-history-compare-check\.txt$/
    );

    assert.match(historyCompareCheckPrevious.stdout, /history-compare-check previous/);

    const parsedHistoryCompareCheckSnapshot = JSON.parse(historyCompareCheckSnapshot.stdout);
    assert.equal(parsedHistoryCompareCheckSnapshot.snapshot.name, "snap-2");
    assert.equal(parsedHistoryCompareCheckSnapshot.check.ok, true);

    assert.match(summaryLatest.stdout, /summary latest/);

    const parsedPlanPrevious = JSON.parse(planPrevious.stdout);
    assert.equal(parsedPlanPrevious.snapshot.name, "snap-1");
    assert.deepEqual(parsedPlanPrevious.plan.steps, ["step-previous"]);

    const parsedNextSnapshot = JSON.parse(nextSnapshot.stdout);
    assert.equal(parsedNextSnapshot.snapshot.name, "snap-1");
    assert.equal(parsedNextSnapshot.command, "cmd-previous");

    const parsedDoctorPrevious = JSON.parse(doctorPrevious.stdout);
    assert.equal(parsedDoctorPrevious.snapshot.name, "snap-1");
    assert.equal(parsedDoctorPrevious.doctor.ok, false);

    const parsedGateLatest = JSON.parse(gateLatest.stdout);
    assert.equal(parsedGateLatest.gate.ok, false);
    assert.match(parsedGateLatest.gatePath, /regressions-gate\.txt$/);

    assert.match(gatePrevious.stdout, /gate previous/);

    const parsedGateSnapshot = JSON.parse(gateSnapshot.stdout);
    assert.equal(parsedGateSnapshot.snapshot.name, "snap-2");
    assert.equal(parsedGateSnapshot.gate.ok, true);

    const parsedIntegrityLatest = JSON.parse(integrityLatest.stdout);
    assert.equal(parsedIntegrityLatest.integrity.ok, true);
    assert.match(parsedIntegrityLatest.integrityPath, /regressions-integrity\.txt$/);

    const parsedIntegritySnapshot = JSON.parse(integritySnapshot.stdout);
    assert.equal(parsedIntegritySnapshot.snapshot.name, "snap-1");
    assert.equal(parsedIntegritySnapshot.integrity.ok, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
