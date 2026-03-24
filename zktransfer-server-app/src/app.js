import { verifyJwt } from "./lib/jwt.js";
import {
  applyCors,
  readJson,
  writeError,
  writeJson,
  writeMethodNotAllowed,
  writeNotFound
} from "./lib/http.js";
import { randomId } from "./lib/ids.js";
import { validateZkTransferRequest } from "./services/requestValidator.js";
import { getSupportedProviders } from "./lib/oidc.js";
import { buildSocialRecoveryStatus } from "./lib/socialRecoveryStatus.js";
import QRCode from "qrcode";

function getAuthToken(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }
  return token;
}

async function requireUser(req, res, services) {
  const token = getAuthToken(req);
  if (!token) {
    writeError(res, 401, "unauthorized", "missing bearer token");
    return null;
  }
  try {
    const claims = verifyJwt(token, services.config.jwtSecret);
    const user = await services.store.getUser(claims.sub);
    if (!user) {
      writeError(res, 401, "unauthorized", "user not found");
      return null;
    }
    return user;
  } catch (error) {
    writeError(res, 401, "unauthorized", error.message);
    return null;
  }
}

export function createApp(services) {
  return async function app(req, res) {
    applyCors(req, res);
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      const zkParams = services.zkpasskeyService?.getZkParameters?.() || { n: 0, k: 0 };
      const zkpasskeyStatus = services.zkpasskeyService?.getStatus?.() || {
        napiAvailable: false,
        relayer: {
          relayerConfigured: services.config.zkpasskeyRelayerConfigured,
        },
      };
      const checks = {
        proofBinaryExists: services.config.proofBinaryExists,
        proofInputBuilderExists: services.config.proofInputBuilderExists,
        jwtSecretConfigured: services.config.jwtSecretConfigured,
        proofInputPolicyPinned: services.config.proofInputPolicyPinned
      };
      const socialRecoveryStatus = buildSocialRecoveryStatus({
        config: services.config,
        zkpasskeyStatus,
        zkParams,
      });
      const proofInputTelemetry = services.orchestrator?.getProofInputTelemetry?.() || {
        totalProofInputs: 0,
        legacyLeafPosInputs: 0,
        flattenedFourAryInputs: 0,
        lastInputContract: "none",
        lastTreeProofLength: 0,
        lastInputAnalyzedAt: null,
        lastLegacyLeafPosDetectedAt: null,
        legacyLeafPosWarningEmitted: false
      };
      writeJson(res, 200, {
        ok: true,
        ready: Object.values(checks).every(Boolean),
        app: services.config.appName,
        custodyMode: services.config.custodyMode,
        executionMode: services.config.executionMode,
        jwtSecretConfigured: services.config.jwtSecretConfigured,
        usingDefaultJwtSecret: services.config.usingDefaultJwtSecret,
        usingPlaceholderJwtSecret: services.config.usingPlaceholderJwtSecret,
        allowLegacyProofInputs: services.config.allowLegacyProofInputs,
        proofInputPolicyPinned: services.config.proofInputPolicyPinned,
        zkpasskeyRelayerConfigured: services.config.zkpasskeyRelayerConfigured,
        zkpasskeyRecoveryFundingConfigured:
          services.config.zkpasskeyRecoveryFundingConfigured,
        zkpasskeyNapiAvailable: Boolean(zkpasskeyStatus.napiAvailable),
        zkpasskeyPkExists: services.config.zkpasskeyPkExists,
        socialRecoveryReady: socialRecoveryStatus.socialRecoveryReady,
        socialRecoveryChecks: socialRecoveryStatus.socialRecoveryChecks,
        socialRecoveryThreshold: socialRecoveryStatus.socialRecoveryThreshold,
        proofInputTelemetry,
        checks
      });
      return;
    }

    if (url.pathname === "/v1/auth/social/mock") {
      if (req.method !== "POST") {
        writeMethodNotAllowed(res);
        return;
      }
      try {
        const body = await readJson(req);
        const session = await services.authService.issueMockLogin(body);
        writeJson(res, 200, session);
      } catch (error) {
        writeError(res, 400, "invalid_request", error.message);
      }
      return;
    }

    if (url.pathname === "/v1/zktransfer/requests") {
      if (req.method === "GET") {
        const user = await requireUser(req, res, services);
        if (!user) {
          return;
        }
        const requests = await services.store.listRequestsByUser(user.userId);
        writeJson(res, 200, { items: requests });
        return;
      }
      if (req.method !== "POST") {
        writeMethodNotAllowed(res);
        return;
      }
      const user = await requireUser(req, res, services);
      if (!user) {
        return;
      }
      try {
        const body = await readJson(req);
        const validation = validateZkTransferRequest(body, services.config);
        if (!validation.ok) {
          writeError(res, 400, "invalid_request", validation.message);
          return;
        }
        const requestRecord = {
          requestId: randomId("zkreq"),
          userId: user.userId,
          status: "received",
          proofStatus: "pending",
          chainStatus: "pending",
          txHash: null,
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...body
        };
        await services.store.createRequest(requestRecord);
        await services.orchestrator.enqueue(requestRecord);
        writeJson(res, 202, {
          requestId: requestRecord.requestId,
          status: requestRecord.status,
          proofStatus: requestRecord.proofStatus,
          txHash: requestRecord.txHash
        });
      } catch (error) {
        writeError(res, 400, "invalid_request", error.message);
      }
      return;
    }

    if (url.pathname === "/v1/me/summary") {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const user = await requireUser(req, res, services);
      if (!user) {
        return;
      }
      const summary = await services.profileService.getSummary(user.userId);
      writeJson(res, 200, {
        user: {
          displayName: user.displayName,
          email: user.email
        },
        summary
      });
      return;
    }

    if (url.pathname === "/v1/me/address-qr") {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const user = await requireUser(req, res, services);
      if (!user) {
        return;
      }
      const summary = await services.profileService.getSummary(user.userId);
      const qrPayload = await services.profileService.getQrPayload(user.userId);
      const svg = await QRCode.toString(qrPayload, {
        type: "svg",
        margin: 1,
        color: {
          dark: "#16243d",
          light: "#ffffff"
        }
      });
      writeJson(res, 200, {
        walletAddress: summary.walletAddress,
        qrPayload,
        svg
      });
      return;
    }

    if (url.pathname === "/v1/contacts") {
      const user = await requireUser(req, res, services);
      if (!user) {
        return;
      }
      if (req.method === "GET") {
        const contacts = await services.profileService.getContacts(user.userId);
        writeJson(res, 200, { items: contacts });
        return;
      }
      if (req.method === "POST") {
        try {
          const body = await readJson(req);
          let payload = body;
          if (body.qrPayload) {
            payload = services.profileService.parseQrContact(body.qrPayload);
          }
          if (!payload.name || !payload.walletAddress) {
            writeError(res, 400, "invalid_request", "name and walletAddress are required");
            return;
          }
          const contact = await services.profileService.addContact(user.userId, payload);
          writeJson(res, 201, contact);
        } catch (error) {
          writeError(res, 400, "invalid_request", error.message);
        }
        return;
      }
      writeMethodNotAllowed(res);
      return;
    }

    if (url.pathname === "/v1/settings") {
      if (req.method !== "PUT") {
        writeMethodNotAllowed(res);
        return;
      }
      const user = await requireUser(req, res, services);
      if (!user) {
        return;
      }
      try {
        const body = await readJson(req);
        const settings = await services.profileService.updateSettings(user.userId, body);
        writeJson(res, 200, { settings });
      } catch (error) {
        writeError(res, 400, "invalid_request", error.message);
      }
      return;
    }

    if (url.pathname.startsWith("/v1/zktransfer/requests/")) {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const user = await requireUser(req, res, services);
      if (!user) {
        return;
      }
      const requestId = url.pathname.split("/").pop();
      const request = await services.store.getRequest(requestId);
      if (!request || request.userId !== user.userId) {
        writeNotFound(res);
        return;
      }
      writeJson(res, 200, request);
      return;
    }

    if (url.pathname === "/v1/local-chain/transactions") {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const items = await services.store.listTransactions();
      writeJson(res, 200, { items });
      return;
    }

    if (url.pathname.startsWith("/v1/local-chain/transactions/")) {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const txHash = url.pathname.split("/").pop();
      const transaction = await services.store.getTransaction(txHash);
      if (!transaction) {
        writeNotFound(res);
        return;
      }
      writeJson(res, 200, transaction);
      return;
    }

    // ─── Social Login / zkpasskey Endpoints ───────────────

    if (url.pathname === "/v1/social-login/providers") {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const providers = getSupportedProviders();
      const params = services.zkpasskeyService.getZkParameters();
      writeJson(res, 200, {
        providers,
        threshold: { n: params.n, k: params.k },
        status: services.zkpasskeyService.getStatus(),
      });
      return;
    }

    if (url.pathname === "/v1/social-login/parameters") {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const params = services.zkpasskeyService.getZkParameters();
      writeJson(res, 200, params);
      return;
    }

    if (url.pathname === "/v1/social-login/create-account") {
      if (req.method !== "POST") {
        writeMethodNotAllowed(res);
        return;
      }
      try {
        const body = await readJson(req);
        if (!body.jwts || !body.providers || !body.txKeyAddress) {
          writeError(
            res,
            400,
            "invalid_request",
            "jwts, providers, and txKeyAddress are required"
          );
          return;
        }
        const result = await services.zkpasskeyService.createAccount({
          jwts: body.jwts,
          providers: body.providers,
          txKeyAddress: body.txKeyAddress,
        });
        writeJson(res, 201, result);
      } catch (error) {
        writeError(res, 400, "account_creation_failed", error.message);
      }
      return;
    }

    if (url.pathname === "/v1/social-login/recovery-context") {
      if (req.method !== "POST") {
        writeMethodNotAllowed(res);
        return;
      }
      try {
        const body = await readJson(req);
        if (!body.jwts || !body.providers) {
          writeError(
            res,
            400,
            "invalid_request",
            "jwts and providers are required"
          );
          return;
        }
        const context = await services.zkpasskeyService.buildRecoveryContext({
          jwts: body.jwts,
          providers: body.providers,
        });
        writeJson(res, 200, context);
      } catch (error) {
        writeError(res, 400, "recovery_context_failed", error.message);
      }
      return;
    }

    if (url.pathname === "/v1/social-login/recovery-challenge") {
      if (req.method !== "POST") {
        writeMethodNotAllowed(res);
        return;
      }
      try {
        const body = await readJson(req);
        if (!body.jwts || !body.providers || !body.newTxKeyAddress) {
          writeError(
            res,
            400,
            "invalid_request",
            "jwts, providers, and newTxKeyAddress are required"
          );
          return;
        }
        const result = await services.zkpasskeyService.prepareRecoveryChallenge({
          jwts: body.jwts,
          providers: body.providers,
          newTxKeyAddress: body.newTxKeyAddress,
        });
        writeJson(res, 200, result);
      } catch (error) {
        writeError(res, 400, "recovery_challenge_failed", error.message);
      }
      return;
    }

    if (url.pathname === "/v1/social-login/recovery-submit") {
      if (req.method !== "POST") {
        writeMethodNotAllowed(res);
        return;
      }
      try {
        const body = await readJson(req);
        if (!body.jwts || !body.providers || !body.newTxKeyAddress || !body.random) {
          writeError(
            res,
            400,
            "invalid_request",
            "jwts, providers, newTxKeyAddress, and random are required"
          );
          return;
        }
        const result = await services.zkpasskeyService.submitRecovery({
          jwts: body.jwts,
          providers: body.providers,
          newTxKeyAddress: body.newTxKeyAddress,
          random: body.random,
        });
        writeJson(res, 200, result);
      } catch (error) {
        writeError(res, 400, "recovery_submit_failed", error.message);
      }
      return;
    }

    if (url.pathname === "/v1/social-login/recover") {
      if (req.method !== "POST") {
        writeMethodNotAllowed(res);
        return;
      }
      try {
        const body = await readJson(req);
        if (!body.jwts || !body.providers) {
          writeError(
            res,
            400,
            "invalid_request",
            "jwts and providers are required"
          );
          return;
        }
        const result = await services.zkpasskeyService.generateRecoveryProof({
          jwts: body.jwts,
          providers: body.providers,
          pkOps: body.pkOps || [],
          merklePaths: body.merklePaths || [],
          leafIndices: body.leafIndices || [],
          root: body.root || "",
          anchor: body.anchor || [],
          hSignUserOp: body.hSignUserOp || "",
          counter: body.counter || "0",
          random: body.random || "",
        });
        writeJson(res, 200, result);
      } catch (error) {
        writeError(res, 400, "recovery_failed", error.message);
      }
      return;
    }

    if (url.pathname === "/v1/merkle/root") {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const merkleInfo = services.zkpasskeyService.getMerkleRoot();
      writeJson(res, 200, merkleInfo);
      return;
    }

    if (url.pathname.startsWith("/v1/merkle/path/")) {
      if (req.method !== "GET") {
        writeMethodNotAllowed(res);
        return;
      }
      const leafIndex = parseInt(url.pathname.split("/").pop(), 10);
      if (isNaN(leafIndex) || leafIndex < 0) {
        writeError(res, 400, "invalid_request", "leafIndex must be a non-negative integer");
        return;
      }
      const proof = services.zkpasskeyService.getMerklePath(leafIndex);
      writeJson(res, 200, proof);
      return;
    }

    writeNotFound(res);
  };
}
