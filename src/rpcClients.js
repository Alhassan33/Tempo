import { createPublicClient, createWalletClient, http, custom } from "viem";
import { mainnet } from "viem/chains";

/** Read-only public client */
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

/** Wallet client (browser wallet) */
export function getWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return createWalletClient({
    chain: mainnet,
    transport: custom(window.ethereum),
  });
}
