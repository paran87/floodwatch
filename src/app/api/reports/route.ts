import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReports, createReport } from "@/lib/api";
import { canPerform } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const result = await getReports({
      search: params.get("search") ?? undefined,
      status: (params.get("status") as never) ?? undefined,
      severity: (params.get("severity") as never) ?? undefined,
      region: params.get("region") ?? undefined,
      province: params.get("province") ?? undefined,
      page: params.get("page") ? Number(params.get("page")) : undefined,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
    });
    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, message: err instanceof Error ? err.message : "Failed to load reports.", code: "REPORTS_FETCH_FAILED" },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json<ApiResponse<never>>({ success: false, message: "Sign in required.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!canPerform(session.user.role, "canCreate")) {
    return NextResponse.json<ApiResponse<never>>({ success: false, message: "Your role cannot create reports.", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json();
  try {
    const report = await createReport({ ...body, reportedBy: session.user.email });
    return NextResponse.json<ApiResponse<typeof report>>({ success: true, data: report }, { status: 201 });
  } catch (err) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, message: err instanceof Error ? err.message : "Failed to create report.", code: "VALIDATION_FAILURE" },
      { status: 400 },
    );
  }
}
