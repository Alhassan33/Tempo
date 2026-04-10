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
const USD_DECIMALS = 6

export interface Listing {
  id: number
  listingId: string
  seller: string
  nftAddress: string
  tokenId: string
  price: string
  displayPrice: string
  active: boolean
  txHash: string
  blockNumber: number
  createdAt: string
  name: string | null
  image: string | null
  metadata: Record<string, any> | null
  rarityRank: number | null
}

export function useMarketplace() {
  const { address: account, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()

  const network = useMemo(() => ({
    marketplace: "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b",
    paymentToken: "0x20c0000000000000000000000000000000000000",
  }), [])

  const clients = useMemo(() => getClients(chainId), [chainId])
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()

  const [listings, setListings] = useState<Listing[]>([])
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null)

  const wrongNetwork = !TEMPO_CHAIN_IDS.has(chainId)
  const status = (type: 'info' | 'success' | 'error', msg: string) => setTxStatus({ type, msg })
  const clearStatus = () => setTxStatus(null)

  const mapRpcToListing = (item: any): Listing => ({
    id: item.id,
    listingId: String(item.listing_id),
    seller: item.seller,
    nftAddress: item.nft_contract,
    tokenId: String(item.token_id),
    price: String(item.price),
    displayPrice: (Number(item.price) / 10 ** USD_DECIMALS).toFixed(2),
    active: item.active,
    txHash: item.tx_hash,
    blockNumber: item.block_number,
    createdAt: item.created_at,
    name: item.name,
    image: item.image,
    metadata: item.metadata,
    rarityRank: item.rarity_rank,
  })

  // ─── Fetch Listings with DEBUG LOGGING ──────────────────────────────────────
  const fetchListings = useCallback(async () => {
    console.log('[useMarketplace] fetchListings called')
    console.log('[useMarketplace] isConnected:', isConnected, 'wrongNetwork:', wrongNetwork)
    
    setLoading(true)
    try {
      console.log('[useMarketplace] Calling Supabase RPC...')
      const { data, error } = await supabase
        .rpc('get_active_listings_with_nfts')

      console.log('[useMarketplace] Supabase response:', { data, error })
      
      if (error) {
        console.error('[useMarketplace] Supabase error:', error)
        throw error
      }
      
      if (!data) {
        console.log('[useMarketplace] No data returned from RPC')
        setListings([])
        return
      }
      
      console.log('[useMarketplace] Raw data count:', data.length)
      console.log('[useMarketplace] First item sample:', data[0])

      const transformed = data.map(mapRpcToListing)
      console.log('[useMarketplace] Transformed listings:', transformed.length)
      console.log('[useMarketplace] First transformed:', transformed[0])

      setListings(transformed)
    } catch (err: any) {
      console.error('[useMarketplace] Fetch listings failed:', err.message, err)
      setListings([])
    } finally {
      setLoading(false)
      console.log('[useMarketplace] fetchListings complete, loading set to false')
    }
  }, [isConnected, wrongNetwork]) // Added deps for debugging clarity

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
    } catch (err) {
      console.error('fetchBalance:', err)
    }
  }, [clients, account, network])

  // ─── List NFT ──────────────────────────────────────────────────────────────
  const listNFT = useCallback(async ({ nftContract, tokenId, price }: {
    nftContract: string
    tokenId: string | number
    price: string | number
  }) => {
    if (!account || wrongNetwork) return status('error', 'Check connection/network')
    
    try {
      setLoading(true)
      clearStatus()

      const priceUnits = parseUnits(String(price), USD_DECIMALS)

      status('info', 'Step 1/2: Approving NFT...')
      const approveHash = await writeContractAsync({
        address: nftContract as `0x${string}`,
        abi: ERC721_ABI,
        functionName: 'approve',
        args: [network.marketplace, BigInt(tokenId)],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      status('info', 'Step 2/2: Listing on Tempo...')
      const listHash = await writeContractAsync({
        address: network.marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'listNFT',
        args: [nftContract, BigInt(tokenId), priceUnits],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: listHash })

      try {
        const totalRaw = await publicClient.readContract({
          address: network.marketplace as `0x${string}`,
          abi: MARKETPLACE_ABI,
          functionName: 'totalListings',
        })
        const newListingId = Number(totalRaw) - 1

        await supabase.from('listings').upsert({
          listing_id: newListingId,
          seller: account.toLowerCase(),
          nft_contract: nftContract.toLowerCase(),
          token_id: Number(tokenId),
          price: Number(price),
          active: true,
          tx_hash: listHash,
          block_number: Number(receipt.blockNumber),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'listing_id' })

        await fetchListings()
      } catch (dbErr) {
        console.warn('[listNFT] Supabase write failed:', dbErr)
      }

      status('success', 'NFT Listed Successfully!')
    } catch (err: any) {
      status('error', err?.shortMessage || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }, [account, wrongNetwork, network, writeContractAsync, publicClient, fetchListings])

  // ─── Buy NFT ───────────────────────────────────────────────────────────────
  const buyNFT = useCallback(async (listing: Listing) => {
    if (!account || wrongNetwork) return status('error', 'Check connection')
    
    try {
      setLoading(true)
      clearStatus()
      
      const price = BigInt(listing.price)

      status('info', 'Step 1/2: Approving pathUSD...')
      const approveHash = await writeContractAsync({
        address: network.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [network.marketplace, price],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      status('info', 'Step 2/2: Buying NFT...')
      const buyHash = await writeContractAsync({
        address: network.marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'buyNFT',
        args: [BigInt(listing.listingId)],
      })
      await publicClient.waitForTransactionReceipt({ hash: buyHash })

      try {
        await supabase.from('listings')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('listing_id', Number(listing.listingId))
      } catch {}

      status('success', 'Purchase Complete!')
      await Promise.all([fetchListings(), fetchBalance()])
    } catch (err: any) {
      status('error', err?.shortMessage || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }, [account, wrongNetwork, network, writeContractAsync, publicClient, fetchListings, fetchBalance])

  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[useMarketplace] Effect triggered:', { isConnected, wrongNetwork, chainId })
    
    if (isConnected && !wrongNetwork) {
      console.log('[useMarketplace] Calling fetchListings and fetchBalance')
      fetchListings()
      fetchBalance()
    } else {
      console.log('[useMarketplace] Skipping fetch - not connected or wrong network')
    }
  }, [isConnected, wrongNetwork, chainId, fetchListings, fetchBalance])

  return {
    account,
    isConnected,
    chainId,
    wrongNetwork,
    network,
    listings,
    balance,
    loading,
    txStatus,
    connectWallet: () => connect({ connector: injected() }),
    disconnect,
    listNFT,
    buyNFT,
    fetchListings,
    clearStatus,
  }
}

export const useListNFT = () => {
  const { listNFT, loading, txStatus, clearStatus } = useMarketplace()
  return { listNFT, loading, txStatus, clearStatus }
}

export const useBuyNFT = () => {
  const { buyNFT, loading, txStatus, clearStatus } = useMarketplace()
  return { buyNFT, loading, txStatus, clearStatus }
}
