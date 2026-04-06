export const LAUNCHPAD_ADDRESS = "0x0451929d3c5012978127A2e347d207Aa8b67f14d";

export const LAUNCHPAD_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "name_", "type": "string" },
      { "internalType": "string", "name": "symbol_", "type": "string" },
      { "internalType": "string", "name": "preRevealURI_", "type": "string" },
      { "internalType": "uint256", "name": "maxSupply_", "type": "uint256" },
      { "internalType": "address", "name": "creator_", "type": "address" },
      { "internalType": "address", "name": "pathUSD_", "type": "address" },
      { "internalType": "uint256", "name": "revenueShareBps_", "type": "uint256" },
      { "internalType": "address", "name": "feeRecipient_", "type": "address" }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
