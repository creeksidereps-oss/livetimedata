import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const email = formData.get('email');
  const category = formData.get('category');
  const cityName = formData.get('cityName');

  // 1. Setup Email Transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'LiveTimeData@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD, // Use a secure App Password
    },
  });

  // 2. Draft the Moderation Email
  const mailOptions = {
    from: 'LiveTimeData System',
    to: 'LiveTimeData@gmail.com',
    subject: `MODERATION REQ: ${cityName} - ${category}`,
    html: `
      <div style="font-family: sans-serif; border: 2px solid #000; padding: 20px;">
        <h2 style="text-transform: uppercase;">New Photo Submission</h2>
        <p><strong>City:</strong> ${cityName}</p>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>User:</strong> ${email}</p>
        <hr />
        <div style="margin: 20px 0;">
          <a href="https://livetimedata.com/api/approve?id=temp_id" style="background: #22c55e; color: #fff; padding: 15px 25px; text-decoration: none; border-radius: 10px; font-weight: 900; margin-right: 10px;">APPROVE & POST</a>
          <a href="https://livetimedata.com/api/reject?id=temp_id" style="background: #ef4444; color: #fff; padding: 15px 25px; text-decoration: none; border-radius: 10px; font-weight: 900;">REJECT</a>
        </div>
      </div>
    `,
    attachments: [{ filename: file.name, content: Buffer.from(await file.arrayBuffer()) }]
  };

  await transporter.sendMail(mailOptions);
  return NextResponse.json({ success: true });
}