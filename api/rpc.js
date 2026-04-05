/**
 * api/rpc.js
 * POST /api/rpc
 * Proxies JSON-RPC requests to an RPC endpoint to avoid exposing API keys
 * on the client and to work around CORS restrictions.
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) return res.status(500).json({ error: "RPC_URL not configured" });

  try {
    const upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
