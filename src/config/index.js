export const APP_NAME = "TEMPONYAN";
export const APP_DESCRIPTION = "NFT Marketplace and Launchpad on Tempo Chain";
export const BASE_URL = import.meta.env.VITE_BASE_URL ?? "";

/** Contract addresses — replace with real deployed addresses */
export const CONTRACTS = {
  marketplace: "0x0000000000000000000000000000000000000000",
  launchpad:   "0x0000000000000000000000000000000000000000",
  nftFactory:  "0x0000000000000000000000000000000000000000",
};

/** Marketplace fee in basis points (250 = 2.5%) */
export const MARKETPLACE_FEE_BPS = 250;

/** API base — Vercel serverless functions */
export const API_BASE = `${BASE_URL}/api`;

/** Supported chain IDs */
export const SUPPORTED_CHAIN_IDS = [1, 11155111]; // mainnet, sepolia
