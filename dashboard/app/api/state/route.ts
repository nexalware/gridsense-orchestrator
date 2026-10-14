import { NextResponse } from "next/server";
import { toClientError } from "@/lib/server/errors";
import { getSnapshot } from "@/lib/server/state";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** GET /api/state: one snapshot of grid, battery and loads, read from oneM2M. */
export async function GET() {
  try {
    return NextResponse.json(await getSnapshot(), { headers: noStore });
  } catch (error) {
    const { body, status } = toClientError(error);
    return NextResponse.json(body, { status, headers: noStore });
  }
}
