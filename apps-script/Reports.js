/**
 * Reports.js — intentionally empty of sheet-reading logic.
 *
 * Flood reports are user-submitted incidents, distinct from the static
 * "Flood Prone Areas" reference dataset, and are stored in Supabase
 * (`reports` table), accessed directly by the Next.js server
 * (src/lib/api.ts) — never through this Apps Script endpoint. This file
 * exists to keep the documented project structure (CLAUDE.md) accurate and
 * as the seam for a future feature that genuinely needs the Sheet, e.g.
 * cross-referencing a report's `linked_flood_prone_area_row_index` against
 * the live sheet row (use action_getFloodProneArea_ in FloodProneAreas.js
 * for that — do not duplicate sheet-reading code here).
 */
