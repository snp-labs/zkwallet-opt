import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-checksum-changes-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-checksums-changes.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-checksums-changes.mjs")
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  return tempDir;
}

test("social-recovery-smoke-checksums:changes prints latest stored checksum compare output", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.writeFileSync(
    path.join(latestDir, "checksums-compare.txt"),
    "# Social Recovery Smoke Checksum Compare\n\n- latest: snap-2\n"
  );
  fs.writeFileSync(
    path.join(latestDir, "checksums-compare.json"),
    JSON.stringify(
      {
        latest: { name: "snap-2" },
        previous: { name: "snap-1" },
        changedArtifacts: [{ path: "manifest.json" }],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-checksums-changes.mjs"),
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );
    const json = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-checksums-changes.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      { cwd: tempDir, encoding: "utf8" }
    );

    assert.match(text.stdout, /Checksum Compare/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.compare.latest.name, "snap-2");
    assert.equal(parsed.compare.changedArtifacts[0].path, "manifest.json");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
