import { loadConfig } from "../src/config.js";
import { buildSocialRecoveryStatus } from "../src/lib/socialRecoveryStatus.js";
import { ZkPasskeyService } from "../src/services/zkpasskeyService.js";

const config = loadConfig();
const zkpasskeyService = new ZkPasskeyService({ config, store: {} });
const socialRecoveryStatus = buildSocialRecoveryStatus({
  config,
  zkpasskeyStatus: zkpasskeyService.getStatus(),
  zkParams: zkpasskeyService.getZkParameters(),
});
const checks = {
  proofBinaryExists: config.proofBinaryExists,
  proofInputBuilderExists: config.proofInputBuilderExists,
  jwtSecretConfigured: config.jwtSecretConfigured,
  proofInputPolicyPinned: config.proofInputPolicyPinned
};
const ready = Object.values(checks).every(Boolean);

console.log(
  JSON.stringify(
    {
      app: config.appName,
      ready,
      jwtSecretConfigured: config.jwtSecretConfigured,
      usingDefaultJwtSecret: config.usingDefaultJwtSecret,
      usingPlaceholderJwtSecret: config.usingPlaceholderJwtSecret,
      allowLegacyProofInputs: config.allowLegacyProofInputs,
      proofInputPolicyPinned: config.proofInputPolicyPinned,
      zkpasskeyRelayerConfigured: config.zkpasskeyRelayerConfigured,
      zkpasskeyRecoveryFundingConfigured:
        config.zkpasskeyRecoveryFundingConfigured,
      zkpasskeyPkExists: config.zkpasskeyPkExists,
      socialRecoveryReady: socialRecoveryStatus.socialRecoveryReady,
      socialRecoveryChecks: socialRecoveryStatus.socialRecoveryChecks,
      socialRecoveryThreshold: socialRecoveryStatus.socialRecoveryThreshold,
      checks
    },
    null,
    2
  )
);

if (!ready) {
  process.exit(1);
}
