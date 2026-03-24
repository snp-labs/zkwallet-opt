import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-status-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-status.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-status.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-bundle-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-bundle-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-status suggests export when no report exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-status.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    const result = JSON.parse(stdout);
    assert.equal(result.hasLatestReport, false);
    assert.equal(result.snapshotCount, 0);
    assert.match(result.suggestedCommands[0], /social-recovery:smoke:export/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-status summarizes latest manifest and compare fields", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });

  fs.writeFileSync(path.join(baseDir, "history.md"), "# Social Recovery Smoke History\n");
  fs.writeFileSync(path.join(latestDir, "report.md"), "# Latest Report\n");
  fs.writeFileSync(
    path.join(latestDir, "checksums.json"),
    JSON.stringify({ files: [] }, null, 2)
  );
  fs.writeFileSync(path.join(latestDir, "checksums.txt"), "");
  fs.writeFileSync(
    path.join(latestDir, "manifest.json"),
    JSON.stringify(
      {
        accountId: "account-latest",
        submitTransactionHash: "0x222",
        submitUserOpHash: "0xbbb",
        generatedAt: "2026-03-24T12:00:00Z",
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "compare.json"),
    JSON.stringify(
      {
        latest: { name: "snap-2" },
        previous: { name: "snap-1" },
        changedFields: [{ label: "submitTransactionHash" }, { label: "submitUserOpHash" }],
        unchangedFields: ["accountId"],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "checksums-compare.json"),
    JSON.stringify(
      {
        changedArtifacts: [{ path: "manifest.json" }, { path: "report.md" }],
        unchangedArtifacts: ["result.json"],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify(
      {
        regressionCountDelta: 1,
        addedSnapshotNames: ["snap-2"],
        removedSnapshotNames: [],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "stability.json"),
    JSON.stringify({ ok: true, reasons: [] }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [{ name: "snap-2", stabilityOk: false }, { name: "snap-1", stabilityOk: true }],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-status.mjs"),
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
        path.join(tempDir, "scripts", "social-recovery-smoke-status.mjs"),
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
    assert.match(text.stdout, /recentRegressionCount: 1/);
    assert.match(text.stdout, /changedFields: submitTransactionHash, submitUserOpHash/);
    assert.match(text.stdout, /latestChecksumOk: true/);
    assert.match(text.stdout, /changedChecksumArtifacts: manifest\.json, report\.md/);
    assert.match(text.stdout, /regressionCountDelta: 1/);
    assert.match(text.stdout, /latestStabilityOk: true/);
    const result = JSON.parse(json.stdout);
    assert.equal(result.latestManifest.accountId, "account-latest");
    assert.equal(result.latestChecksumStatus.ok, true);
    assert.deepEqual(result.latestCompare.changedFieldLabels, [
      "submitTransactionHash",
      "submitUserOpHash",
    ]);
    assert.deepEqual(result.latestChecksumsCompare.changedArtifactPaths, [
      "manifest.json",
      "report.md",
    ]);
    assert.equal(result.latestRegressionsCompare.regressionCountDelta, 1);
    assert.equal(result.latestStability.ok, true);
    assert.equal(result.recentRegressionCount, 1);
    assert.match(result.suggestedCommands[0], /social-recovery:smoke:regressions:changes/);
    assert.match(result.suggestedCommands[1], /social-recovery:smoke:regressions/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
