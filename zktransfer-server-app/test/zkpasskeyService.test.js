/**
 * ZkPasskeyService tests
 *
 * Tests the service layer that wraps NAPI-RS bindings.
 * Since NAPI may not be available in CI, tests focus on:
 * - Mock mode behavior when NAPI is unavailable
 * - Parameter validation logic
 * - Default parameter values
 * - Error handling paths
 */

import test from "node:test";
import assert from "node:assert/strict";
import { ZkPasskeyService } from "../src/services/zkpasskeyService.js";

function createService(overrides = {}) {
  return new ZkPasskeyService({
    config: {
      zkpasskeyPkPath: "./crs/test_pk.key",
      ...overrides,
    },
    store: {},
  });
}

test("getStatus returns napiAvailable boolean", () => {
  const service = createService();
  const status = service.getStatus();

  assert.equal(typeof status.napiAvailable, "boolean");
  assert.ok("napiLoadError" in status);
});

test("getZkParameters returns valid defaults when NAPI unavailable", () => {
  const service = createService();

  // If NAPI is not loaded, should return defaults
  if (!service.napiAvailable) {
    const params = service.getZkParameters();

    assert.equal(params.n, 3);
    assert.equal(params.k, 2);
    assert.equal(params.treeHeight, 4);
    assert.ok(Array.isArray(params.claims));
    assert.ok(params.claims.includes("iss"));
    assert.ok(params.claims.includes("sub"));
    assert.ok(params.claims.includes("aud"));
    assert.ok(params.maxJwtB64Len > 0);
    assert.ok(params.maxAudLen > 0);
    assert.ok(params.maxIssLen > 0);
    assert.ok(params.maxSubLen > 0);
  }
});

test("getZkParameters: k < n", () => {
  const service = createService();
  const params = service.getZkParameters();

  assert.ok(params.k <= params.n, `k (${params.k}) should be <= n (${params.n})`);
  assert.ok(params.k > 0, "k should be positive");
});

test("generateAnchor throws when NAPI unavailable", () => {
  const service = createService();
  if (!service.napiAvailable) {
    assert.throws(
      () => service.generateAnchor([{ iss: "x", sub: "y", aud: "z" }]),
      /NAPI binding not available/
    );
  }
});

test("poseidonHash throws when NAPI unavailable", () => {
  const service = createService();
  if (!service.napiAvailable) {
    assert.throws(
      () => service.poseidonHash(["0x1", "0x2"]),
      /NAPI binding not available/
    );
  }
});

test("createAccount rejects mismatched arrays", async () => {
  const service = createService();
  await assert.rejects(
    () =>
      service.createAccount({
        jwts: ["jwt1", "jwt2"],
        providers: ["google"],
        txKeyAddress: "0x123",
      }),
    /jwts and providers arrays must have the same length/
  );
});

test("createAccount rejects insufficient provider count", async () => {
  const service = createService();
  const params = service.getZkParameters();

  if (params.n > 1) {
    await assert.rejects(
      () =>
        service.createAccount({
          jwts: ["jwt1"],
          providers: ["google"],
          txKeyAddress: "0x123",
        }),
      /Need \d+ provider JWTs/
    );
  }
});

test("generateRecoveryProof throws when NAPI unavailable", async () => {
  const service = createService();
  if (!service.napiAvailable) {
    await assert.rejects(
      () =>
        service.generateRecoveryProof({
          jwts: ["jwt1", "jwt2"],
          providers: ["google", "kakao"],
          pkOps: [],
          merklePaths: [],
          leafIndices: [],
          root: "0x0",
          anchor: [],
          hSignUserOp: "0x0",
          counter: "0",
          random: "0x0",
        }),
      /NAPI binding not available/
    );
  }
});

test("getMerkleRoot returns expected structure", () => {
  const service = createService();
  const merkle = service.getMerkleRoot();

  assert.ok(typeof merkle.root === "string");
  assert.ok(merkle.root.startsWith("0x"));
  assert.equal(typeof merkle.numLeaves, "number");
  assert.equal(typeof merkle.treeHeight, "number");
  assert.ok(merkle.treeHeight > 0);
});

test("getMerklePath returns path and indices of correct length", () => {
  const service = createService();
  const proof = service.getMerklePath(0);

  const params = service.getZkParameters();
  assert.ok(typeof proof.root === "string");
  assert.equal(proof.path.length, params.treeHeight);
  assert.equal(proof.indices.length, params.treeHeight);

  for (const p of proof.path) {
    assert.ok(typeof p === "string" && p.startsWith("0x"));
  }
  for (const i of proof.indices) {
    assert.equal(typeof i, "number");
  }
});
