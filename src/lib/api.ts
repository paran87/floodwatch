import "server-only";
import { getSupabaseClient } from "./supabase";
import type { ActivityEventType, FloodReport, ReportFilters } from "./types";

/**
 * Server-only data access for everything that lives in Supabase (the
 * secondary datastore): reports, the location review queue, and activity
 * logs. Flood-prone-area reads/writes go through src/lib/apps-script.ts
 * instead — never through here.
 */

export async function getReports(filters: ReportFilters = {}): Promise<{ items: FloodReport[]; total: number }> {
  const supabase = getSupabaseClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("reports").select("*", { count: "exact" }).order("reported_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.province) query = query.eq("province", filters.province);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters.from) query = query.gte("reported_at", filters.from);
  if (filters.to) query = query.lte("reported_at", filters.to);

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return { items: (data ?? []) as FloodReport[], total: count ?? 0 };
}

export async function getReport(id: string): Promise<FloodReport | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FloodReport) ?? null;
}

export async function createReport(
  input: Omit<FloodReport, "id" | "reportedAt" | "updatedAt" | "updatedBy">,
): Promise<FloodReport> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({ ...input, reported_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logActivity("CREATE_REPORT", input.reportedBy, "report", data.id, `Report "${input.title}" created`);
  return data as FloodReport;
}

export async function updateReport(
  id: string,
  updates: Partial<FloodReport>,
  updatedBy: string,
): Promise<FloodReport> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("reports")
    .update({ ...updates, updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logActivity("UPDATE_REPORT", updatedBy, "report", id, `Report updated`);
  return data as FloodReport;
}

export async function logActivity(
  eventType: ActivityEventType,
  actorEmail: string | null,
  targetType: "flood_prone_area" | "report" | "location" | "user" | "system",
  targetId: string | null,
  message: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  // Never log secrets: callers must not pass tokens/passwords/keys in `message`.
  await supabase.from("activity_logs").insert({
    event_type: eventType,
    actor_email: actorEmail,
    target_type: targetType,
    target_id: targetId,
    message,
  });
}

export async function getPendingLocationReviewCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("location_review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
