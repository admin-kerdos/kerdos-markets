import { NextResponse } from "next/server";

import { createChallenge } from "@/lib/auth/challenges";
import { maskPublicKey, type WalletProvider } from "@/lib/auth/store";

type ChallengeBody = {
  publicKey?: string;
  walletType?: WalletProvider;
};

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ChallengeBody;
    const publicKey = payload.publicKey?.trim();
    const walletType = payload.walletType;

    if (!publicKey || !walletType) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400, headers: noStoreHeaders });
    }

    const record = createChallenge(publicKey, walletType);
    console.info("[siws] Reto emitido", maskPublicKey(publicKey));

    return NextResponse.json(
      {
        nonce: record.nonce,
        challenge: record.challenge,
        expiresAt: record.expiresAt
      },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error) {
    return NextResponse.json({ error: "No se pudo generar el reto" }, { status: 500, headers: noStoreHeaders });
  }
}
