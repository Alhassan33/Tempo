import { useAccount, useDisconnect, useBalance } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  return {
    address,
    isConnected,
    chain,
    balance,
    isConnecting: false,
    connect: openConnectModal,   // opens RainbowKit modal (MetaMask, Phantom, WalletConnect, etc.)
    disconnect,
  };
}
