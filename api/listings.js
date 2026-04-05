/**
 * api/listings.js
 * GET /api/listings?collection=X&limit=20
 */

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { collection, limit = 20 } = req.query ?? {};
  const n = Math.min(parseInt(limit, 10), 100);

  // TODO: replace with real contract / DB query
  const items = Array.from({ length: n }, (_, i) => ({
    id:         String(i + 1),
    tokenId:    i + 1,
    name:       `Token #${String(i + 1).padStart(4, "0")}`,
    collection: collection ?? "unknown",
    price:      (0.1 + i * 0.005).toFixed(4),
    seller:     `0x${Math.random().toString(16).slice(2, 12)}`,
    listedAt:   new Date(Date.now() - i * 3600000).toISOString(),
  }));

  return res.json(items);
}
