import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fakeTxHash, randomId } from "../lib/ids.js";

const execFileAsync = promisify(execFile);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTokenId(request) {
  if (request.tokenType === "ERC20") {
    return null;
  }
  return request.tokenId ?? null;
}

export class CustodyOrchestrator {
  constructor({
    config,
    store,
    localChainService,
    execFileRunner = execFileAsync,
    logger = console
  }) {
    this.config = config;
    this.store = store;
    this.localChainService = localChainService;
    this.execFileRunner = execFileRunner;
    this.logger = logger;
    this.proofInputTelemetry = createProofInputTelemetry();
  }

  async enqueue(requestRecord) {
    queueMicrotask(() => {
      this.processRequest(requestRecord.requestId).catch(async (error) => {
        await this.store.updateRequest(requestRecord.requestId, {
          status: "failed",
          errorCode: "processing_failed",
          errorMessage: error.message
        });
      });
    });
  }

  async processRequest(requestId) {
    const request = await this.store.getRequest(requestId);
    if (!request) {
      return;
    }

    await this.store.updateRequest(requestId, {
      status: "validating"
    });
    const executionPlan = await this.resolveExecutionPlan(request);

    await this.store.updateRequest(requestId, {
      status: "proving",
      executionPlan
    });
    const proofResult = await this.generateProof(executionPlan);

    await this.store.updateRequest(requestId, {
      status: "broadcasting",
      proofStatus: proofResult.proofStatus,
      proofId: proofResult.proofId,
      proofSummary: proofResult.proofSummary,
      proofArtifact: proofResult.proofArtifact
    });
    const chainResult = await this.broadcastTransaction(executionPlan, proofResult);

    await this.store.updateRequest(requestId, {
      status: "confirmed",
      txHash: chainResult.txHash,
      chainStatus: chainResult.chainStatus,
      chainTransaction: chainResult.transaction,
      custodyWalletAddress: executionPlan.custodyWalletAddress,
      completedAt: new Date().toISOString()
    });
  }

  async resolveExecutionPlan(request) {
    await sleep(30);
    return {
      requestId: request.requestId,
      userId: request.userId,
      custodyMode: this.config.custodyMode,
      executionMode: this.config.executionMode,
      network: request.network,
      tokenType: request.tokenType,
      tokenAddress: request.tokenAddress,
      tokenId: normalizeTokenId(request),
      custodyWalletAddress: this.config.hotWalletAddress,
      receiverWalletAddress: request.receiverWalletAddress,
      receiverName: request.receiverName || null,
      senderWalletAddress: request.senderWalletAddress,
      amountPublicIn: request.amountPublicIn || "0",
      amountPrivateIn: request.amountPrivateIn || "0",
      amountToPublic: request.amountToPublic || "0",
      amountToPrivate: request.amountToPrivate || "0",
      inputNoteRef: request.inputNoteRef || null,
      proofBackend: "zk-wallet-circuits",
      chainBackend:
        request.network === "hardhat-local" ? "hardhat-local adapter placeholder" : "kaia-testnet adapter placeholder"
    };
  }

  async generateProof(executionPlan) {
    const proofInput = await this.buildProofInput(executionPlan);
    const inputContract = this.getProofInputTelemetry().lastInputContract;
    const args = [
      "--request-id",
      executionPlan.requestId,
      "--input-json",
      proofInput.input_json
    ];

    if (this.config.proofSetupMode === "crs") {
      args.push("--crs-path", this.config.proofCrsPath);
    }

    const { stdout } = await this.execFileRunner(this.config.proofBinaryPath, args, {
      cwd: this.config.circuitsRoot,
      timeout: this.config.proofTimeoutMs,
      maxBuffer: 8 * 1024 * 1024
    });
    const proofExecution = parseProofOutput(stdout);
    if (!proofExecution.verified) {
      throw new Error(
        `proof verification failed in ${proofExecution.setup_source}`
      );
    }

    return {
      proofStatus: proofExecution.verified ? "verified" : "failed",
      proofId: randomId("proof"),
      proofSummary: {
        backend: executionPlan.proofBackend,
        tokenType: executionPlan.tokenType,
        custodyMode: executionPlan.custodyMode,
        inputSource: "server-built-circuit-input",
        setupSource: proofExecution.setup_source,
        proofGenerationSeconds: proofExecution.proof_generation_seconds,
        verificationSeconds: proofExecution.verification_seconds,
        treeHeight: this.config.proofTreeHeight,
        inputContract
      },
      proofArtifact: {
        ...proofExecution,
        input_json: proofInput.input_json
      }
    };
  }

