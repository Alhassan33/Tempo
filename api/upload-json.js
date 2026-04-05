/**
 * api/upload-json.js
 * POST /api/upload-json  { metadata: {...} }
 * Pins JSON metadata to IPFS (or stores in cloud) and returns the URI.
 *
 * Providers: Pinata, nft.storage, web3.storage, Supabase.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { metadata } = req.body ?? {};
  if (!metadata) return res.status(400).json({ error: "metadata is required" });

  // TODO: pin to IPFS via Pinata / web3.storage
  // const { IpfsHash } = await pinata.pinJSONToIPFS(metadata)
  // return res.json({ uri: `ipfs://${IpfsHash}` })

  return res.json({ uri: null, message: "Configure IPFS provider to enable pinning." });
}
