import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for FloodWatch's SECONDARY datastore.
 *
 * Supabase does NOT hold flood-prone-area records — those live exclusively
 * in the "Flood Prone Areas" Google Sheet, accessed only through Apps
 * Script. Supabase holds:
 *   - location_cache          (geocoded coordinates, reused across loads)
 *   - location_review_queue   (low-confidence results awaiting manual verification)
 *   - reports                 (user-submitted flood reports)
 *   - activity_logs           (audit trail)
 *   - users                   (role assignments: admin / editor / viewer)
 *
 * The `import "server-only"` guard makes any accidental import from a
 * Client Component a build error — the service-role key must never reach
 * the browser. Client Components call Next.js API routes under
 * src/app/api/, which use this module server-side.
 */

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured. Set them in .env.local (see .env.example).",
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}
