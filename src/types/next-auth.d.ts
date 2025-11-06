import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string;
      publicKey?: string;
      walletType?: import("@/lib/auth/store").WalletProvider;
    };
  }

  interface User {
    provider?: string;
    publicKey?: string | null;
    walletType?: import("@/lib/auth/store").WalletProvider | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string | null;
    publicKey?: string | null;
    walletType?: import("@/lib/auth/store").WalletProvider | null;
  }
}
