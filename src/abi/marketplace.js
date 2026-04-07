/** Marketplace contract ABI from Tempo Mainnet */
export const MARKETPLACE_ABI = [
  { "name": "listNFT", "type": "function", "stateMutability": "nonpayable", "inputs": [{ "type": "address" }, { "type": "uint256" }, { "type": "uint256" }], "outputs": [] },
  { "name": "buyNFT", "type": "function", "stateMutability": "nonpayable", "inputs": [{ "type": "uint256" }], "outputs": [] },
  { "name": "cancelListing", "type": "function", "stateMutability": "nonpayable", "inputs": [{ "type": "uint256" }], "outputs": [] },
  { "name": "updatePrice", "type": "function", "stateMutability": "nonpayable", "inputs": [{ "type": "uint256" }, { "type": "uint256" }], "outputs": [] },
  { "name": "getListing", "type": "function", "stateMutability": "view", "inputs": [{ "type": "uint256" }], "outputs": [] },
  { "name": "listings", "type": "function", "stateMutability": "view", "inputs": [{ "type": "uint256" }], "outputs": [] },
  { "name": "totalListings", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint256" }] },
  // Events
  { "name": "NFTListed", "type": "event", "anonymous": false, "inputs": [{ "indexed": true, "name": "seller", "type": "address" }, { "indexed": true, "name": "nftAddress", "type": "address" }, { "indexed": true, "name": "tokenId", "type": "uint256" }, { "name": "price", "type": "uint256" }, { "name": "listingId", "type": "uint256" }] },
  { "name": "NFTSold", "type": "event", "anonymous": false, "inputs": [{ "indexed": true, "name": "buyer", "type": "address" }, { "indexed": true, "name": "nftAddress", "type": "address" }, { "indexed": true, "name": "tokenId", "type": "uint256" }, { "name": "price", "type": "uint256" }, { "name": "listingId", "type": "uint256" }] }
];

/** Standard ERC721 (NFT) ABI for approvals and checking ownership */
export const ERC721_ABI = [
  { "inputs": [{ "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }], "name": "approve", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "tokenId", "type": "uint256" }], "name": "ownerOf", "outputs": [{ "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalSupply", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

/** Standard ERC20 (pathUSD) ABI for spending/approvals */
export const ERC20_ABI = [
  { "inputs": [{ "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }
];
