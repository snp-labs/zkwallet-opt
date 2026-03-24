import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const devOidcDir = path.join(appDir, "tmp", "dev-oidc");
const providers = ["google", "kakao", "apple"];

fs.mkdirSync(devOidcDir, { recursive: true });

function ensureProviderKeypair(provider) {
  const privateKeyPath = path.join(devOidcDir, `${provider}-private-key.pem`);
  const publicJwkPath = path.join(devOidcDir, `${provider}-public-jwk.json`);

  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicJwkPath)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const privatePem = privateKey.export({ format: "pem", type: "pkcs8" });
    const publicJwk = publicKey.export({ format: "jwk" });
    const kid = crypto
      .createHash("sha256")
      .update(`${provider}:${publicJwk.n}`)
      .digest("hex")
      .slice(0, 16);
    publicJwk.kid = kid;
    publicJwk.use = "sig";
    publicJwk.alg = "RS256";
    fs.writeFileSync(privateKeyPath, privatePem);
    fs.writeFileSync(publicJwkPath, JSON.stringify(publicJwk, null, 2));
  }

  return {
    provider,
    privateKeyPath,
    publicJwkPath,
    jwk: JSON.parse(fs.readFileSync(publicJwkPath, "utf8")),
  };
}

const generated = providers.map(ensureProviderKeypair);

console.log(
  JSON.stringify(
    {
      devOidcDir,
      providers: generated.map((entry) => ({
        provider: entry.provider,
        privateKeyPath: entry.privateKeyPath,
        publicJwkPath: entry.publicJwkPath,
        kid: entry.jwk.kid,
        jwk: entry.jwk,
      })),
    },
    null,
    2
  )
);
