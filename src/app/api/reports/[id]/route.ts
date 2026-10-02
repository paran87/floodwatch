import { NextRequest, NextResponse } from "next/server";
import { auth, canPerform } from "@/lib/auth";
import { getReport, updateReport } from "@/lib/api";
import type { ApiResponse } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    return NextResponse.json<ApiResponse<never>>({ success: false, message: "Report not found.", code: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json<ApiResponse<typeof report>>({ success: true, data: report });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json<ApiResponse<never>>({ success: false, message: "Sign in required.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!canPerform(session.user.role, "canEdit")) {
    return NextResponse.json<ApiResponse<never>>({ success: false, message: "Your role cannot edit reports.", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json();
  try {
    const report = await updateReport(id, body, session.user.email);
    return NextResponse.json<ApiResponse<typeof report>>({ success: true, data: report });
  } catch (err) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, message: err instanceof Error ? err.message : "Failed to update report.", code: "VALIDATION_FAILURE" },
      { status: 400 },
    );
  }
}
