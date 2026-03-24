import { runSocialRecoveryLocalDemo } from "../integration/socialRecoveryHarness.mjs";

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const keepDataFile = args.includes("--keep-data-file");

const demo = await runSocialRecoveryLocalDemo({
  keepDataFile,
});

const payload = {
  environment: demo.environment,
  bootstrap: {
    network: demo.bootstrap.network,
    entryPointAddress: demo.bootstrap.entryPointAddress,
    merkleTreeAddress: demo.bootstrap.merkleTreeAddress,
    factoryAddress: demo.bootstrap.factoryAddress,
    verifierLogicAddress: demo.bootstrap.verifierLogicAddress,
  },
  result: demo.result,
};

if (jsonOnly) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("[social-recovery-local-demo] completed");
  console.log(`rpcUrl: ${payload.environment.rpcUrl}`);
  console.log(`jwksBaseUrl: ${payload.environment.jwksBaseUrl}`);
  console.log(`serverBaseUrl: ${payload.environment.serverBaseUrl}`);
  console.log(`recoveryFundingWei: ${payload.environment.recoveryFundingWei}`);
  console.log(`dataFile: ${keepDataFile ? payload.environment.dataFile : "(deleted after run)"}`);
  console.log(`create zkAccount: ${payload.result.create.chainAccount?.zkAccountAddress}`);
  console.log(`challenge nonce: ${payload.result.challenge.nonce}`);
  console.log(`submit txHash: ${payload.result.submit.transactionHash}`);
}
