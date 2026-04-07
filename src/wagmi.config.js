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

// ─── Tempo Mainnet ────────────────────────────────────────────────────────────
export const tempoMainnet = defineChain({
  id: 4217,
  name: "Tempo",
  nativeCurrency: {
    name: "USD",
    symbol: "USD",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.tempo.xyz"],
      webSocket: ["wss://rpc.tempo.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Tempo Explorer",
      url: "https://explore.tempo.xyz",
    },
  },
  testnet: false,
});

// ─── WalletConnect Project ID ─────────────────────────────────────────────────
const projectId = "c5c2a8702266143c000e3b6083984ee0";

// ─── Wallet List ──────────────────────────────────────────────────────────────
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

// ─── Wagmi Config ─────────────────────────────────────────────────────────────
export const config = createConfig({
  chains: [tempoMainnet],
  connectors,
  transports: {
    [tempoMainnet.id]: http("https://rpc.tempo.xyz"),
  },
});
