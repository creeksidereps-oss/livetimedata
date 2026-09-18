// src/app/api/admin/facts/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyFactWithAI } from "@/lib/facts/factVerifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin Fun Facts Moderation & Declined Vault API
 * 
 * GET:
 * - humanCurationQueue: Facts that AI could neither prove nor disprove
 * - declinedQueue: False/scam/policy violation records (6-month retention)
 * - stats: Counts across approved, pending, and declined
 * 
 * POST:
 * - action: 'verify_with_ai' -> Triggers AI search-grounded verification
 * - action: 'approve' -> Approves fact into live rotation
 * - action: 'reject' -> Moves to declined vault with reason
 */
export async function GET() {
  try {
    // 1. Facts requiring human curation (inconclusive AI audit or pending)
    const { rows: humanCurationQueue } = await sql`
      SELECT id, city_name, state_name, country_name, title, description, category, scope,
             source_attribution, contributed_by, status, ai_verification_notes, ai_grounded_sources, created_at
      FROM city_fun_facts
      WHERE is_approved = FALSE
      ORDER BY created_at DESC
      LIMIT 100
    `;

    // 2. Declined Vault (false, scams, spam - 6 month retention for legal hold & pattern tracking)
    const { rows: declinedQueue } = await sql`
      SELECT id, city_name, state_name, country_name, title, description, category,
             contributed_by, rejection_reason, ai_confidence, ai_notes, created_at, expires_at
      FROM city_fun_facts_declined
      ORDER BY created_at DESC
      LIMIT 100
    `;

    // 3. System Statistics
    const { rows: stats } = await sql`
      SELECT 
        (SELECT COUNT(*) FROM city_fun_facts WHERE is_approved = TRUE) as total_approved,
        (SELECT COUNT(*) FROM city_fun_facts WHERE is_approved = FALSE) as total_human_curation,
        (SELECT COUNT(*) FROM city_fun_facts_declined) as total_declined_retained
    `;

    return NextResponse.json({
      ok: true,
      humanCurationQueue,
      declinedQueue,
      stats: stats[0] || { total_approved: 0, total_human_curation: 0, total_declined_retained: 0 }
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { factId, action, reason } = body;

    // A. Verify with AI
    if (action === "verify_with_ai" && factId) {
      const { rows } = await sql`SELECT * FROM city_fun_facts WHERE id = ${factId} LIMIT 1`;
      if (rows.length === 0) return NextResponse.json({ ok: false, error: "Fact not found" }, { status: 404 });
      const fact = rows[0];

      const audit = await verifyFactWithAI(
        fact.city_name,
        fact.state_name || "",
        fact.country_name || "United States",
        fact.title,
        fact.description
      );

      if (audit.verdict === "APPROVED") {
        await sql`
          UPDATE city_fun_facts
          SET is_approved = TRUE,
              status = 'approved',
              title = ${audit.cleanTitle || fact.title},
              description = ${audit.cleanDescription || fact.description},
              ai_verification_notes = ${audit.reason},
              ai_grounded_sources = ${JSON.stringify(audit.sources)}
          WHERE id = ${factId}
        `;
        return NextResponse.json({
          ok: true,
          verdict: "APPROVED",
          message: `AI verified fact #${factId} as authentic. Approved into live rotation.`,
          audit
        });
      } else if (audit.verdict === "REJECTED") {
        // Log to declined DB (6-month hold) and delete from candidate pool
        await sql`
          INSERT INTO city_fun_facts_declined (
            city_name, state_name, country_name, title, description, category,
            source_attribution, contributed_by, rejection_reason, ai_confidence, ai_notes
          ) VALUES (
            ${fact.city_name}, ${fact.state_name}, ${fact.country_name}, ${fact.title}, ${fact.description},
            ${fact.category}, ${fact.source_attribution}, ${fact.contributed_by},
            ${audit.reason}, ${audit.confidence}, ${JSON.stringify(audit.sources)}
          )
        `;
        await sql`DELETE FROM city_fun_facts WHERE id = ${factId}`;
        return NextResponse.json({
          ok: true,
          verdict: "REJECTED",
          message: `AI determined fact #${factId} is false or non-compliant. Moved to 6-month declined hold.`,
          audit
        });
      } else {
        await sql`
          UPDATE city_fun_facts
          SET status = 'needs_human_curation',
              ai_verification_notes = ${audit.reason},
              ai_grounded_sources = ${JSON.stringify(audit.sources)}
          WHERE id = ${factId}
        `;
        return NextResponse.json({
          ok: true,
          verdict: "NEEDS_HUMAN_CURATION",
          message: `AI evaluation was inconclusive. Held over for human curation.`,
          audit
        });
      }
    }

    // B. Manual Admin Approve
    if (action === "approve" && factId) {
      await sql`
        UPDATE city_fun_facts
        SET is_approved = TRUE, status = 'approved'
        WHERE id = ${factId}
      `;
      return NextResponse.json({ ok: true, message: `Fact #${factId} manually approved into live rotation.` });
    }

    // C. Manual Admin Reject -> Route to 6-Month Declined Vault
    if (action === "reject" && factId) {
      const { rows } = await sql`SELECT * FROM city_fun_facts WHERE id = ${factId} LIMIT 1`;
      if (rows.length > 0) {
        const fact = rows[0];
        await sql`
          INSERT INTO city_fun_facts_declined (
            city_name, state_name, country_name, title, description, category,
            source_attribution, contributed_by, rejection_reason, ai_confidence, ai_notes
          ) VALUES (
            ${fact.city_name}, ${fact.state_name}, ${fact.country_name}, ${fact.title}, ${fact.description},
            ${fact.category}, ${fact.source_attribution}, ${fact.contributed_by},
            ${reason || 'Manually rejected by administrator'}, 100, 'Manual rejection'
          )
        `;
        await sql`DELETE FROM city_fun_facts WHERE id = ${factId}`;
      }
      return NextResponse.json({ ok: true, message: `Fact #${factId} rejected and logged to 6-month declined hold.` });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
