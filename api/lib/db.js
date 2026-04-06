import { createClient } from "@supabase/supabase-js";

let _client = null;

export function getDb() {
  if (_client) return _client;
  _client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // use service role for server-side writes
  );
  return _client;
}
