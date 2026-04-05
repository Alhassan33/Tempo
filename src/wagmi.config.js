import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  phantomWallet,
} from "@rainbow-me/rainbowkit/wallets";

// ─── Tempo Testnet Chain Definition ───────────────────────────────────────────
export const tempoTestnet = defineChain({
  id: 42431,
  name: "Tempo Testnet",
  nativeCurrency: {
    name: "USD",
    symbol: "USD",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.moderato.tempo.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Tempo Explorer",
      url: "https://explorer.moderato.tempo.xyz",
    },
  },
  testnet: true,
});

// ─── WalletConnect Project ID ──────────────────────────────────────────────────
// Get yours free at https://cloud.walletconnect.com
const projectId = "c5c2a8702266143c000e3b6083984ee0";

// ─── Wallet List ───────────────────────────────────────────────────────────────
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, phantomWallet, coinbaseWallet],
    },
    {
      groupName: "More",
      wallets: [rainbowWallet, walletConnectWallet],
    },
  ],
  {
    appName: "TempoNFT",
    appDescription: "NFT Marketplace & Launchpad on Tempo Chain",
    appUrl: "https://temponfts.xyz",
    appIcon: "/logo.png",
    projectId,
  }
);

// ─── Wagmi Config ──────────────────────────────────────────────────────────────
export const config = createConfig({
  chains: [tempoTestnet],
  connectors,
  transports: {
    [tempoTestnet.id]: http("https://rpc.moderato.tempo.xyz"),
  },
});
