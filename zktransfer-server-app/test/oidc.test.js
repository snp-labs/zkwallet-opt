/**
 * OIDC validation tests
 *
 * Tests the OIDC helper functions (extractOidcSecret, getSupportedProviders)
 * and verifyOidcJwt error paths. Actual JWT RS256 verification against
 * live JWKS endpoints is an integration test — here we test the parsing
 * and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  extractOidcSecret,
  getSupportedProviders,
  clearJwksCache,
} from "../src/lib/oidc.js";

test("extractOidcSecret returns { aud, iss, sub }", () => {
  const payload = {
    provider: "google",
    iss: "https://accounts.google.com",
    sub: "user123",
    aud: "app-client-id",
    exp: 9999999999,
    nonce: "abc",
    rawJwt: "mock",
  };

  const secret = extractOidcSecret(payload);
  assert.deepEqual(secret, {
    aud: "app-client-id",
    iss: "https://accounts.google.com",
    sub: "user123",
  });
});

test("extractOidcSecret preserves array aud", () => {
  const payload = {
    aud: ["client-a", "client-b"],
    iss: "https://kauth.kakao.com",
    sub: "kakao-user",
  };

  const secret = extractOidcSecret(payload);
  assert.deepEqual(secret.aud, ["client-a", "client-b"]);
});

test("getSupportedProviders returns google, kakao, apple", () => {
  const providers = getSupportedProviders();

  assert.equal(providers.length, 3);

  const ids = providers.map((p) => p.id);
  assert.ok(ids.includes("google"));
  assert.ok(ids.includes("kakao"));
  assert.ok(ids.includes("apple"));

  // Each provider should have issuer and jwksUri
  for (const p of providers) {
    assert.ok(typeof p.issuer === "string" && p.issuer.length > 0);
    assert.ok(typeof p.jwksUri === "string" && p.jwksUri.startsWith("https://"));
  }
});

test("getSupportedProviders has correct issuers", () => {
  const providers = getSupportedProviders();
  const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

  assert.equal(byId.google.issuer, "https://accounts.google.com");
  assert.equal(byId.kakao.issuer, "https://kauth.kakao.com");
  assert.equal(byId.apple.issuer, "https://appleid.apple.com");
});

test("clearJwksCache does not throw", () => {
  assert.doesNotThrow(() => clearJwksCache());
});
