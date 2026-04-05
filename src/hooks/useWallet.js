import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { injected } from "wagmi/connectors";

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  function connectWallet() {
    connect({ connector: injected() });
  }

  return { address, isConnected, chain, balance, isConnecting, connect: connectWallet, disconnect };
}
