/**
 * api/collections.js
 * GET  /api/collections          — list all collections
 * GET  /api/collections?id=X     — single collection by id
 * GET  /api/collections?type=launchpad — only launchpad drops
 */

const MOCK_COLLECTIONS = [
  { id: "1", address: "0x000...001", name: "TempoFelines",  verified: true,  supply: 5000,  floor: "0.2800", topOffer: "0.2600", change24h: 8.4,  volume: 142.5, gradient: "linear-gradient(135deg,#0d2137,#071424)" },
  { id: "2", address: "0x000...002", name: "NyanPunks",     verified: true,  supply: 10000, floor: "0.1240", topOffer: "0.1150", change24h: -3.1, volume: 98.2,  gradient: "linear-gradient(135deg,#1a0d2b,#0b0618)" },
  { id: "3", address: "0x000...003", name: "ChronoBeasts",  verified: false, supply: 3333,  floor: "0.0880", topOffer: "0.0820", change24h: 21.7, volume: 67.8,  gradient: "linear-gradient(135deg,#0d1f2b,#071624)" },
  { id: "4", address: "0x000...004", name: "TempoAngels",   verified: true,  supply: 8888,  floor: "0.0430", topOffer: "0.0400", change24h: -1.5, volume: 34.1,  gradient: "linear-gradient(135deg,#1f0d1e,#0d061b)" },
  { id: "5", address: "0x000...005", name: "CipherCats",    verified: false, supply: 1111,  floor: "0.3750", topOffer: "0.3600", change24h: 5.6,  volume: 210.3, gradient: "linear-gradient(135deg,#0d1d10,#06110a)" },
];

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { id, type } = req.query ?? {};

  if (id) {
    const col = MOCK_COLLECTIONS.find((c) => c.id === id || c.address === id);
    if (!col) return res.status(404).json({ error: "Not found" });
    return res.json(col);
  }

  let data = MOCK_COLLECTIONS;
  if (type === "launchpad") {
    data = data.map((c) => ({ ...c, type: "launchpad", endsAt: Date.now() + Math.random() * 86400000 }));
  }

  return res.json(data);
}
