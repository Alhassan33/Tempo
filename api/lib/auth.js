/**
 * api/lib/auth.js
 * Basic API key / admin authentication helpers.
 */

export function isAdminRequest(req) {
  const key = req.headers["x-admin-key"] ?? req.query?.adminKey;
  return key === process.env.ADMIN_SECRET;
}

export function unauthorizedResponse(res) {
  return res.status(401).json({ error: "Unauthorized" });
}
