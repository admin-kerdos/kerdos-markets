import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

export type SignatureVerification = { ok: true } | { ok: false; error: "invalid_input" | "invalid_signature" };

export function verifySignature(message: string, signatureBase64: string, publicKeyBase58: string): SignatureVerification {
  try {
    if (!message || !signatureBase64 || !publicKeyBase58) {
      return { ok: false, error: "invalid_input" };
    }

    const signature = Buffer.from(signatureBase64, "base64");
    const messageBytes = new TextEncoder().encode(message);
    const publicKey = new PublicKey(publicKeyBase58);
    const verified = nacl.sign.detached.verify(messageBytes, signature, publicKey.toBytes());
    return verified ? { ok: true } : { ok: false, error: "invalid_signature" };
  } catch (error) {
    return { ok: false, error: "invalid_input" };
  }
}
