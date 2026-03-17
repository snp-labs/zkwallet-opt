const REQUIRED_FIELDS = [
  "network",
  "tokenType",
  "tokenAddress",
  "senderWalletAddress",
  "receiverWalletAddress",
  "clientRequestId"
];

export function validateZkTransferRequest(body, config) {
  const missing = REQUIRED_FIELDS.filter((field) => !body[field]);
  if (missing.length > 0) {
    return { ok: false, message: `missing required fields: ${missing.join(", ")}` };
  }

  if (!config.supportedNetworks.includes(body.network)) {
    return { ok: false, message: `unsupported network: ${body.network}` };
  }

  if (!config.supportedTokenTypes.includes(body.tokenType)) {
    return { ok: false, message: `unsupported token type: ${body.tokenType}` };
  }

  if (body.tokenType !== "ERC20" && (body.tokenId === undefined || body.tokenId === null)) {
    return { ok: false, message: "tokenId is required for ERC721 and ERC1155" };
  }

  return { ok: true };
}
