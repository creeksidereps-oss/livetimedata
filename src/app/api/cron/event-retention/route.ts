// src/app/api/cron/event-retention/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

/**
 * Daily Event Retention Worker.
 *
 * Retention policy (see GEMINI.md → Event Retention Policy):
 *  - Sale-type listings (yard / garage / car boot / rummage / tag / moving / estate sales,
 *    flea markets, auctions): deleted 7 days after the event date.
 *  - All other events: kept for 18 months after the event date, then deleted.
 *
 * Pass ?dryRun=1 to only report counts without deleting.
 * If CRON_SECRET is set, requires `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically).
 */
const SALE_CATEGORY_RE = "(yard|garage|boot sale|car boot|rummage|tag sale|moving sale|estate sale|flea|auction)";
const SALE_TITLE_RE = "(yard sale|garage sale|car boot|boot sale|rummage sale|tag sale|moving sale|estate sale|flea market|auction)";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    if (dryRun) {
      const { rows } = await sql.query(
        `SELECT
           COUNT(*) FILTER (WHERE event_date < NOW() - INTERVAL '7 days'
             AND (category ~* $1 OR title ~* $2)) AS sales_expired,
           COUNT(*) FILTER (WHERE event_date < NOW() - INTERVAL '18 months') AS events_expired
         FROM events`,
        [SALE_CATEGORY_RE, SALE_TITLE_RE]
      );
      return NextResponse.json({ success: true, dryRun: true, ...rows[0] });
    }

    const sales = await sql.query(
      `DELETE FROM events
       WHERE event_date < NOW() - INTERVAL '7 days'
         AND (category ~* $1 OR title ~* $2)`,
      [SALE_CATEGORY_RE, SALE_TITLE_RE]
    );
    const old = await sql.query(
      `DELETE FROM events WHERE event_date < NOW() - INTERVAL '18 months'`
    );

    return NextResponse.json({
      success: true,
      salesDeleted: sales.rowCount ?? 0,
      eventsDeleted: old.rowCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Event retention error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
