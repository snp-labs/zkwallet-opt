import test from "node:test";
import assert from "node:assert/strict";
import { signJwt, verifyJwt } from "../src/lib/jwt.js";

test("signJwt and verifyJwt roundtrip", () => {
  const token = signJwt({ sub: "user:1" }, "secret", 60);
  const claims = verifyJwt(token, "secret");
  assert.equal(claims.sub, "user:1");
});
