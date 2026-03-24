import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const defaultBaseUrl = `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || "4010"}`;
const defaultJwksBaseUrl = `http://${process.env.DEV_OIDC_HOST || "127.0.0.1"}:${
  process.env.DEV_OIDC_PORT || "4400"
}`;

function getArgValue(flag) {
  const flagIndex = args.indexOf(flag);
  if (flagIndex >= 0 && args[flagIndex + 1]) {
    return args[flagIndex + 1];
  }
  return null;
}

function splitProviders(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function expandProvidersToThreshold(providers, count) {
  if (!Array.isArray(providers) || providers.length === 0) {
    return [];
  }
  const expanded = [];
  for (let index = 0; index < count; index += 1) {
    expanded.push(providers[index % providers.length]);
  }
  return expanded;
}

function createRandomAddress() {
  return `0x${crypto.randomBytes(20).toString("hex")}`;
}

function base64urlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function readJwtPayload(rawJwt) {
  const parts = String(rawJwt).split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format while decoding payload");
  }
  return JSON.parse(base64urlDecode(parts[1]));
}

async function requestJson(method, baseUrl, pathname, body = null) {
  const targetUrl = new URL(pathname, baseUrl);
  const transport = targetUrl.protocol === "https:" ? https : http;
  const payload = body === null ? "" : JSON.stringify(body);

  const response = await new Promise((resolve, reject) => {
    const request = transport.request(
      targetUrl,
      {
        method,
        agent: false,
        headers:
          body === null
            ? {
                connection: "close",
              }
            : {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(payload),
                connection: "close",
              },
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
    if (body !== null) {
      request.end(payload);
      return;
    }
    request.end();
  });

  const parsedBody = response.body ? JSON.parse(response.body) : null;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const errorField =
      typeof parsedBody?.error === "string"
        ? parsedBody.error
        : parsedBody?.error
          ? JSON.stringify(parsedBody.error)
          : "";
    const responseSummary =
      typeof parsedBody === "string"
        ? parsedBody
        : parsedBody
          ? JSON.stringify(parsedBody)
          : "";
    const message =
      parsedBody?.message ||
      errorField ||
      responseSummary ||
      `Request to ${pathname} failed with ${response.statusCode}`;
    throw new Error(message);
  }

  return parsedBody;
}

async function ensureDevOidcKeypair() {
  const privateKeyPath = path.join(appDir, "tmp", "dev-oidc", "private-key.pem");
  const publicJwkPath = path.join(appDir, "tmp", "dev-oidc", "public-jwk.json");
  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicJwkPath)) {
    return;
  }
  await execFileAsync("node", [path.join(appDir, "scripts", "dev-oidc-keypair.mjs")], {
    cwd: appDir,
    encoding: "utf8",
    env: process.env,
  });
}

async function mintDevOidcJwt({
  provider,
  issuer,
  audience,
  subject,
  nonce = "",
}) {
  const command = [
    path.join(appDir, "scripts", "dev-oidc-mint.mjs"),
    "--provider",
    provider,
    "--issuer",
    issuer,
    "--audience",
    audience,
    "--sub",
    subject,
  ];
  if (nonce) {
    command.push("--nonce", nonce);
  }
  const { stdout } = await execFileAsync("node", command, {
    cwd: appDir,
    encoding: "utf8",
    env: process.env,
  });
  return JSON.parse(stdout).jwt;
}

function getSubjectForProvider(provider, ordinal = 1) {
  const override = process.env[`DEV_OIDC_SUB_${provider.toUpperCase()}`];
  if (override) {
    return override;
  }
  return `${provider}-dev-user-${ordinal}`;
}

function buildIdentitySlots(providers) {
  const ordinalByProvider = new Map();
  return providers.map((provider) => {
    const ordinal = (ordinalByProvider.get(provider) || 0) + 1;
    ordinalByProvider.set(provider, ordinal);
    return {
      provider,
      subject: getSubjectForProvider(provider, ordinal),
    };
  });
}

function selectRecoverySlots(createSlots, desiredProviders, count) {
  if (!Array.isArray(desiredProviders) || desiredProviders.length === 0) {
    return createSlots.slice(0, count);
  }
  const remaining = [...createSlots];
  const selected = [];
  for (const provider of desiredProviders) {
    const matchIndex = remaining.findIndex((slot) => slot.provider === provider);
    if (matchIndex < 0) {
      throw new Error(
        `Could not find a create-stage identity for recovery provider ${provider}`
      );
    }
    selected.push(remaining[matchIndex]);
    remaining.splice(matchIndex, 1);
  }
  return selected;
}

function getOidcOverrides(jwksBaseUrl, providers) {
  return Object.fromEntries(
    providers.flatMap((provider) => [
      [`OIDC_${provider.toUpperCase()}_ISSUER_OVERRIDE`, `${jwksBaseUrl}/${provider}`],
      [`OIDC_${provider.toUpperCase()}_JWKS_URI_OVERRIDE`, `${jwksBaseUrl}/jwks`],
    ])
  );
}

const baseUrl =
  process.env.SOCIAL_RECOVERY_BASE_URL ||
  getArgValue("--base-url") ||
  defaultBaseUrl;
const jwksBaseUrl =
  process.env.DEV_OIDC_BASE_URL ||
  getArgValue("--jwks-base-url") ||
  defaultJwksBaseUrl;
const audience =
  process.env.DEV_OIDC_AUDIENCE ||
  getArgValue("--audience") ||
  "dev-zkwallet-client";
