/**
 * Request validator tests
 *
 * Tests validation of incoming zkTransfer request payloads.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { validateZkTransferRequest } from "../src/services/requestValidator.js";

const VALID_CONFIG = {
  supportedNetworks: ["ethereum", "kaia", "sepolia"],
  supportedTokenTypes: ["ERC20", "ERC721", "ERC1155"],
};

const VALID_BODY = {
  network: "ethereum",
  tokenType: "ERC20",
  tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  senderWalletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  receiverWalletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  clientRequestId: "req-001",
};

test("validateZkTransferRequest accepts valid ERC20 request", () => {
  const result = validateZkTransferRequest(VALID_BODY, VALID_CONFIG);
  assert.deepEqual(result, { ok: true });
});

test("validateZkTransferRequest rejects missing required fields", () => {
  for (const field of [
    "network",
    "tokenType",
    "tokenAddress",
    "senderWalletAddress",
    "receiverWalletAddress",
    "clientRequestId",
  ]) {
    const body = { ...VALID_BODY };
    delete body[field];
    const result = validateZkTransferRequest(body, VALID_CONFIG);
    assert.equal(result.ok, false, `Should reject missing ${field}`);
    assert.ok(result.message.includes(field));
  }
});

test("validateZkTransferRequest rejects unsupported network", () => {
  const body = { ...VALID_BODY, network: "bitcoin" };
  const result = validateZkTransferRequest(body, VALID_CONFIG);
  assert.equal(result.ok, false);
  assert.ok(result.message.includes("unsupported network"));
});

test("validateZkTransferRequest rejects unsupported token type", () => {
  const body = { ...VALID_BODY, tokenType: "ERC404" };
  const result = validateZkTransferRequest(body, VALID_CONFIG);
  assert.equal(result.ok, false);
  assert.ok(result.message.includes("unsupported token type"));
});

test("validateZkTransferRequest requires tokenId for ERC721", () => {
  const body = { ...VALID_BODY, tokenType: "ERC721" };
  const result = validateZkTransferRequest(body, VALID_CONFIG);
  assert.equal(result.ok, false);
  assert.ok(result.message.includes("tokenId"));
});

test("validateZkTransferRequest requires tokenId for ERC1155", () => {
  const body = { ...VALID_BODY, tokenType: "ERC1155" };
  const result = validateZkTransferRequest(body, VALID_CONFIG);
  assert.equal(result.ok, false);
  assert.ok(result.message.includes("tokenId"));
});

test("validateZkTransferRequest accepts ERC721 with tokenId", () => {
  const body = { ...VALID_BODY, tokenType: "ERC721", tokenId: "42" };
  const result = validateZkTransferRequest(body, VALID_CONFIG);
  assert.deepEqual(result, { ok: true });
});

test("validateZkTransferRequest accepts ERC1155 with tokenId", () => {
  const body = { ...VALID_BODY, tokenType: "ERC1155", tokenId: "7" };
  const result = validateZkTransferRequest(body, VALID_CONFIG);
  assert.deepEqual(result, { ok: true });
});

test("validateZkTransferRequest does not require tokenId for ERC20", () => {
  const body = { ...VALID_BODY, tokenType: "ERC20" };
  // Explicitly no tokenId
  delete body.tokenId;
  const result = validateZkTransferRequest(body, VALID_CONFIG);
  assert.deepEqual(result, { ok: true });
});
