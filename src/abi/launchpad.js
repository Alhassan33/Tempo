/** Launchpad contract ABI — replace with your actual ABI */
export const launchpadABI = [
  {
    "inputs": [],
    "name": "getDrops",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "dropId", "type": "uint256" },
      { "internalType": "uint256", "name": "quantity", "type": "uint256" }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];
