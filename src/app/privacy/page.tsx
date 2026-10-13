import React from "react";
import CompliancePageLayout from "@/components/CompliancePageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "LiveTimeData Privacy Policy explaining data collection, use, advertising practices, cookies, and privacy rights.",
  alternates: {
    canonical: "https://www.livetimedata.com/privacy",
  },
  openGraph: {
    title: "LiveTimeData Privacy Policy",
    description: "LiveTimeData Privacy Policy explaining data collection, use, advertising practices, cookies, and privacy rights.",
    url: "https://www.livetimedata.com/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <CompliancePageLayout title="LiveTimeData Privacy Policy">
      <div className="space-y-5 text-[12px] md:text-[13px] leading-relaxed">
        <p className="font-bold text-slate-400">Effective Date: August 29, 2026</p>
        <p>This Privacy Policy explains how LiveTimeData ("LiveTimeData," "we," "us," or "our") collects, uses, stores, discloses, and otherwise processes information when you access or use LiveTimeData websites, mobile web experiences, submission forms, features, content, communications, and related services (collectively, the "Service").</p>
        <p>LiveTimeData is currently operated from North Carolina, United States.</p>
        <p>By using the Service, you acknowledge the practices described in this Privacy Policy.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">1. INFORMATION WE MAY COLLECT</h3>
        <p>The information LiveTimeData collects or processes depends on how you interact with the Service.</p>
        
        <h4 className="font-bold text-slate-300 mt-4 mb-2">A. INFORMATION YOU PROVIDE</h4>
        <p>You may voluntarily provide information including your name or contributor name; email address and other contact information; organization, school, venue, group, event, or business information; city reports, local information, facts, stories, history, myths, legends, recommendations, or survey responses; photographs, images, captions, and other submitted media; event information, schedules, descriptions, links, and supporting materials; webcam links, camera information, and source information; URLs, references, and supporting sources; suggestions, questions, corrections, complaints, and removal requests; advertising, sponsorship, or partnership inquiries; contest, promotion, or community-program information; parent, guardian, educator, or school information when an authorized minor or educational process requires it; and other information you voluntarily submit or communicate to LiveTimeData.</p>
        <p>Please do not provide sensitive personal information unless LiveTimeData specifically requests it and the information is reasonably necessary for the applicable purpose.</p>

        <h4 className="font-bold text-slate-300 mt-4 mb-2">B. SEARCH AND INTERACTION INFORMATION</h4>
        <p>When you use LiveTimeData, we may process information concerning your interactions with the Service, including city or place searches; selected cities, regions, or countries; pages or features viewed or used; links or controls selected; general usage patterns; preferences associated with your use of the Service; submission or form interactions; and other information reasonably necessary to operate, maintain, understand, or improve the Service.</p>
        <p>A city or place that you search for or view does not necessarily represent your actual physical location.</p>

        <h4 className="font-bold text-slate-300 mt-4 mb-2">C. TECHNICAL INFORMATION</h4>
        <p>When you access LiveTimeData, we and service providers working on our behalf may automatically receive or process technical information such as Internet Protocol (IP) address or network information; browser type; device type; operating system; requested pages and URLs; date and time of requests; referring or originating pages; approximate geographic information derived from technical information where permitted; diagnostic information; performance information; security information; error information; advertising-related information; consent or privacy-choice information; and general usage and interaction information.</p>
        <p>The exact technical information processed may change as LiveTimeData's technology, features, and service providers evolve.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">2. COOKIES, LOCAL STORAGE, AND SIMILAR TECHNOLOGIES</h3>
        <p>LiveTimeData and third parties providing services to LiveTimeData may use cookies, browser local storage, pixels, tags, scripts, identifiers, or similar technologies.</p>
        <p>These technologies may be used to operate website features, remember preferences, maintain functionality, measure traffic and performance, understand how the Service is used, detect errors or security problems, prevent fraud or abuse, support advertising, measure advertising, remember privacy or consent choices, and improve the Service.</p>
        <p>For example, browser storage may be used to remember preferences such as time-display format, temperature units, or similar display choices.</p>
        <p>Where applicable law requires consent before certain nonessential technologies are used, LiveTimeData will provide an appropriate consent or privacy-choice mechanism.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">3. HOW WE MAY USE INFORMATION</h3>
        <p>LiveTimeData may use information to provide, operate, maintain, secure, and improve the Service; process searches and provide city or location-related information; remember user preferences; personalize or improve functionality where appropriate; receive and administer Submissions; review, organize, moderate, edit, analyze, verify, classify, summarize, compile, or otherwise process submitted material; create, prepare, revise, or improve LiveTimeData content; communicate with contributors; respond to questions, requests, corrections, complaints, or removal requests; communicate concerning events, listings, photographs, webcams, businesses, attractions, or other information; send submission confirmations or publication-related notices; request clarification or additional information; administer contests, promotions, surveys, community projects, contributor programs, educational initiatives, or similar activities; communicate about advertising, sponsorships, partnerships, or business opportunities; conduct lawful outreach; send promotional, informational, or other communications as permitted by applicable law; detect, investigate, and prevent fraud, spam, abuse, malicious submissions, security threats, or technical problems; maintain records concerning submissions, permissions, licenses, policy acceptance, complaints, corrections, and removal requests; enforce our Terms of Service, Submission Terms, and other policies; comply with legal requirements; protect the rights, property, security, and safety of LiveTimeData, our users, contributors, third parties, and the public; provide, manage, and measure advertising, sponsorship, affiliate, or other commercial programs; conduct analytics, research, performance measurement, and product development; establish, exercise, or defend legal claims; and maintain appropriate business and compliance records.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">4. AUTOMATED AND AI-ASSISTED PROCESSING</h3>
        <p>LiveTimeData may use automated systems or artificial intelligence to assist with activities including content moderation, classification, organization, analysis, summarization, editing, translation, compilation, content generation, content preparation, quality review, detecting inappropriate or malicious material, processing submissions, improving existing information, and other operational or editorial functions.</p>
        <p>Automated systems can make mistakes.</p>
        <p>LiveTimeData does not represent that automated processing independently verifies the truth, accuracy, ownership, legality, or reliability of information.</p>
        <p>Information submitted to LiveTimeData may be processed by third-party service providers that perform automated, artificial-intelligence, infrastructure, moderation, security, or related services on our behalf.</p>
        <p>LiveTimeData may change the technologies or providers used for these purposes without revising this Privacy Policy solely to identify a particular technology provider, except where more specific disclosure is required by applicable law or another obligation.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">5. THIRD-PARTY SERVICE PROVIDERS</h3>
        <p>LiveTimeData uses third parties to help operate, support, improve, secure, distribute, and monetize the Service.</p>
        <p>Depending on the Service and feature involved, these third parties may include categories such as website hosting and infrastructure providers; database and data-storage providers; content-delivery providers; security and fraud-prevention providers; diagnostics and performance providers; analytics and measurement providers; advertising and advertising-measurement providers; consent-management and privacy-choice providers; mapping and geographic-information providers; weather and other information providers; data and media providers; artificial-intelligence and automated-processing providers; email and communications providers; customer-service and outreach providers; contractors, consultants, editors, moderators, and other professional service providers; printing, publishing, distribution, syndication, promotional, or fulfillment providers; payment or transaction providers if payment features are introduced; and other providers reasonably necessary to operate or support LiveTimeData.</p>
        <p>These providers may process information on our behalf or, in some circumstances, under their own privacy policies and legal obligations.</p>
        <p>LiveTimeData may change service providers as the Service evolves.</p>
        <p>We do not publish a complete inventory of our technology providers, infrastructure, or internal systems unless disclosure is required by applicable law, contractual obligation, consent requirements, or another applicable requirement.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">6. OTHER WAYS INFORMATION MAY BE DISCLOSED</h3>
        <p>In addition to service providers, LiveTimeData may disclose information when you direct or authorize us to do so; to a person or organization involved in a Submission when reasonably necessary to investigate, verify, correct, administer, or resolve the Submission; to publishing, distribution, syndication, promotional, advertising, production, or other partners when reasonably necessary for an authorized use of submitted material or a specific program; to professional advisers, including attorneys, accountants, insurers, consultants, or similar advisers; to courts, regulators, law-enforcement agencies, governmental authorities, or other parties when we reasonably believe disclosure is required or permitted by law; when reasonably necessary to investigate fraud, abuse, security incidents, infringement, or violations of our policies; when reasonably necessary to protect rights, property, safety, or security; or in connection with a merger, financing, investment, acquisition, reorganization, bankruptcy, sale, transfer, or other transaction involving all or part of LiveTimeData or its assets.</p>
        <p>If ownership or operation of LiveTimeData changes, information may be transferred to a successor or acquiring party subject to applicable law.</p>
        <p>LiveTimeData does not characterize personal information as property that LiveTimeData "owns."</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">7. ADVERTISING AND COMMERCIAL RELATIONSHIPS</h3>
        <p>LiveTimeData may display advertising and may participate in sponsorship, affiliate, referral, promotional, or other commercial programs.</p>
        <p>Advertising and related service providers may process information such as cookies or similar identifiers, device and browser information, IP or network information, approximate location information, pages viewed, interactions with advertisements, advertising identifiers where available, consent and privacy choices, and other information permitted by applicable law.</p>
        <p>Such information may be used to provide, limit, personalize, select, deliver, measure, secure, or report advertising.</p>
        <p>Where applicable law requires consent or an opportunity to opt out of certain advertising-related processing, LiveTimeData will provide or support an appropriate mechanism.</p>
        <p>Advertisements, affiliate links, and sponsored content may lead to third-party websites or services governed by their own privacy practices.</p>

        <h4 className="font-bold text-slate-300 mt-4 mb-2">GOOGLE ADSENSE AND THIRD-PARTY ADVERTISING VENDORS</h4>
        <p>LiveTimeData uses Google AdSense and may partner with other third-party advertising networks to serve advertisements when you visit our website.</p>
        <p>Third-party vendors, including Google, use cookies (including the DoubleClick cookie or similar advertising identifiers) to serve ads based on a user's prior visits to LiveTimeData or other websites on the Internet. Google's use of advertising cookies enables it and its partners to serve ads to users based on their visits to LiveTimeData and/or other sites across the Internet.</p>
        <p>Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">Google Ads Settings</a>. Alternatively, users may opt out of a third-party vendor's use of cookies for personalized advertising by visiting the Network Advertising Initiative consumer opt-out page at <a href="https://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">optout.networkadvertising.org</a> or the Digital Advertising Alliance choice tool at <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">aboutads.info/choices</a>.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">8. COMMUNICATIONS AND EMAIL</h3>
        <p>If you provide an email address or other contact information to LiveTimeData, we may use it to respond to you; administer or follow up on a Submission; request additional information; request clarification; communicate about events or listings; communicate concerning photographs, webcams, reports, corrections, or other submitted material; provide notices concerning material you submitted; communicate concerning an organization, event, business, or project associated with your inquiry; administer contests or promotions; invite participation in surveys; invite participation in community or educational projects; communicate about contributor opportunities; communicate about advertising, sponsorship, or partnerships; provide service-related communications; conduct outreach; or send promotional, informational, or other communications as permitted by applicable law.</p>
        <p>Where required by law, LiveTimeData will obtain any additional consent required for promotional communications.</p>
        <p>Commercial or promotional email will include any opt-out or unsubscribe mechanism required by applicable law.</p>
        <p>You may request that LiveTimeData stop sending nonessential promotional communications by using an available unsubscribe method or by contacting:</p>
        <p className="font-bold">LiveTimeData@gmail.com</p>
        <p>We may retain information reasonably necessary to maintain a suppression or do-not-contact record so that we can honor your request.</p>
        <p>An opt-out from promotional communications does not necessarily prevent LiveTimeData from sending communications reasonably necessary to respond to an active request; administer a Submission; administer a transaction, contest, or program; respond to a legal request; address security, fraud, or abuse; provide legally required notices; honor or document your opt-out; or otherwise communicate as permitted by law.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">9. SUBMISSIONS AND PUBLIC DISPLAY</h3>
        <p>Contact information supplied with a Submission is not intended to be publicly displayed unless you authorize public display, you intentionally submit it for public display, public display is reasonably apparent from the nature of the Submission, or disclosure is otherwise permitted or required by law.</p>
        <p>The content of a Submission itself may be published, edited, adapted, combined, promoted, distributed, or otherwise used as described in the LiveTimeData Submission Terms.</p>
        <p>LiveTimeData may retain information concerning the contributor, source, permissions, date submitted, terms accepted, communications, or other information reasonably necessary to administer or document the Submission.</p>
        <p>Before submitting photographs or other files, you should remove information that you do not want disclosed.</p>
        <p>LiveTimeData may remove or alter metadata from publicly displayed copies, but we do not guarantee that every hidden or embedded piece of information will be detected or removed.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">10. CHILDREN AND MINORS</h3>
        <p>LiveTimeData is a general-audience service.</p>
        <p>Children under 13 may not directly provide personal information or Submissions through ordinary LiveTimeData forms.</p>
        <p>A parent or legal guardian, or an educational process specifically established or authorized by LiveTimeData and structured to comply with applicable requirements, must act on behalf of a child under 13.</p>
        <p>Users ages 13 through 17 may be subject to parent or guardian permission requirements.</p>
        <p>LiveTimeData may establish additional requirements for school programs, educator programs, classroom activities, contests, youth programs, student submissions, or other activities involving minors.</p>
        <p>LiveTimeData seeks to minimize unnecessary collection of personal information concerning children.</p>
        <p>If you are a parent or guardian and believe a child under 13 has directly provided personal information to LiveTimeData in a manner inconsistent with this Privacy Policy, please contact:</p>
        <p className="font-bold">LiveTimeData@gmail.com</p>
        <p>Please identify the situation sufficiently for us to investigate it.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">11. INFORMATION CONCERNING OTHER PEOPLE</h3>
        <p>Do not submit another person's private personal information unless you have an appropriate reason and legal authority to provide it.</p>
        <p>If you submit photographs, stories, event materials, reports, or other content involving other people, you are responsible for complying with the representations and permission requirements contained in the LiveTimeData Submission Terms.</p>
        <p>LiveTimeData may remove, restrict, edit, or decline to publish information concerning another person when we believe doing so is appropriate.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">12. RETENTION</h3>
        <p>LiveTimeData retains information for as long as reasonably necessary for the purposes described in this Privacy Policy.</p>
        <p>Retention may be necessary to operate and improve the Service; administer submissions; maintain contributor and source records; document permissions and licenses; administer contests, promotions, or programs; respond to requests or complaints; maintain correction and removal records; investigate fraud, abuse, or security issues; enforce agreements and policies; maintain legally required records; comply with contractual obligations; establish, exercise, or defend legal claims; maintain suppression and do-not-contact lists; or maintain reasonable business records.</p>
        <p>Retention periods may vary according to the type of information, purpose, applicable law, contractual requirements, technical systems, and operational needs.</p>
        <p>A request to remove content from public display does not necessarily require deletion of internal records reasonably needed to document permissions, prior authorized uses, complaints, legal compliance, security, fraud prevention, or disputes.</p>
        <p>Information may also remain temporarily in backups or other systems until those systems are overwritten or retired through ordinary processes.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">13. SECURITY</h3>
        <p>LiveTimeData uses administrative, technical, and organizational measures that we consider appropriate for the nature of the information processed and the Service being provided.</p>
        <p>However, no website, database, network, transmission method, storage system, or security measure can be guaranteed to be completely secure.</p>
        <p>LiveTimeData therefore does not guarantee absolute security or that unauthorized access, disclosure, alteration, loss, or misuse can never occur.</p>
        <p>You should use reasonable care when deciding what information to submit online.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">14. INTERNATIONAL USE AND PROCESSING</h3>
        <p>LiveTimeData is designed to provide information concerning locations around the world and may be accessed internationally.</p>
        <p>Information may be processed in the United States and in other countries where LiveTimeData or its service providers operate.</p>
        <p>Privacy and data-protection requirements vary by jurisdiction.</p>
        <p>Where applicable law imposes additional requirements concerning international processing or transfers, LiveTimeData will take measures required by applicable law.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">15. YOUR PRIVACY RIGHTS AND CHOICES</h3>
        <p>Depending on where you live and applicable law, you may have certain rights concerning your personal information.</p>
        <p>These may include rights to request access to certain personal information; correction of inaccurate personal information; deletion of certain personal information; information concerning certain processing or disclosures; restriction of certain processing; portability of certain information; objection to certain processing; withdrawal of consent where processing is based on consent; or opt-out from certain advertising, profiling, sharing, or similar activities where applicable.</p>
        <p>These rights are not absolute and may be subject to legal exceptions, verification requirements, and limitations.</p>
        <p>To submit a privacy request, contact:</p>
        <p className="font-bold">LiveTimeData@gmail.com</p>
        <p>Please describe your request sufficiently for us to understand and respond to it.</p>
        <p>We may request information reasonably necessary to verify your identity, residency, authority, or relationship to the information before fulfilling a request.</p>
        <p>We will not unlawfully discriminate against a person for exercising applicable privacy rights.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">16. COOKIE AND PRIVACY CHOICES</h3>
        <p>Where available, you may manage certain privacy preferences through LiveTimeData cookie or consent controls, privacy-choice controls provided through the Service, browser settings, device settings, advertising preference tools, clearing cookies or browser storage, or unsubscribe mechanisms in promotional communications.</p>
        <p>Disabling certain storage technologies may affect website preferences or functionality.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">17. THIRD-PARTY WEBSITES AND SERVICES</h3>
        <p>LiveTimeData may link to or embed third-party websites, maps, media, advertisements, businesses, ticket sellers, event organizers, webcam operators, or other services.</p>
        <p>Third parties may collect or process information independently under their own terms and privacy policies.</p>
        <p>LiveTimeData does not control the privacy, security, data-retention, or other practices of independent third parties.</p>
        <p>You should review the privacy practices of third-party services when appropriate.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">18. BUSINESS TRANSFERS</h3>
        <p>If LiveTimeData is reorganized, incorporated, transferred to a company or other entity, sold, merged, financed, or involved in another business transaction, information associated with the Service may be transferred as part of that transaction as permitted by applicable law.</p>
        <p>A successor operator may continue to process information consistently with this Privacy Policy unless additional notice or consent is required by law.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">19. LEGAL REQUESTS AND PROTECTION OF RIGHTS</h3>
        <p>LiveTimeData may preserve, use, or disclose information when we reasonably believe doing so is necessary or appropriate to comply with applicable law, respond to lawful legal process, respond to governmental or regulatory requests, investigate suspected violations of our Terms or policies, investigate fraud, abuse, security incidents, or infringement, protect LiveTimeData, users, contributors, third parties, or the public, or establish, exercise, or defend legal claims.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">20. CHANGES TO THIS PRIVACY POLICY</h3>
        <p>LiveTimeData may update this Privacy Policy as the Service, technology, business, laws, or practices evolve.</p>
        <p>The Effective Date at the beginning of this Policy identifies the current version.</p>
        <p>Where required by applicable law, we may provide additional notice or obtain consent concerning material changes.</p>
        <p>We encourage users to review this Privacy Policy periodically.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">21. CONTACT INFORMATION</h3>
        <p>For privacy questions, privacy-rights requests, concerns about personal information, or other privacy matters, contact:</p>
        <p className="font-bold">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States<br /><br />Email: LiveTimeData@gmail.com</p>
      </div>
    </CompliancePageLayout>
  );
}
