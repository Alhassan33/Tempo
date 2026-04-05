/**
 * api/activity.js
 * GET /api/activity?collection=X&address=Y&limit=20
 */

const TYPES = ["sale", "listing", "offer", "transfer", "mint"];

function randomAddress() {
  return `0x${Math.random().toString(16).slice(2, 10)}…${Math.random().toString(16).slice(2, 6)}`;
}

function mockActivity(n = 20) {
  return Array.from({ length: n }, (_, i) => ({
    type:  TYPES[i % TYPES.length],
    name:  `Token #${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`,
    from:  randomAddress(),
    to:    randomAddress(),
    price: (Math.random() * 0.5 + 0.05).toFixed(4),
    time:  `${Math.floor(Math.random() * 59) + 1}m ago`,
  }));
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const limit = Math.min(parseInt(req.query?.limit ?? "20", 10), 100);
  // TODO: replace with real DB query filtered by collection / address
  return res.json(mockActivity(limit));
}
