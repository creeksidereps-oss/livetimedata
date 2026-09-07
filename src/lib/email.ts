import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SES_SMTP_HOST || "email-smtp.us-east-1.amazonaws.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SES_SMTP_USERNAME || "",
    pass: process.env.SES_SMTP_PASSWORD || "",
  },
});

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    const fromAddress = process.env.SES_FROM_ADDRESS || "events@livetimedata.com";
    
    const info = await transporter.sendMail({
      from: `"LiveTimeData Events" <${fromAddress}>`,
      to,
      subject,
      html,
    });
    console.log("Email sent via SES: %s", info.messageId);
    return { ok: true };
  } catch (error) {
    console.error("Error sending email via SES:", error);
    return { ok: false, error };
  }
}
