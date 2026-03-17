import { fakeTxHash, randomId } from "../lib/ids.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LocalChainService {
  constructor({ store, profileService }) {
    this.store = store;
    this.profileService = profileService;
  }

  async broadcastTransfer({ requestId, executionPlan, proofResult }) {
    await sleep(80);
    const txHash = fakeTxHash();
    const transaction = {
      txHash,
      blockNumber: Math.floor(Date.now() / 1000),
      requestId,
      network: executionPlan.network,
      tokenType: executionPlan.tokenType,
      tokenAddress: executionPlan.tokenAddress,
      tokenId: executionPlan.tokenId,
      from: executionPlan.custodyWalletAddress,
      to: executionPlan.receiverWalletAddress,
      senderWalletAddress: executionPlan.senderWalletAddress,
      amountPublicIn: executionPlan.amountPublicIn,
      amountPrivateIn: executionPlan.amountPrivateIn,
      amountToPublic: executionPlan.amountToPublic,
      amountToPrivate: executionPlan.amountToPrivate,
      proofId: proofResult.proofId,
      proofStatus: proofResult.proofStatus,
      proofSummary: proofResult.proofSummary,
      status: "confirmed",
      localChainId: randomId("localchain"),
      createdAt: new Date().toISOString()
    };
    await this.store.createTransaction(transaction);
    if (this.profileService) {
      await this.profileService.recordTransfer({
        ...executionPlan,
        receiverName: executionPlan.receiverName,
        userId: executionPlan.userId
      });
    }
    return {
      txHash,
      chainStatus: "broadcasted",
      transaction
    };
  }
}
