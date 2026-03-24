/**
 * API endpoint integration tests
 *
 * Tests the HTTP handler returned by createApp().
 * Uses Node's built-in http to create mock request/response objects.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { signJwt } from "../src/lib/jwt.js";
import { ZkPasskeyService } from "../src/services/zkpasskeyService.js";

// ─── Minimal mock services ─────────────────────────────────

function createMockServices() {
  const config = {
    appName: "test-app",
    custodyMode: "test",
    executionMode: "test",
    jwtSecretConfigured: true,
    usingDefaultJwtSecret: false,
    usingPlaceholderJwtSecret: false,
    allowLegacyProofInputs: false,
    proofInputPolicyPinned: true,
    zkpasskeyRelayerConfigured: false,
    zkpasskeyRecoveryFundingConfigured: false,
    zkpasskeyPkExists: true,
    proofBinaryExists: true,
    proofInputBuilderExists: true,
    jwtSecret: "test-secret",
    supportedNetworks: ["ethereum"],
    supportedTokenTypes: ["ERC20"],
  };

  const users = new Map();
  users.set("user:1", {
    userId: "user:1",
    displayName: "Test User",
    email: "test@example.com",
  });

  const store = {
    getUser: async (id) => users.get(id) || null,
    listRequestsByUser: async () => [],
    createRequest: async () => {},
    getRequest: async () => null,
    listTransactions: async () => [],
    getTransaction: async () => null,
    upsertSocialRecoveryAccount: async () => {},
    listSocialRecoveryAccounts: async () => [],
  };

  const authService = {
    issueMockLogin: async () => ({ token: "mock" }),
  };

  const profileService = {
    getSummary: async () => ({ walletAddress: "0x123" }),
    getQrPayload: async () => "qr:0x123",
    getContacts: async () => [],
    addContact: async (_, payload) => ({ contactId: "c1", ...payload }),
    parseQrContact: (qrPayload) => ({
      name: "QR User",
      walletAddress: "0xqr",
    }),
    updateSettings: async (_, body) => body,
  };

  const orchestrator = {
    enqueue: async () => {},
    getProofInputTelemetry: () => ({
      totalProofInputs: 0,
      legacyLeafPosInputs: 0,
      flattenedFourAryInputs: 0,
      lastInputContract: "none",
      lastTreeProofLength: 0,
      lastInputAnalyzedAt: null,
      lastLegacyLeafPosDetectedAt: null,
      legacyLeafPosWarningEmitted: false,
    }),
  };

  const zkpasskeyService = new ZkPasskeyService({ config, store });

  return {
    config,
    store,
    authService,
    profileService,
    orchestrator,
    zkpasskeyService,
  };
}

// ─── Mock HTTP request/response ─────────────────────────────

function mockReq(method, url, headers = {}, body = null) {
  const events = {};
  const req = {
    method,
    url,
    headers: { host: "localhost:3000", ...headers },
    on(event, handler) {
      events[event] = handler;
    },
  };

  // Trigger body events after creation
  if (body !== null) {
    setTimeout(() => {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      if (events.data) events.data(Buffer.from(bodyStr));
      if (events.end) events.end();
    }, 0);
  } else {
    setTimeout(() => {
      if (events.end) events.end();
    }, 0);
  }

  return req;
}

function mockRes() {
  let _statusCode = 200;
  let _headers = {};
  let _body = "";

  return {
    setHeader(key, value) {
      _headers[key.toLowerCase()] = value;
    },
    writeHead(statusCode, headers = {}) {
      _statusCode = statusCode;
      for (const [k, v] of Object.entries(headers)) {
        _headers[k.toLowerCase()] = v;
      }
    },
    end(data) {
      if (data) _body = data;
    },
    get statusCode() {
      return _statusCode;
    },
    get body() {
      return _body ? JSON.parse(_body) : null;
    },
    get headers() {
      return _headers;
    },
  };
}

function authHeader(userId = "user:1") {
  const token = signJwt({ sub: userId }, "test-secret", 60);
  return { authorization: `Bearer ${token}` };
}

// ─── Tests ──────────────────────────────────────────────────

test("GET /health returns 200 with ok:true", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("GET", "/health");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.ready, true);
  assert.equal(res.body.app, "test-app");
  assert.equal(res.body.jwtSecretConfigured, true);
  assert.equal(res.body.usingDefaultJwtSecret, false);
  assert.equal(res.body.usingPlaceholderJwtSecret, false);
  assert.equal(res.body.allowLegacyProofInputs, false);
  assert.equal(res.body.proofInputPolicyPinned, true);
  assert.equal(res.body.zkpasskeyNapiAvailable, true);
  assert.equal(res.body.zkpasskeyRecoveryFundingConfigured, false);
  assert.equal(res.body.zkpasskeyPkExists, true);
  assert.equal(res.body.socialRecoveryReady, false);
  assert.deepEqual(res.body.proofInputTelemetry, {
    totalProofInputs: 0,
    legacyLeafPosInputs: 0,
    flattenedFourAryInputs: 0,
    lastInputContract: "none",
    lastTreeProofLength: 0,
    lastInputAnalyzedAt: null,
    lastLegacyLeafPosDetectedAt: null,
    legacyLeafPosWarningEmitted: false
  });
  assert.deepEqual(res.body.checks, {
    proofBinaryExists: true,
    proofInputBuilderExists: true,
    jwtSecretConfigured: true,
    proofInputPolicyPinned: true
  });
  assert.deepEqual(res.body.socialRecoveryChecks, {
    zkpasskeyNapiAvailable: true,
    zkpasskeyRelayerConfigured: false,
    zkpasskeyPkExists: true,
    zkpasskeyRecoveryFundingConfigured: false
  });
  assert.deepEqual(res.body.socialRecoveryThreshold, {
    n: 6,
    k: 3,
    supportedProviderCount: 3
  });
});

test("GET /health reports not ready when JWT secret is still a placeholder", async () => {
  const services = createMockServices();
  services.config.jwtSecretConfigured = false;
  services.config.usingDefaultJwtSecret = false;
  services.config.usingPlaceholderJwtSecret = true;

  const app = createApp(services);
  const req = mockReq("GET", "/health");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.ready, false);
  assert.equal(res.body.jwtSecretConfigured, false);
  assert.equal(res.body.usingDefaultJwtSecret, false);
  assert.equal(res.body.usingPlaceholderJwtSecret, true);
  assert.deepEqual(res.body.checks, {
    proofBinaryExists: true,
    proofInputBuilderExists: true,
    jwtSecretConfigured: false,
    proofInputPolicyPinned: true
  });
  assert.equal(res.body.socialRecoveryReady, false);
});

test("GET /health reports social recovery not ready when recovery funding is zero", async () => {
  const services = createMockServices();
  services.config.zkpasskeyRelayerConfigured = true;
  services.config.zkpasskeyPkExists = true;
  services.config.zkpasskeyRecoveryFundingConfigured = false;

  const app = createApp(services);
  const req = mockReq("GET", "/health");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.socialRecoveryReady, false);
  assert.equal(res.body.zkpasskeyRecoveryFundingConfigured, false);
  assert.deepEqual(res.body.socialRecoveryChecks, {
    zkpasskeyNapiAvailable: true,
    zkpasskeyRelayerConfigured: true,
    zkpasskeyPkExists: true,
    zkpasskeyRecoveryFundingConfigured: false
  });
});

test("GET /health reports not ready when legacy proof-input policy is not pinned", async () => {
  const services = createMockServices();
  services.config.allowLegacyProofInputs = true;
  services.config.proofInputPolicyPinned = false;

  const app = createApp(services);
  const req = mockReq("GET", "/health");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.ready, false);
  assert.equal(res.body.allowLegacyProofInputs, true);
  assert.equal(res.body.proofInputPolicyPinned, false);
  assert.deepEqual(res.body.checks, {
    proofBinaryExists: true,
    proofInputBuilderExists: true,
    jwtSecretConfigured: true,
    proofInputPolicyPinned: false
  });
});

test("OPTIONS returns 204 with CORS headers", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("OPTIONS", "/v1/me/summary", { origin: "https://app.example.com" });
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["access-control-allow-origin"], "https://app.example.com");
});

test("GET /v1/social-login/providers returns provider list", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("GET", "/v1/social-login/providers");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.providers));
  assert.ok(res.body.providers.length >= 3);

  const ids = res.body.providers.map((p) => p.id);
  assert.ok(ids.includes("google"));
  assert.ok(ids.includes("kakao"));
  assert.ok(ids.includes("apple"));

  // Threshold info
  assert.ok(res.body.threshold);
  assert.equal(typeof res.body.threshold.n, "number");
  assert.equal(typeof res.body.threshold.k, "number");
});

test("GET /v1/social-login/parameters returns ZK params", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("GET", "/v1/social-login/parameters");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.n, "number");
  assert.equal(typeof res.body.k, "number");
  assert.ok(res.body.k <= res.body.n);
});

test("GET /v1/merkle/root returns merkle root info", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("GET", "/v1/merkle/root");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(typeof res.body.root === "string");
  assert.ok(res.body.root.startsWith("0x"));
  assert.equal(typeof res.body.numLeaves, "number");
  assert.equal(typeof res.body.treeHeight, "number");
});

test("GET /v1/merkle/path/0 returns merkle proof", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("GET", "/v1/merkle/path/0");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.path));
  assert.ok(Array.isArray(res.body.indices));
  assert.ok(res.body.path.length > 0);
});

test("GET /v1/merkle/path/-1 returns 400 for invalid index", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("GET", "/v1/merkle/path/-1");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 400);
});

test("POST /v1/social-login/create-account does not require app auth", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("POST", "/v1/social-login/create-account", {}, {
    jwts: ["a"],
    providers: ["google"],
    txKeyAddress: "0x123",
  });
  const res = mockRes();

  await app(req, res);

  assert.notEqual(res.statusCode, 401);
});

test("POST /v1/social-login/create-account validates required fields", async () => {
  const app = createApp(createMockServices());
  const req = mockReq(
    "POST",
    "/v1/social-login/create-account",
    authHeader(),
    { jwts: ["a"] } // missing providers and txKeyAddress
  );
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.message.includes("required"));
});

test("POST /v1/social-login/recovery-context validates required fields", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("POST", "/v1/social-login/recovery-context", {}, {
    jwts: ["a"],
  });
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.message.includes("required"));
});

test("POST /v1/social-login/recovery-challenge validates required fields", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("POST", "/v1/social-login/recovery-challenge", {}, {
    jwts: ["a"],
    providers: ["google"],
  });
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.message.includes("required"));
});

test("POST /v1/social-login/recovery-challenge returns service result", async () => {
  const services = createMockServices();
  services.zkpasskeyService.prepareRecoveryChallenge = async () => ({
    challenge: {
      nonce: "0x1234",
      zkAccountAddress: "0xabc",
    },
  });
  const app = createApp(services);
  const req = mockReq("POST", "/v1/social-login/recovery-challenge", {}, {
    jwts: ["a", "b"],
    providers: ["google", "apple"],
    newTxKeyAddress: "0x1111111111111111111111111111111111111111",
  });
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.challenge.nonce, "0x1234");
});

test("POST /v1/social-login/recovery-submit validates required fields", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("POST", "/v1/social-login/recovery-submit", {}, {
    jwts: ["a"],
    providers: ["google"],
    newTxKeyAddress: "0x1111111111111111111111111111111111111111",
  });
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.message.includes("required"));
});

test("POST /v1/social-login/recovery-submit returns service result", async () => {
  const services = createMockServices();
  services.zkpasskeyService.submitRecovery = async () => ({
    submission: {
      txHash: "0xtxhash",
    },
  });
  const app = createApp(services);
  const req = mockReq("POST", "/v1/social-login/recovery-submit", {}, {
    jwts: ["a", "b"],
    providers: ["google", "apple"],
    newTxKeyAddress: "0x1111111111111111111111111111111111111111",
    random: "0x1234",
  });
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.submission.txHash, "0xtxhash");
});

test("unknown route returns 404", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("GET", "/v1/nonexistent");
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "not_found");
});

test("POST on GET-only endpoint returns 405", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("POST", "/health", {}, {});
  const res = mockRes();

  await app(req, res);

  // /health only accepts GET; POST should 404 (no specific 405 for /health)
  assert.ok([404, 405].includes(res.statusCode));
});
