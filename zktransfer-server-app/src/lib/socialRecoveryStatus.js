import { getSupportedProviders } from "./oidc.js";

export function buildSocialRecoveryStatus({ config, zkpasskeyStatus, zkParams }) {
  const supportedProviderCount = getSupportedProviders().length;
  const socialRecoveryChecks = {
    zkpasskeyNapiAvailable: Boolean(zkpasskeyStatus.napiAvailable),
    zkpasskeyRelayerConfigured: config.zkpasskeyRelayerConfigured,
    zkpasskeyPkExists: config.zkpasskeyPkExists,
    zkpasskeyRecoveryFundingConfigured: config.zkpasskeyRecoveryFundingConfigured,
  };

  return {
    socialRecoveryReady: Object.values(socialRecoveryChecks).every(Boolean),
    socialRecoveryChecks,
    socialRecoveryThreshold: {
      n: zkParams.n,
      k: zkParams.k,
      supportedProviderCount,
    },
  };
}
