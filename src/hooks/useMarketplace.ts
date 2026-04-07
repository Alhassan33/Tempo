import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  useAccount, useChainId, usePublicClient, 
  useWriteContract, useConnect, useDisconnect, useSwitchChain,
} from 'wagmi'
import { parseUnits } from 'viem'
import { injected } from 'wagmi/connectors'
import { MARKETPLACE_ABI, ERC721_ABI, ERC20_ABI } from '../abi/marketplace.js'
import { tempoMainnet } from '../wagmi.config.js'
import { getClients } from '../rpcClients.js'

const TEMPO_CHAIN_IDS = new Set([tempoMainnet.id])

// Cache invalidation for Vercel KV or LocalStorage
function invalidateListingsCache(chainId) {
  fetch(`/api/listings?chainId=${chainId}`, { method: 'DELETE' }).catch(() => {})
  try { localStorage.removeItem(`tempo_listings_${chainId}`) } catch {}
}

export function useMarketplace() {
  const { address: account, isConnected } = useAccount()
  const chainId       = useChainId()
  const publicClient  = usePublicClient()
  
  // ─── CONFIGURATION ────────────────────────────────────────────────────────
  const network = useMemo(() => ({
    marketplace: "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b",
    paymentToken: "0x20c0000000000000000000000000000000000000", // pathUSD
  }), [])

  const clients = useMemo(() => getClients(chainId), [chainId])
  const { connect }     = useConnect()
  const { disconnect }  = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [listings,     setListings]     = useState([])
  const [history,      setHistory]      = useState([])
  const [balance,      setBalance]      = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [txStatus,     setTxStatus]     = useState(null)
  const [activeFilter, setActiveFilter] = useState(null)

  const wrongNetwork = !TEMPO_CHAIN_IDS.has(chainId)
  const status       = (type, msg) => setTxStatus({ type, msg })
  const clearStatus  = () => setTxStatus(null)

  // ─── DATA FETCHING ─────────────────────────────────────────────────────────

  const fetchBalance = useCallback(async () => {
    if (!account || !network.paymentToken) return
    try {
      const bal = await clients.balance.readContract({
        address: network.paymentToken, 
        abi: ERC20_ABI,
        functionName: 'balanceOf', 
        args: [account],
      })
      setBalance(bal.toString())
    } catch (err) { console.error('fetchBalance:', err) }
  }, [clients, account, network])

  const fetchListings = useCallback(async () => {
    if (!network.marketplace) return
    const LS_KEY = `tempo_listings_${chainId}`
    
    try {
      // 1. Get total from contract (Matching your ABI: totalListings)
      const count = await clients.listings.readContract({
        address: network.marketplace, 
        abi: MARKETPLACE_ABI, 
        functionName: 'totalListings',
      })
      
      const total = Number(count)
      if (total === 0) { setListings([]); return }

      // 2. Fetch mapping details: listings(uint256)
      const accumulated = []
      for (let i = 0; i < total; i++) {
        try {
          const l = await clients.listings.readContract({
            address: network.marketplace, 
            abi: MARKETPLACE_ABI, 
            functionName: 'listings', 
            args: [BigInt(i)]
          })
          // ABI Mapping indices: [seller, nftAddr, tokenId, price, isActive]
          if (l && l[4] === true) {
            accumulated.push({
              listingId: i.toString(),
              seller: l[0],
              nftAddress: l[1],
              tokenId: l[2].toString(),
              price: l[3].toString(),
              active: true
            })
          }
        } catch (e) { continue }
      }
      setListings(accumulated)
      localStorage.setItem(LS_KEY, JSON.stringify({ data: accumulated, ts: Date.now() }))
    } catch (err) { console.error('fetchListings:', err) }
  }, [clients, network, chainId])

  // ─── TRANSACTIONS ──────────────────────────────────────────────────────────

  const listNFT = useCallback(async ({ nftContract, tokenId, price }) => {
    if (!account || wrongNetwork) return status('error', 'Check connection/network')
    
    try {
      setLoading(true); clearStatus()
      const priceWei = parseUnits(String(price), 18)

      status('info', 'Step 1/2: Approving NFT...')
      const h1 = await writeContractAsync({
        address: nftContract, abi: ERC721_ABI,
        functionName: 'approve', args: [network.marketplace, BigInt(tokenId)]
      })
      await publicClient.waitForTransactionReceipt({ hash: h1 })

      status('info', 'Step 2/2: Listing on Tempo...')
      const h2 = await writeContractAsync({
        address: network.marketplace, abi: MARKETPLACE_ABI,
        functionName: 'listNFT', args: [nftContract, BigInt(tokenId), priceWei]
      })
      await publicClient.waitForTransactionReceipt({ hash: h2 })

      status('success', 'NFT Listed Successfully!')
      invalidateListingsCache(chainId)
      fetchListings()
    } catch (err) {
      status('error', err?.shortMessage || 'Transaction failed')
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, chainId, writeContractAsync, publicClient, fetchListings])

  const buyNFT = useCallback(async (listing) => {
    if (!account || wrongNetwork) return status('error', 'Check connection')
    
    try {
      setLoading(true); clearStatus()
      const price = BigInt(listing.price)

      status('info', 'Step 1/2: Approving pathUSD...')
      const h1 = await writeContractAsync({
        address: network.paymentToken, abi: ERC20_ABI,
        functionName: 'approve', args: [network.marketplace, price]
      })
      await publicClient.waitForTransactionReceipt({ hash: h1 })

      status('info', 'Step 2/2: Buying NFT...')
      const h2 = await writeContractAsync({
        address: network.marketplace, abi: MARKETPLACE_ABI,
        functionName: 'buyNFT', args: [BigInt(listing.listingId)]
      })
      await publicClient.waitForTransactionReceipt({ hash: h2 })

      status('success', 'Purchase Complete!')
      invalidateListingsCache(chainId)
      await Promise.all([fetchListings(), fetchBalance()])
    } catch (err) {
      status('error', err?.shortMessage || 'Transaction failed')
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, chainId, writeContractAsync, publicClient, fetchListings, fetchBalance])

  // ─── EFFECTS ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isConnected && !wrongNetwork) {
      fetchListings()
      fetchBalance()
    }
  }, [chainId, account, isConnected, wrongNetwork, fetchListings, fetchBalance])

  return {
    account, isConnected, chainId, wrongNetwork, network,
    listings, loading, txStatus,
    connectWallet: () => connect({ connector: injected() }),
    disconnect, listNFT, buyNFT, fetchListings, clearStatus
  }
}
