import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { checkTrialExpiry, checkPastDueExpiry } from "@/jobs/billing-crons";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await checkTrialExpiry();
    await checkPastDueExpiry();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[crons/billing] failed", { err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
