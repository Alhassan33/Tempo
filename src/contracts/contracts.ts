// ─── Contract Address ──────────────────────────────────────────────────────────
export const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b" as const;

// ─── Full ABI (reconstructed from TempoMarketplace.sol) ───────────────────────
export const MARKETPLACE_ABI = [
  // ── Read functions ──
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "seller",      type: "address" },
          { name: "nftContract", type: "address" },
          { name: "tokenId",     type: "uint256" },
          { name: "price",       type: "uint256" },
          { name: "active",      type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "listings",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "seller",      type: "address" },
      { name: "nftContract", type: "address" },
      { name: "tokenId",     type: "uint256" },
      { name: "price",       type: "uint256" },
      { name: "active",      type: "bool"    },
    ],
  },
  {
    type: "function",
    name: "totalListings",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "pathUSD",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "feeBasisPoints",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "feeRecipient",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "MAX_FEE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },

  // ── Write functions ──
  {
    type: "function",
    name: "listNFT",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId",     type: "uint256" },
      { name: "price",       type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "buyNFT",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelListing",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "updatePrice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "newPrice",  type: "uint256" },
    ],
    outputs: [],
  },

  // ── Owner-only ──
  {
    type: "function",
    name: "setFeeBasisPoints",
    stateMutability: "nonpayable",
    inputs: [{ name: "_bps", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setFeeRecipient",
    stateMutability: "nonpayable",
    inputs: [{ name: "_recipient", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setPaymentToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "_token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "unpause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },

  // ── Events ──
  {
    type: "event",
    name: "Listed",
    inputs: [
      { name: "listingId",   type: "uint256", indexed: true  },
      { name: "seller",      type: "address", indexed: true  },
      { name: "nftContract", type: "address", indexed: true  },
      { name: "tokenId",     type: "uint256", indexed: false },
      { name: "price",       type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Sale",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true  },
      { name: "buyer",     type: "address", indexed: true  },
      { name: "price",     type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PriceUpdated",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true  },
      { name: "newPrice",  type: "uint256", indexed: false },
    ],
  },
] as const;

// ─── Minimal ERC-20 ABI (for pathUSD approve + allowance) ─────────────────────
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// ─── Minimal ERC-721 ABI (for approve before listing) ─────────────────────────
export const ERC721_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",      type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool"    },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner",    type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getApproved",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
