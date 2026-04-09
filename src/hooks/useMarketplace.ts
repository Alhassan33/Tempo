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
import { supabase } from '../lib/supabase.js'

const TEMPO_CHAIN_IDS = new Set([tempoMainnet.id])
const USD_DECIMALS    = 6  // pathUSD = 6 decimals, NOT 18

export function useMarketplace() {
  const { address: account, isConnected } = useAccount()
  const chainId       = useChainId()
  const publicClient  = usePublicClient()

  const network = useMemo(() => ({
    marketplace:  "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b",
    paymentToken: "0x20c0000000000000000000000000000000000000",
  }), [])

  const clients = useMemo(() => getClients(chainId), [chainId])
  const { connect }    = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()

  const [listings, setListings] = useState([])
  const [balance,  setBalance]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [txStatus, setTxStatus] = useState(null)

  const wrongNetwork = !TEMPO_CHAIN_IDS.has(chainId)
  const status       = (type, msg) => setTxStatus({ type, msg })
  const clearStatus  = () => setTxStatus(null)

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
    try {
      const count = await clients.listings.readContract({
        address: network.marketplace, abi: MARKETPLACE_ABI,
        functionName: 'totalListings',
      })
      const total = Number(count)
      if (total === 0) { setListings([]); return }

      const accumulated = []
      for (let i = 0; i < total; i++) {
        try {
          const l = await clients.listings.readContract({
            address: network.marketplace, abi: MARKETPLACE_ABI,
            functionName: 'listings', args: [BigInt(i)],
          })
          if (l && l[4] === true) {
            accumulated.push({
              listingId: i.toString(), seller: l[0],
              nftAddress: l[1], tokenId: l[2].toString(),
              price: l[3].toString(), active: true,
            })
          }
        } catch { continue }
      }
      setListings(accumulated)
    } catch (err) { console.error('fetchListings:', err) }
  }, [clients, network])

  // ─── List NFT ──────────────────────────────────────────────────────────────
  const listNFT = useCallback(async ({ nftContract, tokenId, price }) => {
    if (!account || wrongNetwork) return status('error', 'Check connection/network')
    try {
      setLoading(true); clearStatus()

      // ✅ FIXED: 6 decimals not 18
      const priceUnits = parseUnits(String(price), USD_DECIMALS)

      status('info', 'Step 1/2: Approving NFT...')
      const h1 = await writeContractAsync({
        address: nftContract, abi: ERC721_ABI,
        functionName: 'approve', args: [network.marketplace, BigInt(tokenId)],
      })
      await publicClient.waitForTransactionReceipt({ hash: h1 })

      status('info', 'Step 2/2: Listing on Tempo...')
      const h2 = await writeContractAsync({
        address: network.marketplace, abi: MARKETPLACE_ABI,
        functionName: 'listNFT', args: [nftContract, BigInt(tokenId), priceUnits],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: h2 })

      // ✅ Write to Supabase immediately so it shows on marketplace without waiting for cron
      try {
        const totalRaw = await publicClient.readContract({
          address: network.marketplace, abi: MARKETPLACE_ABI,
          functionName: 'totalListings',
        })
        const newListingId = Number(totalRaw) - 1

        await supabase.from('listings').upsert({
          listing_id:   newListingId,
          seller:       account.toLowerCase(),
          nft_contract: nftContract.toLowerCase(),
          token_id:     Number(tokenId),
          price:        Number(price),
          active:       true,
          tx_hash:      h2,
          block_number: Number(receipt.blockNumber),
        }, { onConflict: 'listing_id' })
      } catch (dbErr) {
        console.warn('[listNFT] Supabase write failed (cron will sync):', dbErr.message)
      }

      status('success', 'NFT Listed Successfully!')
      fetchListings()
    } catch (err) {
      status('error', err?.shortMessage || 'Transaction failed')
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, writeContractAsync, publicClient, fetchListings])

  // ─── Buy NFT ───────────────────────────────────────────────────────────────
  const buyNFT = useCallback(async (listing) => {
    if (!account || wrongNetwork) return status('error', 'Check connection')
    try {
      setLoading(true); clearStatus()
      const price = BigInt(listing.price)

      status('info', 'Step 1/2: Approving pathUSD...')
      const h1 = await writeContractAsync({
        address: network.paymentToken, abi: ERC20_ABI,
        functionName: 'approve', args: [network.marketplace, price],
      })
      await publicClient.waitForTransactionReceipt({ hash: h1 })

      status('info', 'Step 2/2: Buying NFT...')
      const h2 = await writeContractAsync({
        address: network.marketplace, abi: MARKETPLACE_ABI,
        functionName: 'buyNFT', args: [BigInt(listing.listingId)],
      })
      await publicClient.waitForTransactionReceipt({ hash: h2 })

      // ✅ Mark listing inactive in Supabase immediately
      try {
        await supabase.from('listings')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('listing_id', Number(listing.listingId))
      } catch {}

      status('success', 'Purchase Complete!')
      await Promise.all([fetchListings(), fetchBalance()])
    } catch (err) {
      status('error', err?.shortMessage || 'Transaction failed')
    } finally { setLoading(false) }
  }, [account, wrongNetwork, network, writeContractAsync, publicClient, fetchListings, fetchBalance])

  useEffect(() => {
    if (isConnected && !wrongNetwork) {
      fetchListings()
      fetchBalance()
    }
  }, [chainId, account, isConnected, wrongNetwork, fetchListings, fetchBalance])

  return {
    account, isConnected, chainId, wrongNetwork, network,
    listings, balance, loading, txStatus,
    connectWallet: () => connect({ connector: injected() }),
    disconnect, listNFT, buyNFT, fetchListings, clearStatus,
  }
}

export function useListNFT() {
  const { listNFT, loading, txStatus, clearStatus } = useMarketplace()
  return { listNFT, loading, txStatus, clearStatus }
}

export function useBuyNFT() {
  const { buyNFT, loading, txStatus, clearStatus } = useMarketplace()
  return { buyNFT, loading, txStatus, clearStatus }
}