  async buildProofInput(executionPlan) {
    const args = [
      "--request-id",
      executionPlan.requestId,
      "--tree-height",
      String(this.config.proofTreeHeight),
      "--token-address",
      executionPlan.tokenAddress,
      "--token-id",
      String(executionPlan.tokenId ?? 0),
      "--public-in",
      String(executionPlan.amountPublicIn ?? "0"),
      "--public-out",
      String(executionPlan.amountToPublic ?? "0"),
      "--private-in",
      String(executionPlan.amountPrivateIn ?? "0"),
      "--private-out",
      String(executionPlan.amountToPrivate ?? "0")
    ];
    const { stdout } = await this.execFileRunner(this.config.proofInputBuilderPath, args, {
      cwd: this.config.circuitsRoot,
      timeout: this.config.proofTimeoutMs,
      maxBuffer: 8 * 1024 * 1024
    });
    const proofInput = parseProofOutput(stdout);
    const analysis = this.recordProofInputTelemetry(proofInput.input_json);
    this.enforceProofInputPolicy(analysis);
    return proofInput;
  }

  recordProofInputTelemetry(inputJson) {
    const analysis = analyzeProofInputContract(inputJson);
    this.proofInputTelemetry.totalProofInputs += 1;
    if (analysis.legacyLeafPosDetected) {
      this.proofInputTelemetry.legacyLeafPosInputs += 1;
      this.proofInputTelemetry.lastLegacyLeafPosDetectedAt = new Date().toISOString();
      if (!this.proofInputTelemetry.legacyLeafPosWarningEmitted) {
        this.logger.warn(
          `[zktransfer-server-app] observed legacy proof input with leaf_pos; standard builder outputs should use flattened 4-ary tree_proof only.`
        );
        this.proofInputTelemetry.legacyLeafPosWarningEmitted = true;
      }
    }
    if (analysis.flattenedFourAryTreeProofDetected) {
      this.proofInputTelemetry.flattenedFourAryInputs += 1;
    }
    this.proofInputTelemetry.lastInputContract = analysis.inputContract;
    this.proofInputTelemetry.lastTreeProofLength = analysis.treeProofLength;
    this.proofInputTelemetry.lastInputAnalyzedAt = new Date().toISOString();
    return analysis;
  }

  getProofInputTelemetry() {
    return { ...this.proofInputTelemetry };
  }

  enforceProofInputPolicy(analysis) {
    if (analysis.legacyLeafPosDetected && !this.config.allowLegacyProofInputs) {
      throw new Error(
        "legacy proof input contract with leaf_pos is disabled by ALLOW_LEGACY_PROOF_INPUTS=0"
      );
    }
  }

  async broadcastTransaction(executionPlan, proofResult) {
    if (this.config.executionMode === "mock-chain" || this.config.executionMode === "hardhat-local") {
      return this.localChainService.broadcastTransfer({
        requestId: executionPlan.requestId,
        executionPlan,
        proofResult
      });
    }
    await sleep(120);
    return {
      txHash: fakeTxHash(),
      chainStatus: "broadcasted",
      executionMode: executionPlan.executionMode,
      proofId: proofResult.proofId,
      transaction: null
    };
  }
}

function parseProofOutput(stdout) {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("proof output did not contain JSON");
  }
  return JSON.parse(stdout.slice(jsonStart));
}

function createProofInputTelemetry() {
  return {
    totalProofInputs: 0,
    legacyLeafPosInputs: 0,
    flattenedFourAryInputs: 0,
    lastInputContract: "none",
    lastTreeProofLength: 0,
    lastInputAnalyzedAt: null,
    lastLegacyLeafPosDetectedAt: null,
    legacyLeafPosWarningEmitted: false
  };
}

function analyzeProofInputContract(inputJson) {
  try {
    const parsed = JSON.parse(inputJson);
    const witnesses = parsed?.witnesses ?? {};
    const treeProof = Array.isArray(witnesses.tree_proof) ? witnesses.tree_proof : [];
    const legacyLeafPosDetected = Object.prototype.hasOwnProperty.call(witnesses, "leaf_pos");
    const flattenedFourAryTreeProofDetected =
      treeProof.length >= 4 && (treeProof.length - 4) % 4 === 0;

    let inputContract = "unknown";
    if (legacyLeafPosDetected) {
      inputContract = "legacy-leaf-pos";
    } else if (flattenedFourAryTreeProofDetected) {
      inputContract = "flattened-4-ary";
    }

    return {
      inputContract,
      legacyLeafPosDetected,
      flattenedFourAryTreeProofDetected,
      treeProofLength: treeProof.length
    };
  } catch {
    return {
      inputContract: "unparseable",
      legacyLeafPosDetected: false,
      flattenedFourAryTreeProofDetected: false,
      treeProofLength: 0
    };
  }
}
