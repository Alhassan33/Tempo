import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  useAccount, useChainId, usePublicClient,
  useWriteContract, useConnect, useDisconnect,
} from 'wagmi'
import { parseUnits } from 'viem'
import { injected } from 'wagmi/connectors'
import { MARKETPLACE_ABI, ERC721_ABI, ERC20_ABI } from '../abi/marketplace.js'
import { tempoMainnet } from '../wagmi.config.js'
import { getClients } from '../rpcClients.js'
import { supabase } from '../lib/supabase.js'

const TEMPO_CHAIN_IDS = new Set([tempoMainnet.id])
const USD_DECIMALS    = 6

// ─── Human USD → raw 6-decimal units ─────────────────────────────────────────
function toRawUnits(humanPrice: string | number): bigint {
  return parseUnits(String(humanPrice), USD_DECIMALS)
}

// ─── Decode revert codes into readable messages ───────────────────────────────
function parseContractError(err: any): string {
  const msg = err?.shortMessage || err?.message || ''
  if (msg.includes('1002')) return 'Price changed — refresh and try again'
  if (msg.includes('1001')) return 'Listing is no longer active'
  if (msg.includes('1003')) return 'Below minimum listing price'
  if (msg.includes('1004')) return 'Cannot buy your own listing'
  if (msg.includes('EnforcedPause'))   return 'Marketplace is currently paused'
  if (msg.includes('insufficient'))    return 'Insufficient USD balance'
  if (msg.includes('user rejected') || msg.includes('User rejected')) return 'Transaction cancelled'
  if (msg.includes('allowance'))       return 'Approval failed — please try again'
  return err?.shortMessage || 'Transaction failed'
}

export interface Listing {
  id?: string
  listingId: string
  seller: string
  nftAddress: string
  tokenId: string
  price: string        // human-readable USD e.g. "1.00"
  displayPrice: string
  active: boolean
  name?: string
  image?: string
}

