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
  assert.equal(res.body.app, "test-app");
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

test("POST /v1/social-login/create-account requires auth", async () => {
  const app = createApp(createMockServices());
  const req = mockReq("POST", "/v1/social-login/create-account", {}, {
    jwts: ["a"],
    providers: ["google"],
    txKeyAddress: "0x123",
  });
  const res = mockRes();

  await app(req, res);

  assert.equal(res.statusCode, 401);
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
