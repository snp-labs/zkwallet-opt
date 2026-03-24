import test from "node:test";
import assert from "node:assert/strict";
import { runSocialRecoveryLocalDemo } from "./socialRecoveryHarness.mjs";

test(
  "social recovery completes end-to-end on fresh localnet with local dev OIDC",
  async () => {
    const demo = await runSocialRecoveryLocalDemo();

    assert.equal(demo.result.threshold.n, 6);
    assert.equal(demo.result.threshold.k, 3);
    assert.equal(demo.result.create.jwtCount, 6);
    assert.equal(demo.result.challenge.jwtCount, 3);
    assert.equal(demo.result.submit.jwtCount, 3);
    assert.ok(demo.result.create.chainAccount?.zkAccountAddress);
    assert.ok(demo.result.submit.transactionHash?.startsWith("0x"));
    assert.ok(demo.result.submit.userOpHash?.startsWith("0x"));
    assert.equal(demo.result.submit.nonceFromJwt, demo.result.challenge.nonce);

    const storedAccounts = Object.values(demo.persisted.socialRecoveryAccounts || {});
    assert.equal(storedAccounts.length, 1);
    assert.equal(
      storedAccounts[0].chainAccount?.zkAccountAddress?.toLowerCase(),
      demo.result.create.chainAccount.zkAccountAddress.toLowerCase()
    );
  },
  120000
);
