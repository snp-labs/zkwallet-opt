import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function defaultInputPath() {
  return path.join(appDir, "tmp", "social-recovery-smoke-input.template.json");
}

function isPlaceholderJwt(value) {
  return /^PASTE_[A-Z0-9_]+_JWT_HERE$/u.test(String(value || "").trim());
}

function validateStage(stageName, stage, fallbackProviders) {
  const issues = [];
  const jwts = Array.isArray(stage?.jwts) ? stage.jwts : [];
  const providers = Array.isArray(stage?.providers) ? stage.providers : fallbackProviders;

  if (jwts.length === 0) {
    issues.push(`${stageName}.jwts must be a non-empty array`);
  }
  if (!Array.isArray(providers) || providers.length !== jwts.length) {
    issues.push(`${stageName}.providers must match ${stageName}.jwts length`);
  }
  const placeholderCount = jwts.filter(isPlaceholderJwt).length;
  if (placeholderCount > 0) {
    issues.push(`${stageName}.jwts still contains ${placeholderCount} placeholder JWT value(s)`);
  }

  return {
    issues,
    providers: Array.isArray(providers) ? providers : [],
    jwtCount: jwts.length,
  };
}

async function requestJson(method, baseUrl, pathname) {
  const targetUrl = new URL(pathname, baseUrl);
  const transport = targetUrl.protocol === "https:" ? https : http;

  const response = await new Promise((resolve, reject) => {
    const request = transport.request(
      targetUrl,
      {
        method,
        agent: false,
        headers: { connection: "close" },
      },
      (incoming) => {
        const chunks = [];
        incoming.on("data", (chunk) => chunks.push(chunk));
        incoming.on("end", () => {
          resolve({
            statusCode: incoming.statusCode || 500,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    request.on("error", reject);
    request.end();
  });

  const parsed = response.body ? JSON.parse(response.body) : null;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      parsed?.message ||
        parsed?.error ||
        `Request to ${pathname} failed with ${response.statusCode}`
    );
  }
  return parsed;
}

const baseUrl =
  process.env.SOCIAL_RECOVERY_BASE_URL ||
  getArgValue("--base-url") ||
  `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || "4010"}`;
const inputPath =
  process.env.SOCIAL_RECOVERY_SMOKE_INPUT_PATH ||
  getArgValue("--input") ||
  defaultInputPath();

if (!fs.existsSync(inputPath)) {
  throw new Error(`Missing smoke input JSON at ${inputPath}`);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const health = await requestJson("GET", baseUrl, "/health");
const providerMetadata = await requestJson("GET", baseUrl, "/v1/social-login/providers");
const threshold = providerMetadata.threshold || { n: 0, k: 0 };
const supportedProviders = providerMetadata.providers?.map((provider) => provider.id) || [];

const fallbackProviders = Array.isArray(input.providers) ? input.providers : [];
const createStage = validateStage("create", input.create || { jwts: input.jwts }, fallbackProviders);
const challengeStage = validateStage(
  "challenge",
  input.challenge || input.create || { jwts: input.jwts },
  fallbackProviders
);
const submitStage = validateStage(
  "submit",
  input.submit || input.challenge || input.create || { jwts: input.jwts },
  fallbackProviders
);

const issues = [];
if (!input.txKeyAddress) {
  issues.push("txKeyAddress is required");
}
if (!input.newTxKeyAddress) {
  issues.push("newTxKeyAddress is required");
}
if (createStage.jwtCount < threshold.n) {
  issues.push(`create.jwts must have at least n=${threshold.n} JWTs`);
}
if (challengeStage.jwtCount < threshold.k) {
  issues.push(`challenge.jwts must have at least k=${threshold.k} JWTs`);
}
if (submitStage.jwtCount < threshold.k) {
  issues.push(`submit.jwts must have at least k=${threshold.k} JWTs`);
}
for (const provider of [
  ...createStage.providers,
  ...challengeStage.providers,
  ...submitStage.providers,
]) {
  if (!supportedProviders.includes(provider)) {
    issues.push(`unsupported provider in smoke input: ${provider}`);
  }
}
issues.push(...createStage.issues, ...challengeStage.issues, ...submitStage.issues);

const serverChecks = {
  ready: Boolean(health.ready),
  socialRecoveryReady: Boolean(health.socialRecoveryReady),
  jwtSecretConfigured: Boolean(health.jwtSecretConfigured),
  proofInputPolicyPinned: Boolean(health.proofInputPolicyPinned),
  zkpasskeyRelayerConfigured: Boolean(health.zkpasskeyRelayerConfigured),
  zkpasskeyNapiAvailable: Boolean(health.zkpasskeyNapiAvailable),
  zkpasskeyPkExists: Boolean(health.zkpasskeyPkExists),
};

if (!serverChecks.socialRecoveryReady) {
  issues.push("server reports socialRecoveryReady=false");
}

const result = {
  ok: issues.length === 0,
  baseUrl,
  inputPath,
  threshold,
  supportedProviders,
  inputSummary: {
    txKeyAddress: input.txKeyAddress || null,
    newTxKeyAddress: input.newTxKeyAddress || null,
    create: {
      providerCount: createStage.providers.length,
      jwtCount: createStage.jwtCount,
    },
    challenge: {
      providerCount: challengeStage.providers.length,
      jwtCount: challengeStage.jwtCount,
    },
    submit: {
      providerCount: submitStage.providers.length,
      jwtCount: submitStage.jwtCount,
    },
  },
  serverChecks,
  health: {
    ready: Boolean(health.ready),
    socialRecoveryReady: Boolean(health.socialRecoveryReady),
    socialRecoveryChecks: health.socialRecoveryChecks || {},
  },
  issues,
};

if (jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
} else if (result.ok) {
  console.log("[social-recovery-smoke-check] ready");
  console.log(`baseUrl: ${baseUrl}`);
  console.log(`inputPath: ${inputPath}`);
  console.log(`threshold: n=${threshold.n}, k=${threshold.k}`);
} else {
  console.log("[social-recovery-smoke-check] blocked");
  console.log(`baseUrl: ${baseUrl}`);
  console.log(`inputPath: ${inputPath}`);
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
}

if (!result.ok) {
  process.exitCode = 1;
}
