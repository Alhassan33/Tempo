/**
 * api/upload.js
 * POST /api/upload  (multipart/form-data)
 * Uploads an NFT image to cloud storage and returns the public URL.
 *
 * Configure: set STORAGE_BUCKET env var for your provider.
 * Examples: Vercel Blob, Cloudinary, S3, Supabase Storage.
 */

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // TODO: parse multipart form with formidable / busboy, upload to cloud storage
  return res.json({ ok: true, url: null, message: "Configure STORAGE_BUCKET to enable uploads." });
}
