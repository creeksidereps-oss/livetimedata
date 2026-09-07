import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET() {
  try {
    // 1. Email Contacts
    await sql`
      CREATE TABLE IF NOT EXISTS email_contacts (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        category TEXT NOT NULL,
        city_name TEXT,
        state_name TEXT,
        country_code TEXT,
        status TEXT DEFAULT 'active',
        source TEXT DEFAULT 'Manual Import',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // 2. Email Campaigns
    await sql`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        html_content TEXT NOT NULL,
        target_category TEXT,
        target_state TEXT,
        status TEXT DEFAULT 'draft',
        scheduled_for TIMESTAMP,
        sent_count INTEGER DEFAULT 0,
        bounce_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // 3. Email Logs
    await sql`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER,
        contact_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        aws_message_id TEXT,
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // 4. Photos
    await sql`
      CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        city_name TEXT NOT NULL,
        state_name TEXT,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        source TEXT DEFAULT 'User Submission',
        photographer_name TEXT,
        rights_released BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'pending_review',
        view_count INTEGER DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    return NextResponse.json({ ok: true, message: "Database Tables initialized successfully." });
  } catch (error: any) {
    console.error("Failed to initialize database tables:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
