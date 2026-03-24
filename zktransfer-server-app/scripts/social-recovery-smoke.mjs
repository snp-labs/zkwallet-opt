import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const defaultInputPath = path.join(appDir, "tmp", "social-recovery-smoke-input.json");
const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const outputDir =
  process.env.SOCIAL_RECOVERY_SMOKE_OUTPUT_DIR || getArgValue("--output-dir");

function getArgValue(flag) {
  const flagIndex = args.indexOf(flag);
  if (flagIndex >= 0 && args[flagIndex + 1]) {
    return args[flagIndex + 1];
  }
  return null;
}

function readInputPayload() {
  const inputPath =
    process.env.SOCIAL_RECOVERY_SMOKE_INPUT_PATH ||
    getArgValue("--input") ||
    defaultInputPath;
  if (!fs.existsSync(inputPath)) {
    throw new Error(
      `Missing smoke input JSON at ${inputPath}. Provide --input <path> or SOCIAL_RECOVERY_SMOKE_INPUT_PATH.`
    );
  }
  return {
    inputPath,
    payload: JSON.parse(fs.readFileSync(inputPath, "utf8")),
  };
}

function decodeBase64UrlJson(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddingLength = (4 - (normalized.length % 4 || 4)) % 4;
    const padded = normalized.padEnd(normalized.length + paddingLength, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function summarizeJwt(jwt, provider, index, expectedNonce) {
  if (typeof jwt !== "string" || jwt.length === 0) {
    return {
      slot: index + 1,
      provider,
      format: "missing",
      sha256: null,
      length: 0,
      nonceMatchesExpected: false,
    };
  }

  const [headerPart, payloadPart] = jwt.split(".");
  const header = decodeBase64UrlJson(headerPart);
  const payload = decodeBase64UrlJson(payloadPart);
  const nonce = typeof payload?.nonce === "string" ? payload.nonce : null;
  const subject =
    typeof payload?.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  const audience =
    typeof payload?.aud === "string"
      ? [payload.aud]
      : Array.isArray(payload?.aud)
        ? payload.aud.filter((entry) => typeof entry === "string")
        : [];

  return {
    slot: index + 1,
    provider,
    format: header && payload ? "jwt" : "opaque",
    sha256: sha256(jwt),
    length: jwt.length,
    header: header
      ? {
          alg: header.alg || null,
          kid: header.kid || null,
          typ: header.typ || null,
        }
      : null,
    payload: payload
      ? {
          iss: payload.iss || null,
          aud: audience,
          nonce,
          noncePresent: nonce !== null,
          nonceMatchesExpected: expectedNonce ? nonce === expectedNonce : null,
          subjectHash: subject ? sha256(subject) : null,
          exp: payload.exp ?? null,
          iat: payload.iat ?? null,
        }
      : null,
  };
}

function summarizeStage(stageName, stage, providers, expectedNonce) {
  return {
    stage: stageName,
    count: stage.jwts.length,
    providers,
    jwtSummaries: stage.jwts.map((jwt, index) =>
      summarizeJwt(jwt, providers[index] || null, index, expectedNonce)
    ),
  };
}

function createRedactedArtifacts({
  inputPath,
  inputPayload,
  baseUrl,
  createProviders,
  challengeProviders,
  submitProviders,
  result,
}) {
  const redactedInput = {
    inputPath,
    baseUrl,
    txKeyAddress: inputPayload.txKeyAddress,
    newTxKeyAddress: inputPayload.newTxKeyAddress,
    create: summarizeStage("create", createStage, createProviders, null),
    challenge: summarizeStage("challenge", challengeStage, challengeProviders, null),
    submit: summarizeStage(
      "submit",
      submitStage,
      submitProviders,
      result.challenge.nonce || null
    ),
  };

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    inputPath,
    accountId: result.accountId,
    zkAccountAddress: result.zkAccountAddress,
    challengeNonce: result.challenge.nonce,
    challengeRandom: result.challenge.random,
    submitTransactionHash: result.submit.transactionHash,
    submitUserOpHash: result.submit.userOpHash,
    createJwtCount: redactedInput.create.count,
    challengeJwtCount: redactedInput.challenge.count,
    submitJwtCount: redactedInput.submit.count,
  };

  const reportLines = [
    "# Social Recovery Smoke Report",
    "",
    `- generatedAt: ${manifest.generatedAt}`,
    `- baseUrl: ${baseUrl}`,
    `- inputPath: ${inputPath}`,
    `- accountId: ${result.accountId || "(none)"}`,
    `- zkAccountAddress: ${result.zkAccountAddress || "(none)"}`,
    `- challengeNonce: ${result.challenge.nonce || "(none)"}`,
    `- submitTransactionHash: ${result.submit.transactionHash || "(none)"}`,
    `- submitUserOpHash: ${result.submit.userOpHash || "(none)"}`,
    "",
    "## JWT Summary",
    "",
  ];

  for (const stage of [redactedInput.create, redactedInput.challenge, redactedInput.submit]) {
    reportLines.push(`### ${stage.stage}`);
    reportLines.push("");
    reportLines.push("| Slot | Provider | Format | Length | SHA-256 | Issuer | Audience | Nonce | Nonce Match | Subject Hash |");
    reportLines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const jwt of stage.jwtSummaries) {
      reportLines.push(
        [
          `| ${jwt.slot}`,
          jwt.provider || "(none)",
          jwt.format,
          String(jwt.length),
          jwt.sha256 || "(none)",
          jwt.payload?.iss || "(none)",
          jwt.payload?.aud?.join(",") || "(none)",
          jwt.payload?.noncePresent ? "present" : "absent",
          jwt.payload?.nonceMatchesExpected === null
            ? "(n/a)"
            : jwt.payload?.nonceMatchesExpected
              ? "yes"
              : "no",
          jwt.payload?.subjectHash || "(none)",
        ].join(" | ") + " |"
      );
    }
    reportLines.push("");
  }

  reportLines.push("## Result");
  reportLines.push("");
  reportLines.push("```json");
  reportLines.push(JSON.stringify(result, null, 2));
  reportLines.push("```");
  reportLines.push("");

  return {
    manifest,
    redactedInput,
    reportMarkdown: reportLines.join("\n"),
  };
}

