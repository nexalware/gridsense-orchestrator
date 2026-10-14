import { NextResponse } from "next/server";
import { toClientError } from "@/lib/server/errors";
import { writeGridStatus } from "@/lib/server/state";

export const dynamic = "force-dynamic";

/**
 * POST /api/grid {"status":"ON"|"OFF"}
 *
 * The grid switch in the virtual factory acts as the grid sensor: it writes a
 * new <contentInstance> to grid-sensor/grid-status. It changes no load; the
 * Orchestrator reacts to the new grid status through oneM2M.
 */
export async function POST(request: Request) {
  let status: unknown;
  try {
    status = ((await request.json()) as { status?: unknown }).status;
  } catch {
    status = undefined;
  }
  if (status !== "ON" && status !== "OFF") {
    return NextResponse.json({ error: 'Body must be {"status":"ON"} or {"status":"OFF"}' }, { status: 400 });
  }

  try {
    return NextResponse.json(await writeGridStatus(status), { status: 201 });
  } catch (error) {
    const { body, status: httpStatus } = toClientError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}
