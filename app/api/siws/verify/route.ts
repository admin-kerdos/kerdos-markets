import { NextResponse } from "next/server";
import { Auth } from "@auth/core";

import { getChallenge } from "@/lib/auth/challenges";
import type { WalletProvider } from "@/lib/auth/store";
import { maskPublicKey } from "@/lib/auth/store";
import { authConfig } from "../../../../auth";

type VerifyBody = {
  publicKey?: string;
  signature?: string;
  nonce?: string;
  walletType?: WalletProvider;
  redirectTo?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as VerifyBody;
    const publicKey = payload.publicKey?.trim();
    const signature = payload.signature;
    const nonce = payload.nonce;
    const walletType = payload.walletType;

    if (!publicKey || !signature || !nonce || !walletType) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400, headers: noStore });
    }

    const storedChallenge = getChallenge(nonce);
    if (!storedChallenge || storedChallenge.publicKey !== publicKey || storedChallenge.walletType !== walletType) {
      return NextResponse.json({ error: "Reto caducado o inválido" }, { status: 400, headers: noStore });
    }

    const callbackUrl = new URL("/api/auth/callback/solana", request.url);
    const authRequest = new Request(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Return-Redirect": "1"
      },
      body: JSON.stringify({
        publicKey,
        signature,
        nonce,
        walletType,
        callbackUrl: payload.redirectTo ?? "\/"
      })
    });

    const authResponse = await Auth(authRequest, authConfig);
    const result = await readableJson(authResponse);
    const response = new NextResponse(JSON.stringify(result ?? { ok: authResponse.ok }), {
      status: authResponse.status,
      headers: {
        "Content-Type": "application/json",
        ...noStore
      }
    });

    const setCookie = authResponse.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("Set-Cookie", setCookie);
    }

    if (authResponse.ok) {
      console.info("[siws] Sesión creada", maskPublicKey(publicKey));
    }

    return response;
  } catch (error) {
    return NextResponse.json({ error: "No se pudo verificar la firma" }, { status: 500, headers: noStore });
  }
}

const noStore = {
  "Cache-Control": "no-store"
};

async function readableJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}