function writeArtifacts(dir, artifacts, result) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "input.redacted.json"),
    JSON.stringify(artifacts.redactedInput, null, 2)
  );
  fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(artifacts.manifest, null, 2)
  );
  fs.writeFileSync(path.join(dir, "report.md"), artifacts.reportMarkdown);
}

function validateStage(stageName, stage, fallbackProviders) {
  if (!stage?.jwts || !Array.isArray(stage.jwts) || stage.jwts.length === 0) {
    throw new Error(`${stageName}.jwts must be a non-empty array`);
  }
  const providers = stage.providers || fallbackProviders;
  if (!Array.isArray(providers) || providers.length !== stage.jwts.length) {
    throw new Error(`${stageName}.providers must match ${stageName}.jwts length`);
  }
  return providers;
}

async function postJson(baseUrl, pathname, body) {
  const targetUrl = new URL(pathname, baseUrl);
  const transport = targetUrl.protocol === "https:" ? https : http;
  const payload = JSON.stringify(body);

  const response = await new Promise((resolve, reject) => {
    const request = transport.request(
      targetUrl,
      {
        method: "POST",
        agent: false,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          "connection": "close",
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
    request.end(payload);
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

const { inputPath, payload } = readInputPayload();
const baseUrl =
  process.env.SOCIAL_RECOVERY_BASE_URL ||
  getArgValue("--base-url") ||
  `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || "4010"}`;

if (!payload.txKeyAddress || !payload.newTxKeyAddress) {
  throw new Error("txKeyAddress and newTxKeyAddress are required in the smoke input JSON");
}

const createStage = payload.create || {
  jwts: payload.jwts,
  providers: payload.providers,
};
const challengeStage = payload.challenge || createStage;
const submitStage = payload.submit || challengeStage;

const createProviders = validateStage("create", createStage, payload.providers);
const challengeProviders = validateStage("challenge", challengeStage, payload.providers);
const submitProviders = validateStage("submit", submitStage, payload.providers);

const createResult = await postJson(baseUrl, "/v1/social-login/create-account", {
  jwts: createStage.jwts,
  providers: createProviders,
  txKeyAddress: payload.txKeyAddress,
});
const challengeResult = await postJson(baseUrl, "/v1/social-login/recovery-challenge", {
  jwts: challengeStage.jwts,
  providers: challengeProviders,
  newTxKeyAddress: payload.newTxKeyAddress,
});
const submitResult = await postJson(baseUrl, "/v1/social-login/recovery-submit", {
  jwts: submitStage.jwts,
  providers: submitProviders,
  newTxKeyAddress: payload.newTxKeyAddress,
  random: payload.submit?.random || challengeResult.challenge?.random,
});

const result = {
  baseUrl,
  inputPath,
  accountId: createResult.accountData?.accountId || submitResult.account?.accountId || null,
  zkAccountAddress:
    submitResult.account?.chainAccount?.zkAccountAddress ||
    createResult.chainAccount?.zkAccountAddress ||
    null,
  create: {
    providers: createProviders,
    chainAccount: createResult.chainAccount || null,
  },
  challenge: {
    nonce: challengeResult.challenge?.nonce || null,
    random: challengeResult.challenge?.random || null,
    userOpHash: challengeResult.challenge?.userOpHash || null,
    zkAccountAddress: challengeResult.challenge?.zkAccountAddress || null,
  },
  submit: {
    transactionHash: submitResult.submission?.transactionHash || null,
    userOpHash: submitResult.submission?.userOpHash || null,
    recoveryCounter: submitResult.challenge?.counter || null,
  },
};

if (outputDir) {
  const artifacts = createRedactedArtifacts({
    inputPath,
    inputPayload: payload,
    baseUrl,
    createProviders,
    challengeProviders,
    submitProviders,
    result,
  });
  writeArtifacts(outputDir, artifacts, result);
  result.artifactsDir = outputDir;
}

if (jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("[social-recovery-smoke] completed create -> challenge -> submit");
  console.log(`baseUrl: ${baseUrl}`);
  console.log(`inputPath: ${inputPath}`);
  console.log(`accountId: ${result.accountId}`);
  console.log(`zkAccountAddress: ${result.zkAccountAddress}`);
  console.log(`challenge nonce: ${result.challenge.nonce}`);
  console.log(`challenge random: ${result.challenge.random}`);
  console.log(`submit txHash: ${result.submit.transactionHash}`);
  if (result.artifactsDir) {
    console.log(`artifactsDir: ${result.artifactsDir}`);
  }
}
