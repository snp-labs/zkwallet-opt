import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const bashPath = execFileSync("bash", ["-lc", "command -v bash"], {
  encoding: "utf8"
}).trim();

function createTempBin() {
  const tempBin = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-server-deps-bin-"));
  const nodePath = execFileSync("bash", ["-lc", "command -v node"], {
    encoding: "utf8"
  }).trim();
  const npmPath = execFileSync("bash", ["-lc", "command -v npm"], {
    encoding: "utf8"
  }).trim();
  fs.symlinkSync(nodePath, path.join(tempBin, "node"));
  fs.symlinkSync(npmPath, path.join(tempBin, "npm"));
  return tempBin;
}

test("check:deps fails when required runtime commands are missing", () => {
  const tempBin = createTempBin();

  try {
    assert.throws(
      () =>
        execFileSync(bashPath, [path.join(process.cwd(), "scripts", "check-runtime-deps.sh")], {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: tempBin
          },
          stdio: "pipe"
        }),
      (error) => {
        assert.match(error.stderr, /missing required commands: curl sudo systemctl/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});

test("check:deps allows optional runtime commands for install dry-run", () => {
  const tempBin = createTempBin();

  try {
    const stdout = execFileSync(bashPath, [path.join(process.cwd(), "scripts", "check-runtime-deps.sh")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: tempBin,
        OPTIONAL_RUNTIME_COMMANDS: "curl,sudo,systemctl"
      }
    });
    assert.match(stdout, /optional commands not available: curl sudo systemctl/);
    assert.match(stdout, /all required commands are available/);
  } finally {
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});
