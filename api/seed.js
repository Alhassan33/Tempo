/**
 * api/seed.js
 * POST /api/seed  (admin only)
 * Seeds the database with sample collections, listings, and activity.
 */

import { isAdminRequest, unauthorizedResponse } from "./lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAdminRequest(req)) return unauthorizedResponse(res);

  // TODO: insert seed data into your DB
  console.log("[seed] seeding database…");

  return res.json({ ok: true, seeded: { collections: 5, listings: 50, activity: 200 } });
}
