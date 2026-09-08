export type ReviewRowResult = {
  id: string;
  ok: boolean;
  error?: string;
};

export type ReviewLoopBody = {
  success: boolean;
  results: ReviewRowResult[];
  error?: string;
};

export function buildReviewLoopResponse(results: ReviewRowResult[]): {
  status: number;
  body: ReviewLoopBody;
} {
  const failed = results.filter((item) => !item.ok);
  const success = failed.length === 0;
  return {
    status: success ? 200 : 422,
    body: {
      success,
      results,
      error: failed[0]?.error,
    },
  };
}
