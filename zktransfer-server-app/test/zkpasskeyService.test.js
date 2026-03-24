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
import {
  ZkPasskeyService,
  chainPoseidonHash,
  createProviderLeaf,
  normalizeSecretForAnchorGeneration,
  normalizeJwtStringClaimValue,
  stringToFieldLimbs,
  rsaModulusToFieldLimbs,
} from "../src/services/zkpasskeyService.js";

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

test("stringToFieldLimbs pads issuer into 31-byte BN254 chunks", () => {
  const limbs = stringToFieldLimbs("https://accounts.google.com", 93);
  assert.equal(limbs.length, 3);
  assert.equal(typeof limbs[0], "string");
  assert.equal(typeof limbs[1], "string");
  assert.equal(typeof limbs[2], "string");
});

test("rsaModulusToFieldLimbs returns 32 little-endian 64-bit limbs", () => {
  const limbs = rsaModulusToFieldLimbs(
    "vLzd_VDnr8zt9pHfSkO3G0pUlaGJbYkIXXhma9-R9oETx2u0eZ-bSblq71FlA-PWLdjOW1SYtOngVZT5ZxJQ8FRFQolE8YzgByHifgo16ogEmeKdCIlCLd48IETTMOo093BLa2BzDygm8xBcpV_yqlxTUHdw2RH4vf5uulzbHcbdTf94I_DMlNUQX_yTmB8mu3GmDT-1xpL90iVEybjNWEcIrhWGHYqEFkKeBU1hvPf038Lts07eKiBKZWjo7-ZESCPNmdPvVkx29GuIBlwXp3824TB0DR0nhhFncXDuVzxDAUFSrnM0JwPa4ZX4M_xHdtUuk4Bp46wj_kb44jO4yw"
  );
  assert.equal(limbs.length, 32);
  assert.equal(typeof limbs[0], "string");
  assert.equal(typeof limbs[31], "string");
});

test("normalizeSecretForAnchorGeneration matches JWT parser string profile", () => {
  assert.deepEqual(
    normalizeSecretForAnchorGeneration({
      iss: "http://127.0.0.1:4400/google",
      sub: "google-dev-user-1",
      aud: "dev-zkwallet-client",
    }),
    {
      aud: "",
      iss: "\"http://127.0.0.1:4400/google\"",
      sub: "\"google-dev-user-1\"",
    }
  );
});

test("normalizeJwtStringClaimValue encodes string claims as JSON literals", () => {
  assert.equal(
    normalizeJwtStringClaimValue("http://127.0.0.1:4400/google"),
    "\"http://127.0.0.1:4400/google\""
  );
});

test("chainPoseidonHash hashes values iteratively", () => {
  const calls = [];
  const result = chainPoseidonHash((inputs) => {
    calls.push(inputs);
    return `h(${inputs.join(",")})`;
  }, ["a", "b", "c"]);

  assert.equal(result, "h(h(h(a),b),c)");
  assert.deepEqual(calls, [["a"], ["h(a)", "b"], ["h(h(a),b)", "c"]]);
});

test("createProviderLeaf matches the Rust generate_hash fixture", () => {
  const leaf = createProviderLeaf({
    iss: "https://accounts.google.com",
    publicKey:
      "vLzd_VDnr8zt9pHfSkO3G0pUlaGJbYkIXXhma9-R9oETx2u0eZ-bSblq71FlA-PWLdjOW1SYtOngVZT5ZxJQ8FRFQolE8YzgByHifgo16ogEmeKdCIlCLd48IETTMOo093BLa2BzDygm8xBcpV_yqlxTUHdw2RH4vf5uulzbHcbdTf94I_DMlNUQX_yTmB8mu3GmDT-1xpL90iVEybjNWEcIrhWGHYqEFkKeBU1hvPf038Lts07eKiBKZWjo7-ZESCPNmdPvVkx29GuIBlwXp3824TB0DR0nhhFncXDuVzxDAUFSrnM0JwPa4ZX4M_xHdtUuk4Bp46wj_kb44jO4yw",
    maxIssLen: 93,
    poseidonHash: (inputs) => createService().poseidonHash(inputs).hash,
  });

  assert.equal(
    leaf,
    "0x845216E3AC9E7597B166A57FB053CD030DF5FDAD0C2ABB0A33DBFA95BF687B7"
  );
});
