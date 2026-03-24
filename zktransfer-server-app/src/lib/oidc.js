/**
 * OIDC Provider Validation
 *
 * Fetches JWKS (JSON Web Key Sets) from Google, Kakao, Apple and verifies
 * JWT RS256 signatures. Extracts claims (iss, sub, aud, nonce, exp) for
 * use in zkpasskey anchor generation and recovery proof.
 */

import crypto from "node:crypto";

// ─── Provider Configuration ──────────────────────────────────

const BASE_PROVIDER_CONFIG = {
  google: {
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    issuer: "https://accounts.google.com",
  },
  kakao: {
    jwksUri: "https://kauth.kakao.com/.well-known/jwks.json",
    issuer: "https://kauth.kakao.com",
  },
  apple: {
    jwksUri: "https://appleid.apple.com/auth/keys",
    issuer: "https://appleid.apple.com",
  },
};

function getProviderOverrideKey(provider, suffix) {
  return `OIDC_${provider.toUpperCase()}_${suffix}_OVERRIDE`;
}

export function getProviderConfig(provider, env = process.env) {
  const config = BASE_PROVIDER_CONFIG[provider];
  if (!config) {
    throw new Error(`Unknown OIDC provider: ${provider}`);
  }
  return {
    ...config,
    issuer: env[getProviderOverrideKey(provider, "ISSUER")] || config.issuer,
    jwksUri: env[getProviderOverrideKey(provider, "JWKS_URI")] || config.jwksUri,
  };
}

// ─── JWKS Cache ──────────────────────────────────────────────

const jwksCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch JWKS keys for a provider, using a short-lived cache.
 *
 * @param {string} provider - 'google' | 'kakao' | 'apple'
 * @returns {Promise<Array>} Array of JWK key objects
 */
async function fetchJwks(provider) {
  const config = getProviderConfig(provider);

  const cached = jwksCache.get(provider);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.keys;
  }

  const response = await fetch(config.jwksUri);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch JWKS for ${provider}: ${response.status} ${response.statusText}`
    );
  }
  const jwks = await response.json();
  const keys = jwks.keys || [];

  jwksCache.set(provider, { keys, fetchedAt: Date.now() });
  return keys;
}

/**
 * Find a JWK by key ID (kid) from the provider's JWKS endpoint.
 */
async function findJwk(provider, kid) {
  const keys = await fetchJwks(provider);
  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    throw new Error(
      `JWK with kid="${kid}" not found for provider "${provider}"`
    );
  }
  return jwk;
}

// ─── Base64URL Helpers ───────────────────────────────────────

function base64urlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function readJwtHeader(rawJwt) {
  const parts = rawJwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }
  return JSON.parse(base64urlDecode(parts[0]).toString("utf8"));
}

// ─── JWT RS256 Verification ──────────────────────────────────

/**
 * Verify a JWT RS256 token against the provider's JWKS keys.
 *
 * @param {string} rawJwt - Full JWT string (header.payload.signature)
 * @param {string} provider - 'google' | 'kakao' | 'apple'
 * @returns {Promise<Object>} Decoded payload with verified claims
 * @throws If signature is invalid, token is expired, or issuer mismatch
 */
export async function verifyOidcJwt(rawJwt, provider) {
  const config = getProviderConfig(provider);

  const parts = rawJwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header to get kid and alg
  const header = JSON.parse(base64urlDecode(headerB64).toString("utf8"));
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported JWT algorithm: ${header.alg}, expected RS256`);
  }
  if (!header.kid) {
    throw new Error("JWT header missing kid (key ID)");
  }

  // Fetch matching JWK
  const jwk = await findJwk(provider, header.kid);

  // Convert JWK to PEM for crypto.verify
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });

  // Verify RS256 signature
  const signedContent = `${headerB64}.${payloadB64}`;
  const signature = base64urlDecode(signatureB64);

  const isValid = crypto.verify(
    "sha256",
    Buffer.from(signedContent, "utf8"),
    publicKey,
    signature
  );

  if (!isValid) {
    throw new Error("JWT signature verification failed");
  }

  // Decode payload
  const payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));

  // Validate issuer
  if (payload.iss !== config.issuer) {
    throw new Error(
      `Issuer mismatch: expected "${config.issuer}", got "${payload.iss}"`
    );
  }

  // Validate expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error("JWT has expired");
  }

  return {
    provider,
    iss: payload.iss,
    sub: payload.sub,
    aud: payload.aud,
    exp: payload.exp,
    nonce: payload.nonce || "",
    rawJwt,
  };
}

/**
 * Extract OIDC secret (aud, iss, sub) from a verified JWT payload.
 * This is the input format required by the NAPI anchor generation.
 */
export function extractOidcSecret(verifiedPayload) {
  return {
    aud: verifiedPayload.aud,
    iss: verifiedPayload.iss,
    sub: verifiedPayload.sub,
  };
}

/**
 * Get the RSA public key (n, e) in the format required for ZK proof inputs.
 * Returns the modulus and exponent as hex strings.
 */
export async function getProviderRsaPublicKey(provider, kid) {
  const jwk = await findJwk(provider, kid);
  return {
    n: jwk.n,
    e: jwk.e,
    kid: jwk.kid,
  };
}

export async function getProviderRsaPublicKeyFromJwt(rawJwt, provider) {
  const header = readJwtHeader(rawJwt);
  if (!header.kid) {
    throw new Error("JWT header missing kid (key ID)");
  }
  return getProviderRsaPublicKey(provider, header.kid);
}

/**
 * Get the list of supported OIDC providers with their configuration.
 */
export function getSupportedProviders() {
  return Object.keys(BASE_PROVIDER_CONFIG).map((id) => {
    const config = getProviderConfig(id);
    return {
      id,
      issuer: config.issuer,
      jwksUri: config.jwksUri,
    };
  });
}

/**
 * Flush the JWKS cache (useful for key rotation events).
 */
export function clearJwksCache() {
  jwksCache.clear();
}
