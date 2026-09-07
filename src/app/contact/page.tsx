import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 bg-black min-h-screen text-slate-300">
      <Link href="/" className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors mb-8">
        <ArrowLeft size={14} className="mr-2" />
        Back to Home
      </Link>
      
      <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">Contact LiveTimeData</h1>
      
      <div className="mt-8 space-y-5 text-[12px] md:text-[13px] leading-relaxed">
        <p>We welcome questions, suggestions, corrections, content concerns, partnership inquiries, advertising inquiries, and other messages relating to LiveTimeData.</p>
        <p>Email:</p>
        <p className="font-bold text-white">LiveTimeData@gmail.com</p>
        <p>Mail:</p>
        <p className="font-bold text-white">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">GENERAL QUESTIONS AND FEEDBACK</h3>
        <p>For general questions, suggestions, feedback, or requests concerning LiveTimeData, please contact us by email.</p>
        <p>When possible, include the relevant city, page, feature, or URL so we can better understand your message.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">CORRECTIONS AND INFORMATION UPDATES</h3>
        <p>If you believe information on LiveTimeData is incorrect, outdated, incomplete, or associated with the wrong city, business, attraction, event, webcam, photograph, or other listing, please contact us.</p>
        <p>Please include the page or URL involved and explain what you believe should be corrected.</p>
        <p>LiveTimeData may review the information and may correct, update, replace, clarify, or remove material when appropriate.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">CONTENT AND REMOVAL REQUESTS</h3>
        <p>If you believe content appearing on LiveTimeData should be removed or restricted because of ownership, privacy, publicity, accuracy, safety, or another legitimate concern, please contact us at:</p>
        <p className="font-bold text-white">LiveTimeData@gmail.com</p>
        <p>Please identify the material, provide the applicable page or URL where possible, explain the reason for your request, and provide information reasonably sufficient for us to evaluate it.</p>
        <p>LiveTimeData may request reasonable evidence of identity, ownership, authority, or other rights before acting on a request.</p>
        <p>Submission-removal requests and other content-removal matters are also governed by the LiveTimeData Terms of Service.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">COPYRIGHT CONCERNS</h3>
        <p>If you believe material appearing on LiveTimeData infringes your copyright, please send your complaint to:</p>
        <p className="font-bold text-white">LiveTimeData@gmail.com</p>
        <p>You may also mail correspondence to:</p>
        <p className="font-bold text-white">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States</p>
        <p>Please review the Copyright and Intellectual Property provisions in our Terms of Service for the information that should be included with a copyright complaint.</p>
        <p>LiveTimeData does not currently represent that the contact listed above is a Copyright Office-registered DMCA designated agent.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">EVENTS, PHOTOS, WEBCAMS, AND COMMUNITY INFORMATION</h3>
        <p>Where LiveTimeData provides a dedicated submission form for events, photographs, webcams, city information, local facts, or other community content, please use the appropriate form when practical.</p>
        <p>Submission through a form or by email does not guarantee publication, placement, attribution, response, or compensation.</p>
        <p>Submissions are governed by the LiveTimeData Terms of Service and Privacy Policy.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">ADVERTISING, SPONSORSHIPS, AND PARTNERSHIPS</h3>
        <p>For advertising, sponsorship, promotional, distribution, content, community, or other partnership inquiries, contact:</p>
        <p className="font-bold text-white">LiveTimeData@gmail.com</p>
        <p>Please include your organization name, contact information, and a brief description of the opportunity or request.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">PRIVACY QUESTIONS</h3>
        <p>Questions or requests relating to personal information or privacy may be sent to:</p>
        <p className="font-bold text-white">LiveTimeData@gmail.com</p>
        <p>Please include enough information for us to understand and reasonably evaluate your request.</p>
        <p>We may need to verify identity or authority before completing certain privacy requests.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">ACCESSIBILITY</h3>
        <p>If you experience difficulty accessing any part of LiveTimeData, please contact us and describe the page, feature, or issue involved.</p>
        <p>LiveTimeData aims to make the Service usable by as many people as reasonably possible and may use accessibility reports to improve the site.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">SECURITY CONCERNS</h3>
        <p>If you believe you have identified a security issue involving LiveTimeData, please contact:</p>
        <p className="font-bold text-white">LiveTimeData@gmail.com</p>
        <p>Please provide enough information for us to understand and investigate the concern.</p>
        <p>Do not intentionally access, alter, destroy, download, disclose, or interfere with data or systems that you are not authorized to access.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">RESPONSE TIMES</h3>
        <p>LiveTimeData reviews messages as reasonably practical, but we do not guarantee a particular response time or that every message will receive an individual response.</p>
        <p>Urgent safety, emergency, law-enforcement, medical, weather, or other emergency matters should be directed to the appropriate emergency service or responsible authority rather than LiveTimeData.</p>
      </div>
    </div>
  );
}
