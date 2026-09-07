import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export const runtime = "nodejs";

const ses = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(req: Request) {
  try {
    // This route is intended to be called by a CRON job.
    // It picks the highest priority "sending" or "scheduled" campaign.
    
    // 1. Find active campaign
    const { rows: campaigns } = await sql`
      SELECT * FROM email_campaigns 
      WHERE status IN ('scheduled', 'sending') 
      AND (scheduled_for IS NULL OR scheduled_for <= NOW())
      ORDER BY id ASC LIMIT 1
    `;

    if (campaigns.length === 0) {
      return NextResponse.json({ ok: true, message: "No active campaigns found." });
    }

    const campaign = campaigns[0];

    // Mark as sending if it was scheduled
    if (campaign.status === 'scheduled') {
      await sql`UPDATE email_campaigns SET status = 'sending' WHERE id = ${campaign.id}`;
    }

    // 2. Fetch up to 50 recipients who haven't received this campaign yet and are active
    const { rows: contacts } = await sql`
      SELECT c.* FROM email_contacts c
      LEFT JOIN email_logs l ON l.contact_id = c.id AND l.campaign_id = ${campaign.id}
      WHERE c.status = 'active'
      AND (c.category = ${campaign.target_category} OR ${campaign.target_category} IS NULL)
      AND (c.state_name = ${campaign.target_state} OR ${campaign.target_state} IS NULL)
      AND l.id IS NULL
      LIMIT 50
    `;

    if (contacts.length === 0) {
      // Campaign finished
      await sql`UPDATE email_campaigns SET status = 'completed', updated_at = NOW() WHERE id = ${campaign.id}`;
      return NextResponse.json({ ok: true, message: `Campaign ${campaign.id} completed.` });
    }

    let sentThisBatch = 0;

    // 3. Send emails
    for (const contact of contacts) {
      try {
        // Send via AWS SES
        const command = new SendEmailCommand({
          Source: "noreply@livetimedata.com", // Ensure this is verified in SES
          Destination: { ToAddresses: [contact.email] },
          Message: {
            Subject: { Data: campaign.subject },
            Body: { Html: { Data: campaign.html_content } },
          },
          ConfigurationSetName: "LiveTimeDataTracking", // Ensure you have this setup if tracking bounces
        });

        const response = await ses.send(command);

        // Log it
        await sql`
          INSERT INTO email_logs (campaign_id, contact_id, email, aws_message_id)
          VALUES (${campaign.id}, ${contact.id}, ${contact.email}, ${response.MessageId})
        `;
        sentThisBatch++;
      } catch (err: any) {
        console.error(`Failed to send to ${contact.email}:`, err);
        // Log failure
        await sql`
          INSERT INTO email_logs (campaign_id, contact_id, email, status, error_message)
          VALUES (${campaign.id}, ${contact.id}, ${contact.email}, 'failed', ${err.message})
        `;
      }
    }

    // Update campaign stats
    await sql`
      UPDATE email_campaigns 
      SET sent_count = sent_count + ${sentThisBatch}, updated_at = NOW() 
      WHERE id = ${campaign.id}
    `;

    return NextResponse.json({ ok: true, sent: sentThisBatch, campaign: campaign.id });
  } catch (error: any) {
    console.error("Email processor error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
