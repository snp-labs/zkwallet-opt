import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-integrity-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-integrity.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-integrity.mjs")
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

function seedSnapshot(snapshotDir) {
  fs.mkdirSync(snapshotDir, { recursive: true });
  const fileNames = [
    "manifest.json",
    "report.md",
    "result.json",
    "input.redacted.json",
    "compare.txt",
    "compare.json",
    "changes.txt",
    "changes.json",
    "trend.txt",
    "trend.json",
    "stability.txt",
    "stability.json",
    "regressions.txt",
    "regressions.json",
    "regressions-history.txt",
    "regressions-history.json",
    "regressions-history-gate-failing.txt",
    "regressions-history-gate-failing.json",
    "regressions-history-gate-failing-compare.txt",
    "regressions-history-gate-failing-compare.json",
    "regressions-history-gate-failing-compare-check.txt",
    "regressions-history-gate-failing-compare-check.json",
    "regressions-history-compare.txt",
    "regressions-history-compare.json",
    "regressions-history-compare-check.txt",
    "regressions-history-compare-check.json",
    "regressions-compare.txt",
    "regressions-compare.json",
    "regressions-changes.txt",
    "regressions-changes.json",
    "regressions-status.txt",
    "regressions-status.json",
    "regressions-overview.md",
    "regressions-overview.json",
    "regressions-next.txt",
    "regressions-plan.txt",
    "regressions-plan.json",
    "regressions-summary.md",
    "regressions-summary.json",
    "regressions-doctor.txt",
    "regressions-doctor.json",
    "regressions-gate.txt",
    "regressions-gate.json",
    "regressions-report.md",
    "regressions-report.json",
    "regressions-integrity.txt",
    "regressions-integrity.json",
    "checksums-compare.txt",
    "checksums-compare.json",
    "overview.md",
    "overview.json",
    "plan.txt",
    "plan.json",
    "summary.md",
    "summary.json",
    "checksums.txt",
    "next.txt",
  ];
  for (const fileName of fileNames) {
    const contents = fileName.endsWith(".json") ? "{}" : `${fileName}\n`;
    fs.writeFileSync(path.join(snapshotDir, fileName), contents);
  }
  const checksumTargets = fileNames.filter((fileName) => fileName !== "checksums.txt");
  const checksums = checksumTargets.map((fileName) => ({
    path: fileName,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(snapshotDir, fileName)))
      .digest("hex"),
  }));
  fs.writeFileSync(
    path.join(snapshotDir, "checksums.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), files: checksums }, null, 2)
  );
  fs.writeFileSync(
    path.join(snapshotDir, "checksums.txt"),
    checksums.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n"
  );
}

test("social-recovery-smoke-integrity passes for a complete export bundle", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const snapshotDir = path.join(snapshotsDir, "snap-1");
  seedSnapshot(latestDir);
  seedSnapshot(snapshotDir);
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [{ name: "snap-1", snapshotDir }],
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(baseDir, "history.md"), "# history\n");
  fs.writeFileSync(
    path.join(baseDir, "export-manifest.json"),
    JSON.stringify(
      {
        latestIndexPath: path.join(snapshotsDir, "index.json"),
      },
      null,
      2
    )
  );

  try {
    const { stdout } = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-integrity.mjs"),
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
    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("social-recovery-smoke-integrity reports missing latest and broken snapshots", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const snapshotsDir = path.join(baseDir, "snapshots");
  const snapshotDir = path.join(snapshotsDir, "snap-1");
  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(path.join(snapshotDir, "manifest.json"), "{}");
  fs.writeFileSync(
    path.join(snapshotsDir, "index.json"),
    JSON.stringify(
      {
        snapshots: [{ name: "snap-1", snapshotDir }],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-integrity.mjs"),
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
        path.join(tempDir, "scripts", "social-recovery-smoke-integrity.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /Issues:/);
    const result = JSON.parse(json.stdout);
    assert.equal(result.ok, false);
    assert.match(
      result.issues.join("\n"),
      /latest\/ directory is missing|broken snapshots|summary\.md|plan\.txt/
    );
    assert.match(result.suggestedCommands[0], /social-recovery:smoke:paths|social-recovery:smoke:export/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
