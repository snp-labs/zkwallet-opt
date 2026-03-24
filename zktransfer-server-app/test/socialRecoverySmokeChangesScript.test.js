import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-changes-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp", "social-recovery-smoke-report", "latest"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-changes.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-changes.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-changes prints latest stored compare output", async () => {
  const tempDir = createTempApp();
  const baseDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");
  const latestDir = path.join(baseDir, "latest");

  fs.writeFileSync(
    path.join(latestDir, "changes.txt"),
    "# Social Recovery Smoke Compare\n\nChanged fields:\n- submitTransactionHash: 0x111 -> 0x222\n\n# Social Recovery Smoke Checksum Compare\n\nChanged artifacts:\n- manifest.json: aaa -> bbb\n"
  );
  fs.writeFileSync(
    path.join(latestDir, "changes.json"),
    JSON.stringify(
      {
        compare: {
          changedFields: [{ label: "submitTransactionHash", previous: "0x111", latest: "0x222" }],
        },
        checksumsCompare: {
          changedArtifacts: [{ path: "manifest.json", previousSha256: "aaa", latestSha256: "bbb" }],
        },
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "compare.txt"),
    "# Social Recovery Smoke Compare\n\nChanged fields:\n- submitTransactionHash: 0x111 -> 0x222\n"
  );
  fs.writeFileSync(
    path.join(latestDir, "compare.json"),
    JSON.stringify(
      {
        changedFields: [{ label: "submitTransactionHash", previous: "0x111", latest: "0x222" }],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(latestDir, "checksums-compare.txt"),
    "# Social Recovery Smoke Checksum Compare\n\nChanged artifacts:\n- manifest.json: aaa -> bbb\n"
  );
  fs.writeFileSync(
    path.join(latestDir, "checksums-compare.json"),
    JSON.stringify(
      {
        changedArtifacts: [{ path: "manifest.json", previousSha256: "aaa", latestSha256: "bbb" }],
      },
      null,
      2
    )
  );

  try {
    const text = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-changes.mjs"),
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
        path.join(tempDir, "scripts", "social-recovery-smoke-changes.mjs"),
        "--json",
        "--base-dir",
        baseDir,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      }
    );

    assert.match(text.stdout, /submitTransactionHash: 0x111 -> 0x222/);
    assert.match(text.stdout, /manifest\.json: aaa -> bbb/);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.changes.compare.changedFields[0].label, "submitTransactionHash");
    assert.equal(parsed.changes.checksumsCompare.changedArtifacts[0].path, "manifest.json");
    assert.equal(parsed.compare.changedFields[0].label, "submitTransactionHash");
    assert.equal(parsed.checksumsCompare.changedArtifacts[0].path, "manifest.json");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