export function useMarketplace() {
  const { address: account, isConnected } = useAccount()
  const chainId      = useChainId()
  const publicClient = usePublicClient()

  const network = useMemo(() => ({
    marketplace:  "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b",
    paymentToken: "0x20c0000000000000000000000000000000000000",
  }), [])

  const clients = useMemo(() => getClients(chainId), [chainId])
  const { connect }            = useConnect()
  const { disconnect }         = useDisconnect()
  const { writeContractAsync } = useWriteContract()

  const [listings, setListings] = useState<Listing[]>([])
  const [balance,  setBalance]  = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [txStatus, setTxStatus] = useState<{ type: 'info'|'success'|'error'; msg: string } | null>(null)

  const wrongNetwork = !TEMPO_CHAIN_IDS.has(chainId)
  const status       = (type: 'info'|'success'|'error', msg: string) => setTxStatus({ type, msg })
  const clearStatus  = () => setTxStatus(null)

  // ─── Fetch listings ────────────────────────────────────────────────────────
  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('listings').select('*')
        .eq('active', true).order('price', { ascending: true })
      if (error) throw error
      setListings((data || []).map((item: any) => ({
        id:           item.id,
        listingId:    String(item.listing_id),
        seller:       item.seller,
        nftAddress:   item.nft_contract,
        tokenId:      String(item.token_id),
        price:        String(item.price),            // human USD
        displayPrice: Number(item.price).toFixed(2),
        active:       item.active,
        name:         item.name,
        image:        item.image,
      })))
    } catch (err) {
      console.error('fetchListings:', err)
      setListings([])
    } finally { setLoading(false) }
  }, [])

  const fetchBalance = useCallback(async () => {
    if (!account || !network.paymentToken) return
    try {
      const bal = await clients.balance.readContract({
        address: network.paymentToken, abi: ERC20_ABI,
        functionName: 'balanceOf', args: [account],
      })
      setBalance((bal as bigint).toString())
    } catch {}
  }, [clients, account, network])

  // ─── List NFT ──────────────────────────────────────────────────────────────
  const listNFT = useCallback(async ({ nftContract, tokenId, price }: {
    nftContract: string; tokenId: string | number; price: string | number
  }) => {
    if (!account || wrongNetwork) return status('error', 'Check connection/network')
    try {
      setLoading(true); clearStatus()
      const priceUnits = toRawUnits(price)

      status('info', 'Step 1/2: Approving NFT...')
      const h1 = await writeContractAsync({
        address: nftContract as `0x${string}`, abi: ERC721_ABI,
        functionName: 'approve', args: [network.marketplace, BigInt(tokenId)],
      })
      await publicClient!.waitForTransactionReceipt({ hash: h1 })

      status('info', 'Step 2/2: Listing on Tempo...')
      const h2 = await writeContractAsync({
        address: network.marketplace as `0x${string}`, abi: MARKETPLACE_ABI,
        functionName: 'listNFT', args: [nftContract, BigInt(tokenId), priceUnits],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: h2 })

      try {
        const totalRaw = await publicClient!.readContract({
          address: network.marketplace as `0x${string}`, abi: MARKETPLACE_ABI,
          functionName: 'totalListings',
        }) as bigint
        await supabase.from('listings').upsert({
          listing_id:   Number(totalRaw) - 1,
          seller:       account.toLowerCase(),
          nft_contract: nftContract.toLowerCase(),
          token_id:     Number(tokenId),
          price:        Number(price),
          active:       true,
          tx_hash:      h2,
          block_number: Number(receipt.blockNumber),
        }, { onConflict: 'listing_id' })
      } catch (dbErr) { console.warn('Supabase write failed (cron will sync):', dbErr) }

      status('success', 'NFT Listed Successfully!')
      fetchListings()
    } catch (err: any) {
      status('error', parseContractError(err))
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, writeContractAsync, publicClient, fetchListings])

  // ─── Buy NFT ───────────────────────────────────────────────────────────────
  // MarketplaceV2: buyNFT(listingId, maxPrice)
  // maxPrice is slippage protection — pass exact listing price as raw units
  // listing.price is human USD (e.g. "1.00") → convert to 1000000 (6 decimals)
  const buyNFT = useCallback(async (listing: Listing) => {
    if (!account || wrongNetwork) return status('error', 'Check connection')
    try {
      setLoading(true); clearStatus()

      // ✅ FIXED: convert human USD → raw 6-decimal units
      const rawPrice = toRawUnits(listing.price)

      status('info', 'Step 1/2: Approving payment...')
      const h1 = await writeContractAsync({
        address: network.paymentToken as `0x${string}`, abi: ERC20_ABI,
        functionName: 'approve', args: [network.marketplace, rawPrice],
      })
      await publicClient!.waitForTransactionReceipt({ hash: h1 })

      status('info', 'Step 2/2: Completing purchase...')
      const h2 = await writeContractAsync({
        address: network.marketplace as `0x${string}`, abi: MARKETPLACE_ABI,
        functionName: 'buyNFT',
        // ✅ FIXED: MarketplaceV2 requires (listingId, maxPrice) — not just (listingId)
        args: [BigInt(listing.listingId), rawPrice],
      })
      // ✅ FIXED: wait for confirmation before showing success
      await publicClient!.waitForTransactionReceipt({ hash: h2 })

      try {
        await supabase.from('listings')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('listing_id', Number(listing.listingId))
      } catch {}

      status('success', 'Purchase Complete!')
      await Promise.all([fetchListings(), fetchBalance()])
    } catch (err: any) {
      status('error', parseContractError(err))
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, writeContractAsync, publicClient, fetchListings, fetchBalance])

  // ─── Delist ────────────────────────────────────────────────────────────────
  const delistNFT = useCallback(async (listingId: string | number) => {
    if (!account || wrongNetwork) return status('error', 'Check connection')
    try {
      setLoading(true); clearStatus()
      status('info', 'Cancelling listing...')
      const h1 = await writeContractAsync({
        address: network.marketplace as `0x${string}`, abi: MARKETPLACE_ABI,
        functionName: 'cancelListing', args: [BigInt(listingId)],
      })
      await publicClient!.waitForTransactionReceipt({ hash: h1 })
      try {
        await supabase.from('listings')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('listing_id', Number(listingId))
      } catch {}
      status('success', 'Listing Cancelled!')
      fetchListings()
      return true
    } catch (err: any) {
      status('error', parseContractError(err))
      return false
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, writeContractAsync, publicClient, fetchListings])

  useEffect(() => {
    if (isConnected && !wrongNetwork) { fetchListings(); fetchBalance() }
  }, [isConnected, wrongNetwork, fetchListings, fetchBalance])

  return {
    account, isConnected, chainId, wrongNetwork, network,
    listings, balance, loading, txStatus,
    connectWallet: () => connect({ connector: injected() }),
    disconnect, listNFT, buyNFT, delistNFT, fetchListings, clearStatus,
  }
}

export const useListNFT   = () => { const { listNFT,   loading, txStatus, clearStatus } = useMarketplace(); return { listNFT,   loading, txStatus, clearStatus } }
export const useBuyNFT    = () => { const { buyNFT,    loading, txStatus, clearStatus } = useMarketplace(); return { buyNFT,    loading, txStatus, clearStatus } }
export const useDelistNFT = () => { const { delistNFT, loading, txStatus, clearStatus } = useMarketplace(); return { delistNFT, loading, txStatus, clearStatus } }
