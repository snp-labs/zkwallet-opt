import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const devOidcDir = path.join(appDir, "tmp", "dev-oidc");
const host = process.env.DEV_OIDC_HOST || "127.0.0.1";
const port = Number(process.env.DEV_OIDC_PORT || "4400");
const jwksPath = process.env.DEV_OIDC_JWKS_PATH || "/jwks";
const providers = ["google", "kakao", "apple"];

const publicJwks = providers
  .map((provider) => {
    const providerPath = path.join(devOidcDir, `${provider}-public-jwk.json`);
    if (!fs.existsSync(providerPath)) {
      return null;
    }
    return {
      provider,
      jwk: JSON.parse(fs.readFileSync(providerPath, "utf8")),
    };
  })
  .filter(Boolean);

if (publicJwks.length === 0) {
  const legacyPath = path.join(devOidcDir, "public-jwk.json");
  if (!fs.existsSync(legacyPath)) {
    throw new Error(
      `Missing provider JWKs in ${devOidcDir}. Run node scripts/dev-oidc-keypair.mjs first.`
    );
  }
  publicJwks.push({
    provider: "legacy",
    jwk: JSON.parse(fs.readFileSync(legacyPath, "utf8")),
  });
}

const server = http.createServer((req, res) => {
  if (req.url === jwksPath) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ keys: publicJwks.map((entry) => entry.jwk) }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, host, () => {
  const jwksUrl = `http://${host}:${port}${jwksPath}`;
  console.log(`[dev-oidc-jwks] serving ${jwksUrl}`);
  for (const entry of publicJwks) {
    console.log(`[dev-oidc-jwks] ${entry.provider} kid=${entry.jwk.kid}`);
  }
  console.log("");
  console.log(`# Example provider override env`);
  for (const provider of ["google", "kakao", "apple"]) {
    console.log(`OIDC_${provider.toUpperCase()}_ISSUER_OVERRIDE=http://${host}:${port}/${provider}`);
    console.log(`OIDC_${provider.toUpperCase()}_JWKS_URI_OVERRIDE=${jwksUrl}`);
  }
});
