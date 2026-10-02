/**
 * Users.js — intentionally empty of sheet-reading logic.
 *
 * User accounts and role assignments (admin/editor/viewer) are stored in
 * Supabase (`users` table) and managed via Google Sign-In + NextAuth
 * (src/lib/auth.ts) — there is no "Users" tab in the Flood Prone Areas
 * spreadsheet, and one must not be added without first proposing it and
 * getting explicit approval (see CLAUDE.md "Production Safety"). This file
 * is kept as the documented seam in case a future requirement needs
 * Apps-Script-side user logic that genuinely depends on sheet data.
 */
