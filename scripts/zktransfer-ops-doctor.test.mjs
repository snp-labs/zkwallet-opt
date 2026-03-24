import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const scriptPath = "/Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-doctor.sh";

function createFakeScript(filePath, body) {
  fs.writeFileSync(filePath, body, { mode: 0o755 });
}

test("zktransfer-ops-doctor prints status and summary and exits zero when ready", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-doctor-"));
  const runScript = path.join(tempDir, "run.sh");
  const summaryScript = path.join(tempDir, "summary.sh");
  const logPath = path.join(tempDir, "log.txt");

  createFakeScript(
    runScript,
    `#!/usr/bin/env bash
set -euo pipefail
printf 'run:%s\\n' "$*" >> "${logPath}"
printf 'status ok\\n'
`
  );

  createFakeScript(
    summaryScript,
    `#!/usr/bin/env bash
set -euo pipefail
printf 'summary:%s\\n' "$*" >> "${logPath}"
if [[ "$*" == "--check" ]]; then
  exit 0
fi
printf '# Summary ok\\n'
`
  );

  const output = execFileSync("bash", [scriptPath], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      OPS_RUN_SCRIPT: runScript,
      OPS_SUMMARY_SCRIPT: summaryScript
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  assert.match(output, /\[zktransfer-ops-doctor\] deployment status/);
  assert.match(output, /status ok/);
  assert.match(output, /\[zktransfer-ops-doctor\] summary/);
  assert.match(output, /# Summary ok/);
  assert.match(output, /\[zktransfer-ops-doctor\] ready/);

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    "run:deployment:status",
    "summary:--markdown",
    "summary:--check"
  ]);
});

test("zktransfer-ops-doctor exits non-zero when readiness check fails", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-doctor-"));
  const runScript = path.join(tempDir, "run.sh");
  const summaryScript = path.join(tempDir, "summary.sh");

  createFakeScript(
    runScript,
    `#!/usr/bin/env bash
set -euo pipefail
printf 'status blocked\\n'
`
  );

  createFakeScript(
    summaryScript,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "--check" ]]; then
  exit 1
fi
printf '# Summary blocked\\n'
`
  );

  let error;
  try {
    execFileSync("bash", [scriptPath], {
      cwd: "/Users/hyunokoh/Documents/zkWallet",
      env: {
        ...process.env,
        OPS_RUN_SCRIPT: runScript,
        OPS_SUMMARY_SCRIPT: summaryScript
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert.ok(error);
  assert.equal(error.status, 1);
  assert.match(error.stdout, /# Summary blocked/);
  assert.match(error.stderr, /\[zktransfer-ops-doctor\] blocked/);
});
