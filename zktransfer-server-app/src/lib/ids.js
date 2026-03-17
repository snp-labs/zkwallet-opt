import crypto from "node:crypto";

export function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function fakeTxHash() {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}
