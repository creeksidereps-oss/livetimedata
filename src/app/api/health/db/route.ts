import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await sql`SELECT NOW() as now`;
    return NextResponse.json({
      ok: true,
      database: "connected",
      now: result.rows[0]?.now ?? null,
    });
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: string;
      name?: string;
      cause?: unknown;
      stack?: string;
    };

    return NextResponse.json(
      {
        ok: false,
        database: "disconnected",
        error: {
          name: err?.name ?? null,
          message: err?.message ?? null,
          code: err?.code ?? null,
          cause: err?.cause ?? null,
          stack: err?.stack ?? null,
        },
      },
      { status: 500 }
    );
  }
}