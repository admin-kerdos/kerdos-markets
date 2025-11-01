/**
 * Copies Anchor IDL into the SDK source tree for browser builds.
 */
import { cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../");
await cp(
  resolve(root, "target/idl/kerdos_markets.json"),
  resolve(root, "packages/kerdos-sdk/src/idl/kerdos_markets.json"),
  { force: true }
);