const txKeyAddress =
  process.env.SOCIAL_RECOVERY_TX_KEY_ADDRESS ||
  getArgValue("--tx-key-address") ||
  createRandomAddress();
const newTxKeyAddress =
  process.env.SOCIAL_RECOVERY_NEW_TX_KEY_ADDRESS ||
  getArgValue("--new-tx-key-address") ||
  createRandomAddress();

await ensureDevOidcKeypair();

const providerMetadata = await requestJson("GET", baseUrl, "/v1/social-login/providers");
const supportedProviders = providerMetadata.providers?.map((provider) => provider.id) || [];
const threshold = providerMetadata.threshold || { n: 3, k: 2 };
const defaultCreateProviders = expandProvidersToThreshold(supportedProviders, threshold.n);
const createProviders = splitProviders(
  getArgValue("--create-providers") || process.env.DEV_OIDC_CREATE_PROVIDERS
);
const effectiveCreateProviders =
  createProviders.length > 0 ? createProviders : defaultCreateProviders;
if (effectiveCreateProviders.length < threshold.n) {
  throw new Error(
    `Need at least ${threshold.n} create providers, got ${effectiveCreateProviders.length}`
  );
}

const recoveryProviders = splitProviders(
  getArgValue("--recovery-providers") || process.env.DEV_OIDC_RECOVERY_PROVIDERS
);
const effectiveRecoveryProviders =
  recoveryProviders.length > 0
    ? recoveryProviders
    : effectiveCreateProviders.slice(0, threshold.k);
if (effectiveRecoveryProviders.length < threshold.k) {
  throw new Error(
    `Need at least ${threshold.k} recovery providers, got ${effectiveRecoveryProviders.length}`
  );
}

const allProviders = [...new Set([...effectiveCreateProviders, ...effectiveRecoveryProviders])];
const unsupported = allProviders.filter((provider) => !supportedProviders.includes(provider));
if (unsupported.length > 0) {
  throw new Error(`Unsupported providers requested: ${unsupported.join(", ")}`);
}

const createSlots = buildIdentitySlots(effectiveCreateProviders);
const recoverySlots = selectRecoverySlots(
  createSlots,
  recoveryProviders.length > 0 ? recoveryProviders : null,
  threshold.k
);

const mintStage = async (slots, nonce = "") =>
  Promise.all(
    slots.map((slot) =>
      mintDevOidcJwt({
        provider: slot.provider,
        issuer: `${jwksBaseUrl}/${slot.provider}`,
        audience,
        subject: slot.subject,
        nonce,
      })
    )
  );

const createJwts = await mintStage(createSlots);
const challengeJwts = await mintStage(recoverySlots);

const createResult = await requestJson("POST", baseUrl, "/v1/social-login/create-account", {
  jwts: createJwts,
  providers: createSlots.map((slot) => slot.provider),
  txKeyAddress,
});

const challengeResult = await requestJson(
  "POST",
  baseUrl,
  "/v1/social-login/recovery-challenge",
  {
    jwts: challengeJwts,
    providers: recoverySlots.map((slot) => slot.provider),
    newTxKeyAddress,
  }
);

const challengeNonce = challengeResult.challenge?.nonce || "";
if (!challengeNonce) {
  throw new Error("Recovery challenge response did not include a nonce");
}

const submitJwts = await mintStage(recoverySlots, challengeNonce);
const submitResult = await requestJson("POST", baseUrl, "/v1/social-login/recovery-submit", {
  jwts: submitJwts,
  providers: recoverySlots.map((slot) => slot.provider),
  newTxKeyAddress,
  random: challengeResult.challenge?.random,
});

const result = {
  baseUrl,
  jwksBaseUrl,
  txKeyAddress,
  newTxKeyAddress,
  threshold,
  create: {
    providers: createSlots.map((slot) => slot.provider),
    subjects: createSlots.map((slot) => slot.subject),
    jwtCount: createJwts.length,
    chainAccount: createResult.chainAccount || null,
  },
  challenge: {
    providers: recoverySlots.map((slot) => slot.provider),
    subjects: recoverySlots.map((slot) => slot.subject),
    jwtCount: challengeJwts.length,
    nonce: challengeNonce,
    random: challengeResult.challenge?.random || null,
    userOpHash: challengeResult.challenge?.userOpHash || null,
  },
  submit: {
    providers: recoverySlots.map((slot) => slot.provider),
    subjects: recoverySlots.map((slot) => slot.subject),
    jwtCount: submitJwts.length,
    nonceFromJwt: readJwtPayload(submitJwts[0]).nonce || "",
    transactionHash:
      submitResult.submission?.transactionHash || submitResult.submission?.txHash || null,
    userOpHash:
      submitResult.submission?.userOpHash ||
      submitResult.submission?.userOperation?.userOpHash ||
      null,
  },
  oidcOverrides: getOidcOverrides(jwksBaseUrl, allProviders),
};

if (jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("[social-recovery-dev-oidc-smoke] completed create -> challenge -> submit");
  console.log(`baseUrl: ${result.baseUrl}`);
  console.log(`jwksBaseUrl: ${result.jwksBaseUrl}`);
  console.log(`txKeyAddress: ${result.txKeyAddress}`);
  console.log(`newTxKeyAddress: ${result.newTxKeyAddress}`);
  console.log(`create providers: ${result.create.providers.join(", ")}`);
  console.log(`recovery providers: ${result.challenge.providers.join(", ")}`);
  console.log(`challenge nonce: ${result.challenge.nonce}`);
  console.log(`submit txHash: ${result.submit.transactionHash}`);
}
