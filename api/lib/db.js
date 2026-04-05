/**
 * api/lib/db.js
 * Database client helper.
 * Swap this stub for a real Postgres/Supabase/PlanetScale client as needed.
 */

let _client = null;

export function getDb() {
  if (_client) return _client;
  // TODO: replace with real DB client, e.g.
  // import { createClient } from '@supabase/supabase-js'
  // _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  _client = { query: async () => ({ rows: [] }) };
  return _client;
}
