import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const snsMessage = JSON.parse(rawBody);

    // If SNS is trying to confirm the subscription
    if (snsMessage.Type === "SubscriptionConfirmation") {
      // In production, you would fetch snsMessage.SubscribeURL to confirm
      console.log("SNS Subscription Confirmation Received:", snsMessage.SubscribeURL);
      return NextResponse.json({ ok: true });
    }

    if (snsMessage.Type === "Notification") {
      const message = JSON.parse(snsMessage.Message);
      const notificationType = message.notificationType; // Bounce, Complaint, Delivery

      if (notificationType === "Bounce" || notificationType === "Complaint") {
        const bouncedRecipients = notificationType === "Bounce" ? message.bounce.bouncedRecipients : message.complaint.complainedRecipients;
        const awsMessageId = message.mail.messageId;

        for (const recipient of bouncedRecipients) {
          const email = recipient.emailAddress;

          // 1. Mark contact as bounced/complained
          await sql`
            UPDATE email_contacts 
            SET status = ${notificationType.toLowerCase()}, updated_at = NOW() 
            WHERE email = ${email}
          `;

          // 2. Update log
          await sql`
            UPDATE email_logs 
            SET status = ${notificationType.toLowerCase()} 
            WHERE aws_message_id = ${awsMessageId} AND email = ${email}
          `;

          // 3. Update campaign bounce count
          await sql`
            UPDATE email_campaigns c
            SET bounce_count = bounce_count + 1
            FROM email_logs l
            WHERE l.campaign_id = c.id AND l.aws_message_id = ${awsMessageId} AND l.email = ${email}
          `;
          
          console.log(`[SES WEBHOOK] Marked ${email} as ${notificationType}`);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("SES Webhook Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
