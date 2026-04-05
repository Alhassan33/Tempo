/**
 * api/image.js
 * GET /api/image?url=<encoded-url>&w=400
 * Simple image proxy / resize shim.
 */

export default async function handler(req, res) {
  const { url, w = "400" } = req.query ?? {};
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const upstream = await fetch(decodeURIComponent(url));
    if (!upstream.ok) return res.status(upstream.status).end();

    const ct = upstream.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    const buf = await upstream.arrayBuffer();
    return res.end(Buffer.from(buf));
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
