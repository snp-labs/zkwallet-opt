import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-summary-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-summary.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-summary.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-overview-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-overview-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-summary-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-summary-core.mjs")
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

test("social-recovery-smoke-summary prints combined overview and paths", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(path.join(latestDir, "report.md"), "# Latest Report\n");
  fs.writeFileSync(
    path.join(latestDir, "checksums.json"),
    JSON.stringify({ files: [] }, null, 2)
  );
  fs.writeFileSync(path.join(latestDir, "checksums.txt"), "");
  fs.writeFileSync(
    path.join(latestDir, "manifest.json"),
    JSON.stringify({ accountId: "account-1", submitTransactionHash: "0xabc" }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "compare.json"),
    JSON.stringify({ changedFields: [{ label: "submitTransactionHash" }] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "checksums-compare.json"),
    JSON.stringify({ changedArtifacts: [{ path: "manifest.json" }] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify({ regressionCountDelta: 1, addedSnapshotNames: ["snap-2"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-changes.json"),
    JSON.stringify(
      {
        regressions: { regressionCount: 1 },
        regressionsCompare: { regressionCountDelta: 1 },
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify({ snapshots: [{ name: "snap-2" }, { name: "snap-1" }] }, null, 2)
  );
  fs.writeFileSync(
    path.join(baseDir, "history.md"),
    "# Social Recovery Smoke History\n\n- snapshots: 2\n"
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-summary.mjs"),
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
        path.join(tempDir, "scripts", "social-recovery-smoke-summary.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /Social Recovery Smoke Summary/);
    assert.match(text.stdout, /History Preview/);
    assert.match(text.stdout, /latestComparePath/);
    assert.match(text.stdout, /latestChecksumsComparePath/);
    assert.match(text.stdout, /changedArtifacts: manifest\.json/);
    assert.match(text.stdout, /latestRegressionsComparePath/);
    assert.match(text.stdout, /latestRegressionsChangesPath/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.overview.latestManifest.accountId, "account-1");
    assert.equal(parsed.paths.latestChecksumsComparePath.endsWith("checksums-compare.txt"), true);
    assert.equal(
      parsed.paths.latestRegressionsComparePath.endsWith("regressions-compare.txt"),
      true
    );
    assert.equal(
      parsed.paths.latestRegressionsChangesPath.endsWith("regressions-changes.txt"),
      true
    );
    assert.match(parsed.historyPreview, /snapshots: 2/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-summary tolerates missing history", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-summary.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.historyPreview, null);
    assert.equal(parsed.overview.hasLatestReport, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
