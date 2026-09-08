export type ReviewApiPayload = {
  success?: boolean;
  error?: string;
  results?: Array<{
    id?: string;
    ok?: boolean;
    error?: string;
  }>;
};

export function isReviewSuccess(responseOk: boolean, payload: ReviewApiPayload) {
  return responseOk && payload.success === true;
}

export function reviewFailureMessage(payload: ReviewApiPayload, fallback = "Action failed."): string {
  const fromRows = (payload.results ?? [])
    .filter((row) => row?.ok === false)
    .map((row) => (row.error || "").trim())
    .filter(Boolean);
  const primary = (payload.error || "").trim();
  const parts = [primary, ...fromRows].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join("\n") : fallback;
}
