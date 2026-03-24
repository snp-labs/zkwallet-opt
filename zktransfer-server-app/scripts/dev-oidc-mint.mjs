import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const devOidcDir = path.join(appDir, "tmp", "dev-oidc");

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function getArg(name, fallback = null) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
}

const provider = getArg("--provider", "google");
const privateKeyPath = fs.existsSync(path.join(devOidcDir, `${provider}-private-key.pem`))
  ? path.join(devOidcDir, `${provider}-private-key.pem`)
  : path.join(devOidcDir, "private-key.pem");
const publicJwkPath = fs.existsSync(path.join(devOidcDir, `${provider}-public-jwk.json`))
  ? path.join(devOidcDir, `${provider}-public-jwk.json`)
  : path.join(devOidcDir, "public-jwk.json");

if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicJwkPath)) {
  throw new Error(
    `Missing dev OIDC keypair for ${provider} in ${devOidcDir}. Run node scripts/dev-oidc-keypair.mjs first.`
  );
}

const publicJwk = JSON.parse(fs.readFileSync(publicJwkPath, "utf8"));
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

const issuer =
  getArg("--issuer") || process.env.DEV_OIDC_ISSUER || `http://127.0.0.1:4400/${provider}`;
const audience =
  getArg("--audience") || process.env.DEV_OIDC_AUDIENCE || "dev-zkwallet-client";
const subject = getArg("--sub") || process.env.DEV_OIDC_SUB || `${provider}-user-1`;
const nonce = getArg("--nonce") || process.env.DEV_OIDC_NONCE || "";
const expiresInSeconds = Number(getArg("--expires-in", process.env.DEV_OIDC_EXPIRES_IN || "3600"));
const now = Math.floor(Date.now() / 1000);

const header = {
  alg: "RS256",
  typ: "JWT",
  kid: publicJwk.kid,
};
const payload = {
  iss: issuer,
  sub: subject,
  aud: audience,
  iat: now,
  exp: now + expiresInSeconds,
};
if (nonce) {
  payload.nonce = nonce;
}

const encodedHeader = base64url(JSON.stringify(header));
const encodedPayload = base64url(JSON.stringify(payload));
const signingInput = `${encodedHeader}.${encodedPayload}`;
const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
const jwt = `${signingInput}.${base64url(signature)}`;

console.log(
  JSON.stringify(
    {
      provider,
      privateKeyPath,
      publicJwkPath,
      issuer,
      audience,
      subject,
      nonce,
      jwt,
    },
    null,
    2
  )
);
