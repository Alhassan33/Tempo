/**
 * api/cron/sync.js
 * Vercel cron job — syncs on-chain data periodically.
 * Configure schedule in vercel.json:
 *   "crons": [{ "path": "/api/cron/sync", "schedule": "0 * * * *" }]
 */

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // TODO: pull latest listings / sales from chain and store in DB
  console.log("[cron/sync] starting sync at", new Date().toISOString());

  return res.status(200).json({ ok: true, synced: 0 });
}
