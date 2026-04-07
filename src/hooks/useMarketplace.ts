import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  useAccount, useChainId, usePublicClient, useWalletClient,
  useWriteContract, useConnect, useDisconnect, useSwitchChain,
} from 'wagmi'
import { parseUnits } from 'viem'
import { injected } from 'wagmi/connectors'
import { MARKETPLACE_ABI, ERC721_ABI, ERC20_ABI } from '../abi/marketplace.js'
import { tempoMainnet } from '../wagmi.config.js'
import { tempoModerato } from 'viem/chains'
import { getClients } from '../rpcClients.js'

const TEMPO_CHAIN_IDS = new Set([tempoMainnet.id])

function isInjectedWallet() {
  return typeof window !== 'undefined' && !!window.ethereum
}

const BLOCK_RANGE = {
  [tempoModerato.id]: 90000n,
  [tempoMainnet.id]:  5000000n,
}

// Fire-and-forget after any successful tx — busts KV cache AND localStorage
// so next fetchListings() goes straight to RPC for fresh data
function invalidateListingsCache(chainId) {
  fetch(`/api/listings?chainId=${chainId}`, { method: 'DELETE' }).catch(() => {})
  try { localStorage.removeItem(`tempo_listings_${chainId}`) } catch {}
}

export function useMarketplace() {
  const { address: account, isConnected } = useAccount()
  const chainId       = useChainId()
  const publicClient  = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  // ─── STABLE NETWORK CONFIGURATION ──────────────────────────────────────────
  // Replaces the missing getNetwork export to fix Vercel build errors.
  const network = useMemo(() => {
    // Tempo Mainnet Configuration
    if (chainId === 4217) {
      return {
        marketplace: "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b",
        paymentToken: "0x20c0000000000000000000000000000000000000",
      }
    }
    // Default Fallback (using Mainnet addresses as primary)
    return {
      marketplace: "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b",
      paymentToken: "0x20c0000000000000000000000000000000000000",
    }
  }, [chainId])

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

  const listingsByCollection = useMemo(() => {
    const map = new Map()
    for (const l of listings) {
      const key = l.nftAddress.toLowerCase()
      if (!map.has(key)) map.set(key, { listings: [], floor: Infinity, totalListedValue: 0, count: 0 })
      const e = map.get(key)
      e.listings.push(l); e.count++
      const p = Number(l.price)
      if (p < e.floor) e.floor = p
      e.totalListedValue += p
    }
    return map
  }, [listings])

  const filteredListings = useMemo(() => {
    if (!activeFilter) return listings
    return listings.filter(l => l.nftAddress.toLowerCase() === activeFilter.toLowerCase())
  }, [listings, activeFilter])

  const connectWallet   = useCallback(() => connect({ connector: injected() }), [connect])
  const switchToTestnet = useCallback(() => switchChain({ chainId: tempoModerato.id }), [switchChain])
  const switchToMainnet = useCallback(() => switchChain({ chainId: tempoMainnet.id }), [switchChain])

  const fetchBalance = useCallback(async () => {
    if (!account || !network.paymentToken) return
    try {
      const bal = await clients.balance.readContract({
        address: network.paymentToken, abi: ERC20_ABI,
        functionName: 'balanceOf', args: [account],
      })
      setBalance(bal.toString())
    } catch (err) { console.error('fetchBalance:', err) }
  }, [clients, account, network])

  const fetchListings = useCallback(async () => {
    if (!network.marketplace) return
    const LS_KEY = `tempo_listings_${chainId}`
    const LS_TTL = 30_000
    try {
      const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
      if (c?.data?.length > 0 && Date.now() - c.ts < LS_TTL) { setListings(c.data); return }
    } catch {}
    try {
      const res = await fetch(`/api/listings?chainId=${chainId}`)
      if (res.ok) {
        const { data } = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setListings(data)
          try { localStorage.setItem(LS_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
          return
        }
      }
    } catch {}
    try {
      const [activeListings, activeIds] = await clients.listings.readContract({
        address: network.marketplace, abi: MARKETPLACE_ABI,
        functionName: 'getActiveListings',
      })
      const parsed = activeListings.map((l, i) => ({
        listingId: activeIds[i].toString(), seller: l.seller,
        nftAddress: l.nftAddress, tokenId: l.tokenId.toString(),
        price: l.price.toString(), active: true,
      }))
      setListings(parsed)
      try { localStorage.setItem(LS_KEY, JSON.stringify({ data: parsed, ts: Date.now() })) } catch {}
      return
    } catch {}
    try {
      const count = await clients.listings.readContract({
        address: network.marketplace, abi: MARKETPLACE_ABI, functionName: 'listingCount',
      })
      const total = Number(count)
      if (total === 0) { setListings([]); return }
      const CHUNK = 10
      const accumulated = []
      for (let start = 1; start <= total; start += CHUNK) {
        const end = Math.min(start + CHUNK - 1, total)
        const ids = Array.from({ length: end - start + 1 }, (_, i) => BigInt(start + i))
        const chunk = await Promise.all(
          ids.map(id =>
            clients.listings.readContract({ address: network.marketplace, abi: MARKETPLACE_ABI, functionName: 'listings', args: [id] })
              .then(l => l[4] ? { listingId: id.toString(), seller: l[0], nftAddress: l[1], tokenId: l[2].toString(), price: l[3].toString(), active: true } : null)
              .catch(() => null)
          )
        )
        accumulated.push(...chunk.filter(Boolean))
        setListings([...accumulated])
      }
    } catch (err) { console.error('fetchListings:', err) }
  }, [clients, network, chainId])

  const fetchHistory = useCallback(async ({ blockRange = 750000n } = {}) => {
    if (!publicClient || !network.marketplace) return
    const CACHE_KEY = `tempo_history_${chainId}`
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
      if (cached?.length) setHistory(cached)
    } catch {}
    try {
      const latestBlock = await clients.history.getBlockNumber()
      const CHUNK = 99999n
      const fromBlock = latestBlock > blockRange ? latestBlock - blockRange : 0n
      const listedEvent = MARKETPLACE_ABI.find(e => e.type === 'event' && e.name === 'NFTListed')
      const soldEvent   = MARKETPLACE_ABI.find(e => e.type === 'event' && e.name === 'NFTSold')
      const allListed = [], allSold = []
      for (let start = fromBlock; start < latestBlock; start += CHUNK) {
        const end = start + CHUNK - 1n < latestBlock ? start + CHUNK - 1n : latestBlock
        const [lc, sc] = await Promise.all([
          clients.history.getLogs({ address: network.marketplace, event: listedEvent, fromBlock: start, toBlock: end }).catch(() => []),
          clients.history.getLogs({ address: network.marketplace, event: soldEvent,   fromBlock: start, toBlock: end }).catch(() => []),
        ])
        allListed.push(...lc); allSold.push(...sc)
        if (start + CHUNK < latestBlock) await new Promise(r => setTimeout(r, 200))
      }
      const listed = allListed.map(e => ({ type: 'LISTED', actor: e.args.seller, listingId: e.args.listingId?.toString(), tokenId: e.args.tokenId?.toString(), nftAddress: e.args.nftAddress, price: e.args.price?.toString(), txHash: e.transactionHash, blockNumber: Number(e.blockNumber) }))
      const sold   = allSold.map(e   => ({ type: 'SOLD',   actor: e.args.buyer,  listingId: e.args.listingId?.toString(), tokenId: e.args.tokenId?.toString(), nftAddress: e.args.nftAddress, price: e.args.price?.toString(), txHash: e.transactionHash, blockNumber: Number(e.blockNumber) }))
      const result = [...listed, ...sold].sort((a, b) => b.blockNumber - a.blockNumber)
      setHistory(result)
      try { localStorage.setItem(`tempo_history_${chainId}`, JSON.stringify(result)) } catch {}
    } catch (err) { console.error('fetchHistory:', err) }
  }, [publicClient, network, chainId, clients])

  const listNFT = useCallback(async ({ nftContract, tokenId, price }) => {
    if (!account)             { status('error', 'Wallet not connected.'); return }
    if (wrongNetwork)         { status('error', 'Switch to a Tempo network.'); return }
    if (!network.marketplace) { status('error', 'Marketplace not deployed on this network.'); return }
    const tempId = `optimistic_${Date.now()}`
    const priceWei = parseUnits(String(price), 18).toString() // pathUSD uses 18 decimals
    setListings(prev => [{ listingId: tempId, seller: account, nftAddress: nftContract, tokenId: String(tokenId), price: priceWei, active: true, _optimistic: true }, ...prev])
    try {
      setLoading(true); clearStatus()
      const priceUnits = parseUnits(String(price), 18)
      status('info', 'Step 1/2 — Approving NFT transfer…')
      const h1 = await writeContractAsync({ address: nftContract, abi: ERC721_ABI, functionName: 'approve', args: [network.marketplace, BigInt(tokenId)] })
      await publicClient.waitForTransactionReceipt({ hash: h1 })
      status('info', 'Step 2/2 — Listing NFT…')
      const h2 = await writeContractAsync({ address: network.marketplace, abi: MARKETPLACE_ABI, functionName: 'listNFT', args: [nftContract, BigInt(tokenId), priceUnits] })
      await publicClient.waitForTransactionReceipt({ hash: h2 })
      status('success', `NFT #${tokenId} listed for $${price}!`)
      invalidateListingsCache(chainId)
      await Promise.all([fetchListings(), fetchHistory()])
    } catch (err) {
      setListings(prev => prev.filter(l => l.listingId !== tempId))
      status('error', err?.shortMessage ?? err?.message ?? 'Transaction failed')
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, chainId, writeContractAsync, publicClient, fetchListings, fetchHistory])

  const buyNFT = useCallback(async (listing) => {
    if (!account)              { status('error', 'Wallet not connected.'); return }
    if (wrongNetwork)          { status('error', 'Switch to a Tempo network.'); return }
    if (!network.paymentToken) { status('error', 'Payment token not configured.'); return }
    const prevListings = listings
    setListings(prev => prev.filter(l => l.listingId !== listing.listingId))
    try {
      setLoading(true); clearStatus()
      const price = BigInt(listing.price)
      status('info', 'Step 1/2 — Approving payment…')
      const h1 = await writeContractAsync({ address: network.paymentToken, abi: ERC20_ABI, functionName: 'approve', args: [network.marketplace, price] })
      await publicClient.waitForTransactionReceipt({ hash: h1 })
      status('info', 'Step 2/2 — Buying NFT…')
      const h2 = await writeContractAsync({ address: network.marketplace, abi: MARKETPLACE_ABI, functionName: 'buyNFT', args: [BigInt(listing.listingId)] })
      await publicClient.waitForTransactionReceipt({ hash: h2 })
      status('success', `NFT #${listing.tokenId} purchased!`)
      invalidateListingsCache(chainId)
      await Promise.all([fetchListings(), fetchHistory(), fetchBalance()])
    } catch (err) {
      setListings(prevListings)
      status('error', err?.shortMessage ?? err?.message ?? 'Transaction failed')
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, chainId, listings, writeContractAsync, publicClient, fetchListings, fetchHistory, fetchBalance])

  const cancelListing = useCallback(async (listingId) => {
    if (!account) { status('error', 'Wallet not connected.'); return }
    const prevListings = listings
    setListings(prev => prev.filter(l => l.listingId !== listingId))
    try {
      setLoading(true); clearStatus()
      status('info', `Cancelling listing #${listingId}…`)
      const h = await writeContractAsync({ address: network.marketplace, abi: MARKETPLACE_ABI, functionName: 'cancelListing', args: [BigInt(listingId)] })
      await publicClient.waitForTransactionReceipt({ hash: h })
      status('success', `Listing #${listingId} cancelled.`)
      invalidateListingsCache(chainId)
      await Promise.all([fetchListings(), fetchHistory()])
    } catch (err) {
      setListings(prevListings)
      status('error', err?.shortMessage ?? err?.message ?? 'Transaction failed')
    } finally { setLoading(false) }
  }, [account, network, chainId, listings, writeContractAsync, publicClient, fetchListings, fetchHistory])

  const updatePrice = useCallback(async (listingId, newPrice) => {
    if (!account) { status('error', 'Wallet not connected.'); return }
    const priceWei = parseUnits(String(newPrice), 18).toString()
    const prevListings = listings
    setListings(prev => prev.map(l => l.listingId === listingId ? { ...l, price: priceWei } : l))
    try {
      setLoading(true); clearStatus()
      status('info', `Updating price for listing #${listingId}…`)
      const priceUnits = parseUnits(String(newPrice), 18)
      const h = await writeContractAsync({ address: network.marketplace, abi: MARKETPLACE_ABI, functionName: 'updatePrice', args: [BigInt(listingId), priceUnits] })
      await publicClient.waitForTransactionReceipt({ hash: h })
      status('success', `Price updated to $${newPrice}!`)
      invalidateListingsCache(chainId)
      await fetchListings()
    } catch (err) {
      setListings(prevListings)
      status('error', err?.shortMessage ?? err?.message ?? 'Transaction failed')
    } finally { setLoading(false) }
  }, [account, network, chainId, listings, writeContractAsync, publicClient, fetchListings])

  const fetchOwnedTokens = useCallback(async (nftAddress) => {
    if (!account) return []
    const client = clients.collection
    const CACHE_KEY = `tempo_owned_${account.toLowerCase()}_${nftAddress.toLowerCase()}`
    const CACHE_TTL = 60_000
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
      if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.ids
    } catch {}
    const saveOwned = (ids) => {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ids, ts: Date.now() })) } catch {}
    }
    // Fast: ERC721Enumerable
    try {
      const balance = await client.readContract({ address: nftAddress, abi: ERC721_ABI, functionName: 'balanceOf', args: [account] })
      const count = Number(balance)
      if (count === 0) { saveOwned([]); return [] }
      const ENUM_ABI = [{ name: 'tokenOfOwnerByIndex', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] }]
      const ids = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          client.readContract({ address: nftAddress, abi: ENUM_ABI, functionName: 'tokenOfOwnerByIndex', args: [account, BigInt(i)] }).then(id => id.toString())
        )
      )
      saveOwned(ids); return ids
    } catch {}
    // Fallback: Transfer log scan
    try {
      const transferEvent = { name: 'Transfer', type: 'event', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }] }
      const latestBlock = await client.getBlockNumber()
      const range = BLOCK_RANGE[chainId] ?? 50000n
      const CHUNK = 99999n
      const fromBlock = latestBlock > range ? latestBlock - range : 0n
      const allReceived = [], allSent = []
      for (let start = fromBlock; start < latestBlock; start += CHUNK) {
        const end = start + CHUNK - 1n < latestBlock ? start + CHUNK - 1n : latestBlock
        const [received, sent] = await Promise.all([
          client.getLogs({ address: nftAddress, event: transferEvent, args: { to: account },   fromBlock: start, toBlock: end }).catch(() => []),
          client.getLogs({ address: nftAddress, event: transferEvent, args: { from: account }, fromBlock: start, toBlock: end }).catch(() => []),
        ])
        allReceived.push(...received); allSent.push(...sent)
        if (start + CHUNK < latestBlock) await new Promise(r => setTimeout(r, 150))
      }
      const receivedIds = new Set(allReceived.map(l => l.args.tokenId?.toString()).filter(Boolean))
      const sentIds     = new Set(allSent.map(l => l.args.tokenId?.toString()).filter(Boolean))
      const owned = [...receivedIds].filter(id => !sentIds.has(id))
      if (owned.length > 0) { saveOwned(owned); return owned }
    } catch {}
    return []
  }, [clients, account, chainId])

  useEffect(() => {
    if (!isConnected || !wrongNetwork) return
    const t = setTimeout(() => { switchChain({ chainId: tempoMainnet.id }) }, 800)
    return () => clearTimeout(t)
  }, [isConnected, wrongNetwork, switchChain])

  useEffect(() => {
    if (!publicClient) return
    if (isConnected && wrongNetwork) return
    const t1 = setTimeout(() => fetchListings(), 300)
    const t2 = setTimeout(() => { if (isConnected) fetchBalance() }, 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [publicClient, chainId, account, isConnected, fetchListings, fetchBalance, wrongNetwork])

  return {
    account, isConnected, chainId, wrongNetwork, network,
    listings, filteredListings, listingsByCollection,
    history, balance,
    activeFilter, setActiveFilter,
    loading, txStatus,
    connectWallet, disconnect, switchToTestnet, switchToMainnet,
    listNFT, buyNFT, cancelListing, updatePrice,
    fetchListings, fetchHistory, fetchBalance, fetchOwnedTokens,
    clearStatus,
    publicClient,
  }
}
