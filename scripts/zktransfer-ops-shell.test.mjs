import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const scriptPath = "/Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh";

function createFakeNpm(binDir) {
  const fakeNpmPath = path.join(binDir, "npm");
  fs.writeFileSync(
    fakeNpmPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${NPM_LOG:?}"
`,
    { mode: 0o755 }
  );
}

test("zktransfer-ops wrapper dispatches to root package scripts", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "summary:markdown"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:summary:markdown --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches doctor to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "doctor"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:doctor --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches changes to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "changes"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:changes --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches next to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "next"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:next --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches next:root to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "next:root"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:next:root --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches plan to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "plan"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:plan --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches report to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "report"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:report --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches export to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "export"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:export --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches compare to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "compare"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:compare --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches history to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "history"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:history --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches history:paths to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "history:paths"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:history:paths --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches latest to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "latest"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:latest --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches previous to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "previous"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:previous --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches snapshot to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "snapshot"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:snapshot --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper dispatches prune to the root package script", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-ops-shell-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  createFakeNpm(binDir);

  const logPath = path.join(tempDir, "npm.log");

  execFileSync("bash", [scriptPath, "prune"], {
    cwd: "/Users/hyunokoh/Documents/zkWallet",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NPM_LOG: logPath
    },
    encoding: "utf8"
  });

  const logLines = fs.readFileSync(logPath, "utf8").trim().split("\n");
  assert.deepEqual(logLines, [
    'run ops:prune --prefix /Users/hyunokoh/Documents/zkWallet'
  ]);
});

test("zktransfer-ops wrapper rejects unknown commands", () => {
  let error;
  try {
    execFileSync("bash", [scriptPath, "install"], {
      cwd: "/Users/hyunokoh/Documents/zkWallet",
      encoding: "utf8",
      stdio: "pipe"
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert.ok(error);
  assert.equal(error.status, 1);
  assert.match(error.stderr, /Commands:/);
});
