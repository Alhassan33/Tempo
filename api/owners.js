/**
 * api/owners.js
 * GET /api/owners?address=0x...
 */

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { address } = req.query ?? {};
  if (!address) return res.status(400).json({ error: "address is required" });

  // TODO: replace with real chain query via viem / alchemy / moralis
  const items = [
    { id: "1", name: "TempoFeline #0042", collection: "TempoFelines", price: "0.2800", gradient: "linear-gradient(135deg,#0d2137,#071424)" },
    { id: "2", name: "NyanPunk #1337",    collection: "NyanPunks",    price: "0.1240", gradient: "linear-gradient(135deg,#1a0d2b,#0b0618)" },
  ];

  return res.json(items);
}
