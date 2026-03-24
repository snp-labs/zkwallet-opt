import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-overview-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-overview.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-overview.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-overview-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-overview-core.mjs")
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

test("social-recovery-smoke-overview recommends first export when no report exists", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-overview.mjs"),
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
    assert.match(result.next.command, /social-recovery:smoke:export/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-overview summarizes latest manifest and compare metadata", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });

  fs.writeFileSync(
    path.join(latestDir, "manifest.json"),
    JSON.stringify(
      {
        accountId: "account-1",
        submitTransactionHash: "0xabc",
        submitUserOpHash: "0xdef",
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(latestDir, "report.md"), "# Latest Report\n");
  fs.writeFileSync(
    path.join(latestDir, "checksums.json"),
    JSON.stringify({ files: [] }, null, 2)
  );
  fs.writeFileSync(path.join(latestDir, "checksums.txt"), "");
  fs.writeFileSync(
    path.join(latestDir, "compare.json"),
    JSON.stringify(
      {
        latest: { name: "snap-2" },
        previous: { name: "snap-1" },
        changedFields: [{ label: "submitTransactionHash" }],
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
        changedArtifacts: [{ path: "manifest.json" }],
        unchangedArtifacts: ["report.md", "result.json"],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "regressions-compare.json"),
    JSON.stringify(
      {
        regressionCountDelta: 0,
        addedSnapshotNames: [],
        removedSnapshotNames: [],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [{ name: "snap-2" }, { name: "snap-1" }],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-overview.mjs"),
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
        path.join(tempDir, "scripts", "social-recovery-smoke-overview.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /Social Recovery Smoke Overview/);
    assert.match(text.stdout, /latestChecksumOk: true/);
    assert.match(text.stdout, /changedArtifacts: manifest\.json/);
    assert.match(text.stdout, /regressionCountDelta: 0/);
    assert.match(text.stdout, /changedFields: submitTransactionHash/);
    const result = JSON.parse(json.stdout);
    assert.equal(result.latestManifest.accountId, "account-1");
    assert.equal(result.latestChecksumStatus.ok, true);
    assert.deepEqual(result.latestChecksumsCompare.changedArtifactPaths, ["manifest.json"]);
    assert.equal(result.latestRegressionsCompare.regressionCountDelta, 0);
    assert.deepEqual(result.latestCompare.changedFieldLabels, ["submitTransactionHash"]);
    assert.equal(result.next.command, "npm run social-recovery:smoke:changes");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
