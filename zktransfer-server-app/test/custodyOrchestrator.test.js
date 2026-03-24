import test from "node:test";
import assert from "node:assert/strict";
import { CustodyOrchestrator } from "../src/services/custodyOrchestrator.js";

function createConfig(overrides = {}) {
  return {
    custodyMode: "hot-wallet",
    executionMode: "mock-chain",
    allowLegacyProofInputs: true,
    circuitsRoot: "/tmp/zk-wallet-circuits",
    proofBinaryPath: "/tmp/zk-wallet-circuits/target/release/prove_zkwallet_from_input",
    proofInputBuilderPath: "/tmp/zk-wallet-circuits/target/release/build_zkwallet_demo_input",
    proofSetupMode: "fresh",
    proofCrsPath: "/tmp/mobile/crs/CRS_pvk.dat",
    proofTreeHeight: 11,
    proofTimeoutMs: 120000,
    hotWalletAddress: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    ...overrides
  };
}

function createExecutionPlan(overrides = {}) {
  return {
    requestId: "req_poseidon2_contract",
    userId: "user:1",
    custodyMode: "hot-wallet",
    executionMode: "mock-chain",
    network: "hardhat-local",
    tokenType: "ERC20",
    tokenAddress: "0x0000000000000000000000000000000000001000",
    tokenId: null,
    custodyWalletAddress: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    receiverWalletAddress: "0x0000000000000000000000000000000000002000",
    receiverName: "Receiver",
    senderWalletAddress: "0x0000000000000000000000000000000000003000",
    amountPublicIn: "0",
    amountPrivateIn: "100",
    amountToPublic: "0",
    amountToPrivate: "100",
    inputNoteRef: null,
    proofBackend: "zk-wallet-circuits",
    chainBackend: "hardhat-local adapter placeholder",
    ...overrides
  };
}

function createBuilderOutput(requestId = "req_poseidon2_contract") {
  const input = {
    statement: {
      rt: "0xroot",
      sn: "0xnullifier",
      cm_: "0xcommitment"
    },
    witnesses: {
      tree_proof: [
        "0xlevel0sibling0",
        "0xlevel0sibling1",
        "0xlevel0sibling2",
        "0xlevel0sibling3",
        "0xlevel1sibling0",
        "0xlevel1sibling1",
        "0xlevel1sibling2",
        "0xlevel1sibling3"
      ],
      dv: "0x64",
      dv_: "0x64"
    }
  };

  return {
    request_id: requestId,
    tree_height: 11,
    input_json: JSON.stringify(input)
  };
}

function createOrchestrator({ execFileRunner, configOverrides } = {}) {
  const logger = {
    warn() {}
  };
  return new CustodyOrchestrator({
    config: createConfig(configOverrides),
    store: {},
    localChainService: {},
    execFileRunner,
    logger
  });
}

test("buildProofInput preserves flattened 4-ary witness contract", async () => {
  const calls = [];
  const builderOutput = createBuilderOutput();
  const orchestrator = createOrchestrator({
    execFileRunner: async (file, args, options) => {
      calls.push({ file, args, options });
      return {
        stdout: `builder completed\n${JSON.stringify(builderOutput)}`
      };
    }
  });

  const proofInput = await orchestrator.buildProofInput(createExecutionPlan());
  const parsedInput = JSON.parse(proofInput.input_json);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, orchestrator.config.proofInputBuilderPath);
  assert.deepEqual(calls[0].options, {
    cwd: orchestrator.config.circuitsRoot,
    timeout: orchestrator.config.proofTimeoutMs,
    maxBuffer: 8 * 1024 * 1024
  });
  assert.deepEqual(calls[0].args, [
    "--request-id",
    "req_poseidon2_contract",
    "--tree-height",
    "11",
    "--token-address",
    "0x0000000000000000000000000000000000001000",
    "--token-id",
    "0",
    "--public-in",
    "0",
    "--public-out",
    "0",
    "--private-in",
    "100",
    "--private-out",
    "100"
  ]);
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsedInput.witnesses, "leaf_pos"),
    false
  );
  const telemetry = orchestrator.getProofInputTelemetry();
  assert.equal(telemetry.totalProofInputs, 1);
  assert.equal(telemetry.legacyLeafPosInputs, 0);
  assert.equal(telemetry.flattenedFourAryInputs, 1);
  assert.equal(telemetry.lastInputContract, "flattened-4-ary");
  assert.equal(telemetry.lastTreeProofLength, 8);
  assert.ok(telemetry.lastInputAnalyzedAt);
  assert.equal(telemetry.lastLegacyLeafPosDetectedAt, null);
  assert.equal(telemetry.legacyLeafPosWarningEmitted, false);
  assert.ok(Array.isArray(parsedInput.witnesses.tree_proof));
  assert.ok(parsedInput.witnesses.tree_proof.length >= 4);
  assert.equal((parsedInput.witnesses.tree_proof.length - 4) % 4, 0);
});

