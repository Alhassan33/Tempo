import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';

// This is the ABI for the NFT clones deployed by your factory
const NFT_MINT_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "quantity", "type": "uint256" },
      { "internalType": "string", "name": "phase", "type": "string" } // Added phase support
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export function useMintNFT(contractAddress: string, paymentTokenAddress: string) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // 1. Check Allowance (Does the contract have permission to take PathUSD?)
  // This helps us decide whether to show "Approve" or "Mint" in the UI
  const { data: allowance } = useReadContract({
    address: paymentTokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [/* userAddress */, contractAddress as `0x${string}`],
  });

  const approve = (amount: number) => {
    writeContract({
      address: paymentTokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contractAddress as `0x${string}`, parseUnits(amount.toString(), 18)],
    });
  };

  const mint = (quantity: number, phase: string = "public") => {
    writeContract({
      address: contractAddress as `0x${string}`,
      abi: NFT_MINT_ABI,
      functionName: 'mint',
      args: [BigInt(quantity), phase],
    });
  };

  return { 
    mint, 
    approve, 
    allowance,
    hash, 
    isPending, 
    isConfirming, 
    isSuccess, 
    error 
  };
}
