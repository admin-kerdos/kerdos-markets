"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { BaseMessageSignerWalletAdapter, WalletReadyState } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import type { WalletProvider as WalletKind } from "@/lib/auth/store";

type Props = {
  children: React.ReactNode;
};

export default function WalletProviders({ children }: Props) {
  const endpoint = useMemo(() => {
    const envEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    return typeof envEndpoint === "string" && envEndpoint.length > 0 ? envEndpoint : clusterApiUrl("devnet");
  }, []);

  const testConfig = useMemo<Partial<Record<WalletKind, number[]>> | null>(() => {
    if (typeof window !== "undefined") {
      const override = (window as unknown as { __KERDOS_TEST_WALLETS__?: Partial<Record<WalletKind, number[]>> }).__KERDOS_TEST_WALLETS__;
      if (override && typeof override === "object") {
        return override;
      }
    }
    const envValue = process.env.NEXT_PUBLIC_TEST_WALLETS;
    if (envValue) {
      try {
        const parsed = JSON.parse(envValue) as Partial<Record<WalletKind, number[]>>;
        return parsed;
      } catch (error) {
        console.warn("No se pudo interpretar NEXT_PUBLIC_TEST_WALLETS", error);
      }
    }
    return null;
  }, []);

  const wallets = useMemo(() => {
    const testAdapters = createTestWalletAdapters(testConfig);
    if (testAdapters.length > 0) {
      return testAdapters;
    }
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({
        network: "mainnet"
      })
    ];
  }, [testConfig]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

type TestWalletConfig = Partial<Record<WalletKind, number[]>>;

function createTestWalletAdapters(config: TestWalletConfig | null) {
  if (!config) return [];
  const adapters = [] as BaseMessageSignerWalletAdapter[];
  if (Array.isArray(config.phantom) && config.phantom.length === 64) {
    adapters.push(new StaticWalletAdapter("Phantom", Uint8Array.from(config.phantom)));
  }
  if (Array.isArray(config.solflare) && config.solflare.length === 64) {
    adapters.push(new StaticWalletAdapter("Solflare", Uint8Array.from(config.solflare)));
  }
  return adapters;
}

class StaticWalletAdapter extends BaseMessageSignerWalletAdapter {
  private keypair: Keypair;
  private connectedKey: PublicKey | null = null;
  private isConnecting = false;

  constructor(private readonly label: string, secretKey: Uint8Array) {
    super();
    this.keypair = Keypair.fromSecretKey(secretKey);
  }

  get name() {
    return this.label;
  }

  get url() {
    return "https://kerdos.markets";
  }

  get icon() {
    return "";
  }

  get readyState(): WalletReadyState {
    return WalletReadyState.Installed;
  }

  get publicKey(): PublicKey | null {
    return this.connectedKey;
  }

  get connecting(): boolean {
    return this.isConnecting;
  }

  get supportedTransactionVersions() {
    return null;
  }

  async connect(): Promise<void> {
    if (this.connectedKey) return;
    this.isConnecting = true;
    this.connectedKey = this.keypair.publicKey;
    this.emit("connect", this.connectedKey);
    this.isConnecting = false;
  }

  async disconnect(): Promise<void> {
    this.connectedKey = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this.connectedKey) throw new Error("Wallet no conectada");
    if (transaction instanceof Transaction) {
      transaction.partialSign(this.keypair);
    } else {
      transaction.sign([this.keypair]);
    }
    return transaction;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)));
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.connectedKey) throw new Error("Wallet no conectada");
    return nacl.sign.detached(message, this.keypair.secretKey);
  }
}
