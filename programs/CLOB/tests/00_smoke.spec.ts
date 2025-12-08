import anchorPkg from "@coral-xyz/anchor";
import { describe, it, expect } from "vitest";

const anchor = anchorPkg as typeof import("@coral-xyz/anchor");

describe("setup", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("provider and workspace are ready", async () => {
    const { blockhash } = await provider.connection.getLatestBlockhash();
    expect(blockhash.length).toBeGreaterThan(0);
    const program = (anchor.workspace as any).kerdos_markets;
    expect(program).toBeDefined();
  });
});