test("generateProof keeps builder input_json and prover summary fields", async () => {
  const calls = [];
  const builderOutput = createBuilderOutput();
  const orchestrator = createOrchestrator({
    configOverrides: {
      proofSetupMode: "crs"
    },
    execFileRunner: async (file, args, options) => {
      calls.push({ file, args, options });
      if (file === orchestrator.config.proofInputBuilderPath) {
        return {
          stdout: `builder completed\n${JSON.stringify(builderOutput)}`
        };
      }

      assert.equal(file, orchestrator.config.proofBinaryPath);
      assert.deepEqual(args, [
        "--request-id",
        "req_poseidon2_contract",
        "--input-json",
        builderOutput.input_json,
        "--crs-path",
        orchestrator.config.proofCrsPath
      ]);
      return {
        stdout: [
          "proof completed",
          JSON.stringify({
            verified: true,
            setup_source: "crs",
            proof_generation_seconds: 0.6387,
            verification_seconds: 0.0039
          })
        ].join("\n")
      };
    }
  });

  const proofResult = await orchestrator.generateProof(createExecutionPlan());

  assert.equal(calls.length, 2);
  assert.equal(proofResult.proofStatus, "verified");
  assert.match(proofResult.proofId, /^proof_[0-9a-f]{16}$/);
  assert.deepEqual(proofResult.proofSummary, {
    backend: "zk-wallet-circuits",
    tokenType: "ERC20",
    custodyMode: "hot-wallet",
    inputSource: "server-built-circuit-input",
    setupSource: "crs",
    proofGenerationSeconds: 0.6387,
    verificationSeconds: 0.0039,
    treeHeight: 11,
    inputContract: "flattened-4-ary"
  });
  assert.equal(proofResult.proofArtifact.verified, true);
  assert.equal(proofResult.proofArtifact.setup_source, "crs");
  assert.equal(proofResult.proofArtifact.input_json, builderOutput.input_json);
});

test("buildProofInput tracks legacy leaf_pos witness usage", async () => {
  const legacyBuilderOutput = createBuilderOutput("req_legacy_leaf_pos");
  const legacyInput = JSON.parse(legacyBuilderOutput.input_json);
  legacyInput.witnesses.leaf_pos = "0";
  legacyBuilderOutput.input_json = JSON.stringify(legacyInput);
  const warnings = [];

  const orchestrator = createOrchestrator({
    execFileRunner: async () => ({
      stdout: `builder completed\n${JSON.stringify(legacyBuilderOutput)}`
    })
  });
  orchestrator.logger.warn = (message) => warnings.push(message);

  await orchestrator.buildProofInput(
    createExecutionPlan({ requestId: "req_legacy_leaf_pos" })
  );

  const telemetry = orchestrator.getProofInputTelemetry();
  assert.equal(telemetry.totalProofInputs, 1);
  assert.equal(telemetry.legacyLeafPosInputs, 1);
  assert.equal(telemetry.flattenedFourAryInputs, 1);
  assert.equal(telemetry.lastInputContract, "legacy-leaf-pos");
  assert.equal(telemetry.lastTreeProofLength, 8);
  assert.ok(telemetry.lastInputAnalyzedAt);
  assert.ok(telemetry.lastLegacyLeafPosDetectedAt);
  assert.equal(telemetry.legacyLeafPosWarningEmitted, true);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /legacy proof input with leaf_pos/);
});

test("buildProofInput rejects legacy leaf_pos witness when policy disables it", async () => {
  const legacyBuilderOutput = createBuilderOutput("req_reject_legacy_leaf_pos");
  const legacyInput = JSON.parse(legacyBuilderOutput.input_json);
  legacyInput.witnesses.leaf_pos = "0";
  legacyBuilderOutput.input_json = JSON.stringify(legacyInput);

  const orchestrator = createOrchestrator({
    configOverrides: {
      allowLegacyProofInputs: false
    },
    execFileRunner: async () => ({
      stdout: `builder completed\n${JSON.stringify(legacyBuilderOutput)}`
    })
  });

  await assert.rejects(
    () =>
      orchestrator.buildProofInput(
        createExecutionPlan({ requestId: "req_reject_legacy_leaf_pos" })
      ),
    /ALLOW_LEGACY_PROOF_INPUTS=0/
  );
});
