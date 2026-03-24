import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function parseEnvExample(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    parsed[key] = value;
  }

  return parsed;
}

test(".env.example keeps fail-closed proving defaults", () => {
  const env = parseEnvExample(path.join(process.cwd(), ".env.example"));

  assert.equal(env.HOST, "127.0.0.1");
  assert.equal(env.PORT, "4010");
  assert.equal(env.JWT_SECRET, "replace-with-a-real-secret");
  assert.equal(
    env.CIRCUITS_ROOT,
    "/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits"
  );
  assert.equal(env.ALLOW_LEGACY_PROOF_INPUTS, "0");
});
