import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import crypto from "node:crypto";
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

function splitProviders(raw) {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function expandProvidersToCount(providers, count) {
  if (!providers.length) {
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

async function requestJson(method, baseUrl, pathname) {
  const targetUrl = new URL(pathname, baseUrl);
  const transport = targetUrl.protocol === "https:" ? https : http;

  const response = await new Promise((resolve, reject) => {
    const request = transport.request(
      targetUrl,
      {
        method,
        agent: false,
        headers: {
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

function buildJwtPlaceholders(prefix, providers) {
  const seenCounts = new Map();
  return providers.map((provider) => {
    const ordinal = (seenCounts.get(provider) || 0) + 1;
    seenCounts.set(provider, ordinal);
    return `PASTE_${prefix}_${provider.toUpperCase()}_${ordinal}_JWT_HERE`;
  });
}

const baseUrl =
  process.env.SOCIAL_RECOVERY_BASE_URL ||
  getArgValue("--base-url") ||
  `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || "4010"}`;
const outputPath =
  process.env.SOCIAL_RECOVERY_SMOKE_TEMPLATE_PATH ||
  getArgValue("--output") ||
  path.join(appDir, "tmp", "social-recovery-smoke-input.template.json");

const providerMetadata = await requestJson("GET", baseUrl, "/v1/social-login/providers");
const supportedProviders = providerMetadata.providers?.map((provider) => provider.id) || [];
const threshold = providerMetadata.threshold || { n: 3, k: 2 };

const requestedProviders = splitProviders(
  process.env.SOCIAL_RECOVERY_TEMPLATE_PROVIDERS || getArgValue("--providers")
);
const baseProviders = requestedProviders.length > 0 ? requestedProviders : supportedProviders;
if (baseProviders.length === 0) {
  throw new Error("No supported providers available from /v1/social-login/providers");
}

const createProviders = expandProvidersToCount(baseProviders, threshold.n);
const recoveryProviders = createProviders.slice(0, threshold.k);

const template = {
  _meta: {
    generatedAt: new Date().toISOString(),
    baseUrl,
    supportedProviders,
    threshold,
    notes: [
      "Replace every PASTE_*_JWT_HERE placeholder with a real provider JWT.",
      "challenge.jwts and submit.jwts should be freshly minted for the recovery attempt.",
      "submit.jwts should carry the nonce returned by /v1/social-login/recovery-challenge.",
      "The default txKeyAddress values are random placeholders; replace them if you need fixed keys.",
    ],
  },
  providers: createProviders,
  txKeyAddress: createRandomAddress(),
  newTxKeyAddress: createRandomAddress(),
  create: {
    providers: createProviders,
    jwts: buildJwtPlaceholders("CREATE", createProviders),
  },
  challenge: {
    providers: recoveryProviders,
    jwts: buildJwtPlaceholders("CHALLENGE", recoveryProviders),
  },
  submit: {
    providers: recoveryProviders,
    jwts: buildJwtPlaceholders("SUBMIT", recoveryProviders),
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);

if (jsonOnly) {
  console.log(JSON.stringify({ outputPath, template }, null, 2));
} else {
  console.log("[social-recovery-smoke-template] generated");
  console.log(`baseUrl: ${baseUrl}`);
  console.log(`outputPath: ${outputPath}`);
  console.log(`supportedProviders: ${supportedProviders.join(", ")}`);
  console.log(`threshold: n=${threshold.n}, k=${threshold.k}`);
}
