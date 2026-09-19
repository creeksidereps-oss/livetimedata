"use client";

import React from 'react';
import { X } from 'lucide-react';

interface FooterModalProps {
  type: 'about' | 'contact' | 'privacy' | 'legal' | 'terms';
  onClose: () => void;
}

export default function FooterModal({ type, onClose }: FooterModalProps) {
  const contentMap = {
    about: {
      title: "About LiveTimeData",
      content: (
        <div className="space-y-4 text-slate-700 text-[11px] md:text-xs leading-relaxed">
          <p>LiveTimeData is a global city information and discovery website designed to make useful local information easier to find in one place.</p>
          <p>Our goal is simple: help people quickly explore cities and communities through information such as local time, weather, forecasts, events, webcams, photographs, maps, local facts, attractions, and other useful city information.</p>
          <p>LiveTimeData is continually expanding and improving its coverage. Information may come from a combination of public information, third-party data sources, community contributions, research, automated systems, artificial intelligence, and editorial work.</p>
          <p>Some information may initially be generated or compiled with automated or AI-assisted tools and may later be corrected, expanded, replaced, or improved using additional research and human-contributed information.</p>
          <p>We welcome contributions from people who know their communities. Visitors, organizations, event organizers, photographers, webcam owners and operators, businesses, educators, and community members may be able to submit information, photographs, events, corrections, suggestions, and other useful material for consideration.</p>
          <p>Submitting information does not guarantee publication, and LiveTimeData may edit, combine, summarize, verify, update, or decline material in accordance with our Terms of Service.</p>
          <p>Because cities and local information constantly change, LiveTimeData cannot guarantee that every piece of information is complete or current. Important information should always be confirmed with the appropriate official source, business, venue, organizer, or other authority.</p>
          <p>LiveTimeData is independently operated from North Carolina, United States.</p>
          <p>For questions, suggestions, corrections, partnerships, advertising inquiries, or other matters, please visit our Contact page or email:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>
          <p>Mail:</p>
          <p className="font-bold">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States</p>
        </div>
      )
    },
    contact: {
      title: "Contact LiveTimeData",
      content: (
        <div className="space-y-4 text-slate-700 text-[11px] md:text-xs leading-relaxed">
          <p>We welcome questions, suggestions, corrections, content concerns, partnership inquiries, advertising inquiries, and other messages relating to LiveTimeData.</p>
          <p>Email:</p>
          <p className="font-bold text-slate-900">LiveTimeData@gmail.com</p>
          <p>Mail:</p>
          <p className="font-bold text-slate-900">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">GENERAL QUESTIONS AND FEEDBACK</h3>
          <p>For general questions, suggestions, feedback, or requests concerning LiveTimeData, please contact us by email.</p>
          <p>When possible, include the relevant city, page, feature, or URL so we can better understand your message.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">CORRECTIONS AND INFORMATION UPDATES</h3>
          <p>If you believe information on LiveTimeData is incorrect, outdated, incomplete, or associated with the wrong city, business, attraction, event, webcam, photograph, or other listing, please contact us.</p>
          <p>Please include the page or URL involved and explain what you believe should be corrected.</p>
          <p>LiveTimeData may review the information and may correct, update, replace, clarify, or remove material when appropriate.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">CONTENT AND REMOVAL REQUESTS</h3>
          <p>If you believe content appearing on LiveTimeData should be removed or restricted because of ownership, privacy, publicity, accuracy, safety, or another legitimate concern, please contact us at:</p>
          <p className="font-bold text-slate-900">LiveTimeData@gmail.com</p>
          <p>Please identify the material, provide the applicable page or URL where possible, explain the reason for your request, and provide information reasonably sufficient for us to evaluate it.</p>
          <p>LiveTimeData may request reasonable evidence of identity, ownership, authority, or other rights before acting on a request.</p>
          <p>Submission-removal requests and other content-removal matters are also governed by the LiveTimeData Terms of Service.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">COPYRIGHT CONCERNS</h3>
          <p>If you believe material appearing on LiveTimeData infringes your copyright, please send your complaint to:</p>
          <p className="font-bold text-slate-900">LiveTimeData@gmail.com</p>
          <p>You may also mail correspondence to:</p>
          <p className="font-bold text-slate-900">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States</p>
          <p>Please review the Copyright and Intellectual Property provisions in our Terms of Service for the information that should be included with a copyright complaint.</p>
          <p>LiveTimeData does not currently represent that the contact listed above is a Copyright Office-registered DMCA designated agent.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">EVENTS, PHOTOS, WEBCAMS, AND COMMUNITY INFORMATION</h3>
          <p>Where LiveTimeData provides a dedicated submission form for events, photographs, webcams, city information, local facts, or other community content, please use the appropriate form when practical.</p>
          <p>Submission through a form or by email does not guarantee publication, placement, attribution, response, or compensation.</p>
          <p>Submissions are governed by the LiveTimeData Terms of Service and Privacy Policy.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">ADVERTISING, SPONSORSHIPS, AND PARTNERSHIPS</h3>
          <p>For advertising, sponsorship, promotional, distribution, content, community, or other partnership inquiries, contact:</p>
          <p className="font-bold text-slate-900">LiveTimeData@gmail.com</p>
          <p>Please include your organization name, contact information, and a brief description of the opportunity or request.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">PRIVACY QUESTIONS</h3>
          <p>Questions or requests relating to personal information or privacy may be sent to:</p>
          <p className="font-bold text-slate-900">LiveTimeData@gmail.com</p>
          <p>Please include enough information for us to understand and reasonably evaluate your request.</p>
          <p>We may need to verify identity or authority before completing certain privacy requests.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">ACCESSIBILITY</h3>
          <p>If you experience difficulty accessing any part of LiveTimeData, please contact us and describe the page, feature, or issue involved.</p>
          <p>LiveTimeData aims to make the Service usable by as many people as reasonably possible and may use accessibility reports to improve the site.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">SECURITY CONCERNS</h3>
          <p>If you believe you have identified a security issue involving LiveTimeData, please contact:</p>
          <p className="font-bold text-slate-900">LiveTimeData@gmail.com</p>
          <p>Please provide enough information for us to understand and investigate the concern.</p>
          <p>Do not intentionally access, alter, destroy, download, disclose, or interfere with data or systems that you are not authorized to access.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">RESPONSE TIMES</h3>
          <p>LiveTimeData reviews messages as reasonably practical, but we do not guarantee a particular response time or that every message will receive an individual response.</p>
          <p>Urgent safety, emergency, law-enforcement, medical, weather, or other emergency matters should be directed to the appropriate emergency service or responsible authority rather than LiveTimeData.</p>
        </div>
      )
    },
    privacy: {
      title: "Privacy Policy",
      content: (
        <div className="space-y-4 text-slate-700 text-[11px] md:text-xs leading-relaxed">
          <p className="font-bold text-slate-900">Effective Date: August 29, 2026</p>
          <p>This Privacy Policy explains how LiveTimeData ("LiveTimeData," "we," "us," or "our") collects, uses, stores, discloses, and otherwise processes information when you access or use LiveTimeData websites, mobile web experiences, submission forms, features, content, communications, and related services (collectively, the "Service").</p>
          <p>LiveTimeData is currently operated from North Carolina, United States.</p>
          <p>By using the Service, you acknowledge the practices described in this Privacy Policy.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">1. INFORMATION WE MAY COLLECT</h3>
          <p>The information LiveTimeData collects or processes depends on how you interact with the Service.</p>
          
          <h4 className="font-bold text-slate-800 mt-4 mb-1">A. INFORMATION YOU PROVIDE</h4>
          <p>You may voluntarily provide information including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>your name or contributor name;</li>
            <li>email address and other contact information;</li>
            <li>organization, school, venue, group, event, or business information;</li>
            <li>city reports, local information, facts, stories, history, myths, legends, recommendations, or survey responses;</li>
            <li>photographs, images, captions, and other submitted media;</li>
            <li>event information, schedules, descriptions, links, and supporting materials;</li>
            <li>webcam links, camera information, and source information;</li>
            <li>URLs, references, and supporting sources;</li>
            <li>suggestions, questions, corrections, complaints, and removal requests;</li>
            <li>advertising, sponsorship, or partnership inquiries;</li>
            <li>contest, promotion, or community-program information;</li>
            <li>parent, guardian, educator, or school information when an authorized minor or educational process requires it;</li>
            <li>other information you voluntarily submit or communicate to LiveTimeData.</li>
          </ul>
          <p>Please do not provide sensitive personal information unless LiveTimeData specifically requests it and the information is reasonably necessary for the applicable purpose.</p>

          <h4 className="font-bold text-slate-800 mt-4 mb-1">B. SEARCH AND INTERACTION INFORMATION</h4>
          <p>When you use LiveTimeData, we may process information concerning your interactions with the Service, including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>city or place searches;</li>
            <li>selected cities, regions, or countries;</li>
            <li>pages or features viewed or used;</li>
            <li>links or controls selected;</li>
            <li>general usage patterns;</li>
            <li>preferences associated with your use of the Service;</li>
            <li>submission or form interactions;</li>
            <li>other information reasonably necessary to operate, maintain, understand, or improve the Service.</li>
          </ul>
          <p>A city or place that you search for or view does not necessarily represent your actual physical location.</p>

          <h4 className="font-bold text-slate-800 mt-4 mb-1">C. TECHNICAL INFORMATION</h4>
          <p>When you access LiveTimeData, we and service providers working on our behalf may automatically receive or process technical information such as:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Internet Protocol (IP) address or network information;</li>
            <li>browser type;</li>
            <li>device type;</li>
            <li>operating system;</li>
            <li>requested pages and URLs;</li>
            <li>date and time of requests;</li>
            <li>referring or originating pages;</li>
            <li>approximate geographic information derived from technical information where permitted;</li>
            <li>diagnostic information;</li>
            <li>performance information;</li>
            <li>security information;</li>
            <li>error information;</li>
            <li>advertising-related information;</li>
            <li>consent or privacy-choice information;</li>
            <li>general usage and interaction information.</li>
          </ul>
          <p>The exact technical information processed may change as LiveTimeData's technology, features, and service providers evolve.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">2. COOKIES, LOCAL STORAGE, AND SIMILAR TECHNOLOGIES</h3>
          <p>LiveTimeData and third parties providing services to LiveTimeData may use cookies, browser local storage, pixels, tags, scripts, identifiers, or similar technologies.</p>
          <p>These technologies may be used to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>operate website features;</li>
            <li>remember preferences;</li>
            <li>maintain functionality;</li>
            <li>measure traffic and performance;</li>
            <li>understand how the Service is used;</li>
            <li>detect errors or security problems;</li>
            <li>prevent fraud or abuse;</li>
            <li>support advertising;</li>
            <li>measure advertising;</li>
            <li>remember privacy or consent choices;</li>
            <li>improve the Service.</li>
          </ul>
          <p>For example, browser storage may be used to remember preferences such as time-display format, temperature units, or similar display choices.</p>
          <p>Where applicable law requires consent before certain nonessential technologies are used, LiveTimeData will provide an appropriate consent or privacy-choice mechanism.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">3. HOW WE MAY USE INFORMATION</h3>
          <p>LiveTimeData may use information to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>provide, operate, maintain, secure, and improve the Service;</li>
            <li>process searches and provide city or location-related information;</li>
            <li>remember user preferences;</li>
            <li>personalize or improve functionality where appropriate;</li>
            <li>receive and administer Submissions;</li>
            <li>review, organize, moderate, edit, analyze, verify, classify, summarize, compile, or otherwise process submitted material;</li>
            <li>create, prepare, revise, or improve LiveTimeData content;</li>
            <li>communicate with contributors;</li>
            <li>respond to questions, requests, corrections, complaints, or removal requests;</li>
            <li>communicate concerning events, listings, photographs, webcams, businesses, attractions, or other information;</li>
            <li>send submission confirmations or publication-related notices;</li>
            <li>request clarification or additional information;</li>
            <li>administer contests, promotions, surveys, community projects, contributor programs, educational initiatives, or similar activities;</li>
            <li>communicate about advertising, sponsorships, partnerships, or business opportunities;</li>
            <li>conduct lawful outreach;</li>
            <li>send promotional, informational, or other communications as permitted by applicable law;</li>
            <li>detect, investigate, and prevent fraud, spam, abuse, malicious submissions, security threats, or technical problems;</li>
            <li>maintain records concerning submissions, permissions, licenses, policy acceptance, complaints, corrections, and removal requests;</li>
            <li>enforce our Terms of Service, Submission Terms, and other policies;</li>
            <li>comply with legal requirements;</li>
            <li>protect the rights, property, security, and safety of LiveTimeData, our users, contributors, third parties, and the public;</li>
            <li>provide, manage, and measure advertising, sponsorship, affiliate, or other commercial programs;</li>
            <li>conduct analytics, research, performance measurement, and product development;</li>
            <li>establish, exercise, or defend legal claims;</li>
            <li>maintain appropriate business and compliance records.</li>
          </ul>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">4. AUTOMATED AND AI-ASSISTED PROCESSING</h3>
          <p>LiveTimeData may use automated systems or artificial intelligence to assist with activities including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>content moderation;</li>
            <li>classification;</li>
            <li>organization;</li>
            <li>analysis;</li>
            <li>summarization;</li>
            <li>editing;</li>
            <li>translation;</li>
            <li>compilation;</li>
            <li>content generation;</li>
            <li>content preparation;</li>
            <li>quality review;</li>
            <li>detecting inappropriate or malicious material;</li>
            <li>processing submissions;</li>
            <li>improving existing information;</li>
            <li>other operational or editorial functions.</li>
          </ul>
          <p>Automated systems can make mistakes.</p>
          <p>LiveTimeData does not represent that automated processing independently verifies the truth, accuracy, ownership, legality, or reliability of information.</p>
          <p>Information submitted to LiveTimeData may be processed by third-party service providers that perform automated, artificial-intelligence, infrastructure, moderation, security, or related services on our behalf.</p>
          <p>LiveTimeData may change the technologies or providers used for these purposes without revising this Privacy Policy solely to identify a particular technology provider, except where more specific disclosure is required by applicable law or another obligation.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">5. THIRD-PARTY SERVICE PROVIDERS</h3>
          <p>LiveTimeData uses third parties to help operate, support, improve, secure, distribute, and monetize the Service.</p>
          <p>Depending on the Service and feature involved, these third parties may include categories such as:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>website hosting and infrastructure providers;</li>
            <li>database and data-storage providers;</li>
            <li>content-delivery providers;</li>
            <li>security and fraud-prevention providers;</li>
            <li>diagnostics and performance providers;</li>
            <li>analytics and measurement providers;</li>
            <li>advertising and advertising-measurement providers;</li>
            <li>consent-management and privacy-choice providers;</li>
            <li>mapping and geographic-information providers;</li>
            <li>weather and other information providers;</li>
            <li>data and media providers;</li>
            <li>artificial-intelligence and automated-processing providers;</li>
            <li>email and communications providers;</li>
            <li>customer-service and outreach providers;</li>
            <li>contractors, consultants, editors, moderators, and other professional service providers;</li>
            <li>printing, publishing, distribution, syndication, promotional, or fulfillment providers;</li>
            <li>payment or transaction providers if payment features are introduced;</li>
            <li>other providers reasonably necessary to operate or support LiveTimeData.</li>
          </ul>
          <p>These providers may process information on our behalf or, in some circumstances, under their own privacy policies and legal obligations.</p>
          <p>LiveTimeData may change service providers as the Service evolves.</p>
          <p>We do not publish a complete inventory of our technology providers, infrastructure, or internal systems unless disclosure is required by applicable law, contractual obligation, consent requirements, or another applicable requirement.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">6. OTHER WAYS INFORMATION MAY BE DISCLOSED</h3>
          <p>In addition to service providers, LiveTimeData may disclose information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>when you direct or authorize us to do so;</li>
            <li>to a person or organization involved in a Submission when reasonably necessary to investigate, verify, correct, administer, or resolve the Submission;</li>
            <li>to publishing, distribution, syndication, promotional, advertising, production, or other partners when reasonably necessary for an authorized use of submitted material or a specific program;</li>
            <li>to professional advisers, including attorneys, accountants, insurers, consultants, or similar advisers;</li>
            <li>to courts, regulators, law-enforcement agencies, governmental authorities, or other parties when we reasonably believe disclosure is required or permitted by law;</li>
            <li>when reasonably necessary to investigate fraud, abuse, security incidents, infringement, or violations of our policies;</li>
            <li>when reasonably necessary to protect rights, property, safety, or security;</li>
            <li>in connection with a merger, financing, investment, acquisition, reorganization, bankruptcy, sale, transfer, or other transaction involving all or part of LiveTimeData or its assets.</li>
          </ul>
          <p>If ownership or operation of LiveTimeData changes, information may be transferred to a successor or acquiring party subject to applicable law.</p>
          <p>LiveTimeData does not characterize personal information as property that LiveTimeData "owns."</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">7. ADVERTISING AND COMMERCIAL RELATIONSHIPS</h3>
          <p>LiveTimeData may display advertising and may participate in sponsorship, affiliate, referral, promotional, or other commercial programs.</p>
          <p>Advertising and related service providers may process information such as:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>cookies or similar identifiers;</li>
            <li>device and browser information;</li>
            <li>IP or network information;</li>
            <li>approximate location information;</li>
            <li>pages viewed;</li>
            <li>interactions with advertisements;</li>
            <li>advertising identifiers where available;</li>
            <li>consent and privacy choices;</li>
            <li>other information permitted by applicable law.</li>
          </ul>
          <p>Such information may be used to provide, limit, personalize, select, deliver, measure, secure, or report advertising.</p>
          <p>Where applicable law requires consent or an opportunity to opt out of certain advertising-related processing, LiveTimeData will provide or support an appropriate mechanism.</p>
          <p>Advertisements, affiliate links, and sponsored content may lead to third-party websites or services governed by their own privacy practices.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">8. COMMUNICATIONS AND EMAIL</h3>
          <p>If you provide an email address or other contact information to LiveTimeData, we may use it to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>respond to you;</li>
            <li>administer or follow up on a Submission;</li>
            <li>request additional information;</li>
            <li>request clarification;</li>
            <li>communicate about events or listings;</li>
            <li>communicate concerning photographs, webcams, reports, corrections, or other submitted material;</li>
            <li>provide notices concerning material you submitted;</li>
            <li>communicate concerning an organization, event, business, or project associated with your inquiry;</li>
            <li>administer contests or promotions;</li>
            <li>invite participation in surveys;</li>
            <li>invite participation in community or educational projects;</li>
            <li>communicate about contributor opportunities;</li>
            <li>communicate about advertising, sponsorship, or partnerships;</li>
            <li>provide service-related communications;</li>
            <li>conduct outreach;</li>
            <li>send promotional, informational, or other communications as permitted by applicable law.</li>
          </ul>
          <p>Where required by law, LiveTimeData will obtain any additional consent required for promotional communications.</p>
          <p>Commercial or promotional email will include any opt-out or unsubscribe mechanism required by applicable law.</p>
          <p>You may request that LiveTimeData stop sending nonessential promotional communications by using an available unsubscribe method or by contacting:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>
          <p>We may retain information reasonably necessary to maintain a suppression or do-not-contact record so that we can honor your request.</p>
          <p>An opt-out from promotional communications does not necessarily prevent LiveTimeData from sending communications reasonably necessary to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>respond to an active request;</li>
            <li>administer a Submission;</li>
            <li>administer a transaction, contest, or program;</li>
            <li>respond to a legal request;</li>
            <li>address security, fraud, or abuse;</li>
            <li>provide legally required notices;</li>
            <li>honor or document your opt-out;</li>
            <li>otherwise communicate as permitted by law.</li>
          </ul>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">9. SUBMISSIONS AND PUBLIC DISPLAY</h3>
          <p>Contact information supplied with a Submission is not intended to be publicly displayed unless:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>you authorize public display;</li>
            <li>you intentionally submit it for public display;</li>
            <li>public display is reasonably apparent from the nature of the Submission;</li>
            <li>disclosure is otherwise permitted or required by law.</li>
          </ul>
          <p>The content of a Submission itself may be published, edited, adapted, combined, promoted, distributed, or otherwise used as described in the LiveTimeData Submission Terms.</p>
          <p>LiveTimeData may retain information concerning the contributor, source, permissions, date submitted, terms accepted, communications, or other information reasonably necessary to administer or document the Submission.</p>
          <p>Before submitting photographs or other files, you should remove information that you do not want disclosed.</p>
          <p>LiveTimeData may remove or alter metadata from publicly displayed copies, but we do not guarantee that every hidden or embedded piece of information will be detected or removed.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">10. CHILDREN AND MINORS</h3>
          <p>LiveTimeData is a general-audience service.</p>
          <p>Children under 13 may not directly provide personal information or Submissions through ordinary LiveTimeData forms.</p>
          <p>A parent or legal guardian, or an educational process specifically established or authorized by LiveTimeData and structured to comply with applicable requirements, must act on behalf of a child under 13.</p>
          <p>Users ages 13 through 17 may be subject to parent or guardian permission requirements.</p>
          <p>LiveTimeData may establish additional requirements for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>school programs;</li>
            <li>educator programs;</li>
            <li>classroom activities;</li>
            <li>contests;</li>
            <li>youth programs;</li>
            <li>student submissions;</li>
            <li>other activities involving minors.</li>
          </ul>
          <p>LiveTimeData seeks to minimize unnecessary collection of personal information concerning children.</p>
          <p>If you are a parent or guardian and believe a child under 13 has directly provided personal information to LiveTimeData in a manner inconsistent with this Privacy Policy, please contact:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>
          <p>Please identify the situation sufficiently for us to investigate it.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">11. INFORMATION CONCERNING OTHER PEOPLE</h3>
          <p>Do not submit another person's private personal information unless you have an appropriate reason and legal authority to provide it.</p>
          <p>If you submit photographs, stories, event materials, reports, or other content involving other people, you are responsible for complying with the representations and permission requirements contained in the LiveTimeData Submission Terms.</p>
          <p>LiveTimeData may remove, restrict, edit, or decline to publish information concerning another person when we believe doing so is appropriate.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">12. RETENTION</h3>
          <p>LiveTimeData retains information for as long as reasonably necessary for the purposes described in this Privacy Policy.</p>
          <p>Retention may be necessary to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>operate and improve the Service;</li>
            <li>administer submissions;</li>
            <li>maintain contributor and source records;</li>
            <li>document permissions and licenses;</li>
            <li>administer contests, promotions, or programs;</li>
            <li>respond to requests or complaints;</li>
            <li>maintain correction and removal records;</li>
            <li>investigate fraud, abuse, or security issues;</li>
            <li>enforce agreements and policies;</li>
            <li>maintain legally required records;</li>
            <li>comply with contractual obligations;</li>
            <li>establish, exercise, or defend legal claims;</li>
            <li>maintain suppression and do-not-contact lists;</li>
            <li>maintain reasonable business records.</li>
          </ul>
          <p>Retention periods may vary according to the type of information, purpose, applicable law, contractual requirements, technical systems, and operational needs.</p>
          <p>A request to remove content from public display does not necessarily require deletion of internal records reasonably needed to document permissions, prior authorized uses, complaints, legal compliance, security, fraud prevention, or disputes.</p>
          <p>Information may also remain temporarily in backups or other systems until those systems are overwritten or retired through ordinary processes.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">13. SECURITY</h3>
          <p>LiveTimeData uses administrative, technical, and organizational measures that we consider appropriate for the nature of the information processed and the Service being provided.</p>
          <p>However, no website, database, network, transmission method, storage system, or security measure can be guaranteed to be completely secure.</p>
          <p>LiveTimeData therefore does not guarantee absolute security or that unauthorized access, disclosure, alteration, loss, or misuse can never occur.</p>
          <p>You should use reasonable care when deciding what information to submit online.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">14. INTERNATIONAL USE AND PROCESSING</h3>
          <p>LiveTimeData is designed to provide information concerning locations around the world and may be accessed internationally.</p>
          <p>Information may be processed in the United States and in other countries where LiveTimeData or its service providers operate.</p>
          <p>Privacy and data-protection requirements vary by jurisdiction.</p>
          <p>Where applicable law imposes additional requirements concerning international processing or transfers, LiveTimeData will take measures required by applicable law.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">15. YOUR PRIVACY RIGHTS AND CHOICES</h3>
          <p>Depending on where you live and applicable law, you may have certain rights concerning your personal information.</p>
          <p>These may include rights to request:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>access to certain personal information;</li>
            <li>correction of inaccurate personal information;</li>
            <li>deletion of certain personal information;</li>
            <li>information concerning certain processing or disclosures;</li>
            <li>restriction of certain processing;</li>
            <li>portability of certain information;</li>
            <li>objection to certain processing;</li>
            <li>withdrawal of consent where processing is based on consent;</li>
            <li>opt-out from certain advertising, profiling, sharing, or similar activities where applicable.</li>
          </ul>
          <p>These rights are not absolute and may be subject to legal exceptions, verification requirements, and limitations.</p>
          <p>To submit a privacy request, contact:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>
          <p>Please describe your request sufficiently for us to understand and respond to it.</p>
          <p>We may request information reasonably necessary to verify your identity, residency, authority, or relationship to the information before fulfilling a request.</p>
          <p>We will not unlawfully discriminate against a person for exercising applicable privacy rights.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">16. COOKIE AND PRIVACY CHOICES</h3>
          <p>Where available, you may manage certain privacy preferences through:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>LiveTimeData cookie or consent controls;</li>
            <li>privacy-choice controls provided through the Service;</li>
            <li>browser settings;</li>
            <li>device settings;</li>
            <li>advertising preference tools;</li>
            <li>clearing cookies or browser storage;</li>
            <li>unsubscribe mechanisms in promotional communications.</li>
          </ul>
          <p>Disabling certain storage technologies may affect website preferences or functionality.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">17. THIRD-PARTY WEBSITES AND SERVICES</h3>
          <p>LiveTimeData may link to or embed third-party websites, maps, media, advertisements, businesses, ticket sellers, event organizers, webcam operators, or other services.</p>
          <p>Third parties may collect or process information independently under their own terms and privacy policies.</p>
          <p>LiveTimeData does not control the privacy, security, data-retention, or other practices of independent third parties.</p>
          <p>You should review the privacy practices of third-party services when appropriate.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">18. BUSINESS TRANSFERS</h3>
          <p>If LiveTimeData is reorganized, incorporated, transferred to a company or other entity, sold, merged, financed, or involved in another business transaction, information associated with the Service may be transferred as part of that transaction as permitted by applicable law.</p>
          <p>A successor operator may continue to process information consistently with this Privacy Policy unless additional notice or consent is required by law.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">19. LEGAL REQUESTS AND PROTECTION OF RIGHTS</h3>
          <p>LiveTimeData may preserve, use, or disclose information when we reasonably believe doing so is necessary or appropriate to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>comply with applicable law;</li>
            <li>respond to lawful legal process;</li>
            <li>respond to governmental or regulatory requests;</li>
            <li>investigate suspected violations of our Terms or policies;</li>
            <li>investigate fraud, abuse, security incidents, or infringement;</li>
            <li>protect LiveTimeData, users, contributors, third parties, or the public;</li>
            <li>establish, exercise, or defend legal claims.</li>
          </ul>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">20. CHANGES TO THIS PRIVACY POLICY</h3>
          <p>LiveTimeData may update this Privacy Policy as the Service, technology, business, laws, or practices evolve.</p>
          <p>The Effective Date at the beginning of this Policy identifies the current version.</p>
          <p>Where required by applicable law, we may provide additional notice or obtain consent concerning material changes.</p>
          <p>We encourage users to review this Privacy Policy periodically.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">21. CONTACT INFORMATION</h3>
          <p>For privacy questions, privacy-rights requests, concerns about personal information, or other privacy matters, contact:</p>
          <p className="font-bold">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States<br /><br />Email: LiveTimeData@gmail.com</p>
        </div>
      )
    },
    legal: {
      title: "Legal Information",
      content: (
        <div className="space-y-4 text-slate-700 text-[11px] md:text-xs leading-relaxed">
          <p className="font-bold text-slate-900">Effective Date: August 29, 2026</p>
          <p>LiveTimeData is designed to help users discover, explore, and learn about cities and places around the world.</p>
          <p>Information provided through LiveTimeData is for general informational, educational, planning, entertainment, and discovery purposes.</p>
          <p>These disclaimers supplement the LiveTimeData Terms of Service, Privacy Policy, Submission Terms, and Copyright & Content Removal Policy.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">1. GENERAL INFORMATION DISCLAIMER</h3>
          <p>LiveTimeData may display, organize, generate, compile, summarize, or otherwise provide information originating from LiveTimeData, third parties, contributors, organizations, businesses, public sources, automated systems, artificial intelligence, editorial processes, or combinations of these sources.</p>
          <p>Information may be:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>incomplete;</li>
            <li>inaccurate;</li>
            <li>outdated;</li>
            <li>delayed;</li>
            <li>estimated;</li>
            <li>approximate;</li>
            <li>automatically generated;</li>
            <li>incorrectly categorized;</li>
            <li>based on incomplete source material;</li>
            <li>unavailable;</li>
            <li>changed without notice.</li>
          </ul>
          <p>LiveTimeData does not guarantee that information appearing through the Service is complete, current, error-free, verified, official, or suitable for any particular purpose.</p>
          <p>When information matters to health, safety, travel, money, legal rights, deadlines, purchases, transportation, reservations, admission, or another consequential decision, users should independently verify the information with an appropriate authoritative source.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">2. AI-ASSISTED AND AUTOMATED CONTENT</h3>
          <p>Some LiveTimeData content may be generated, seeded, compiled, summarized, categorized, edited, translated, moderated, organized, analyzed, or otherwise assisted by artificial intelligence or other automated systems.</p>
          <p>LiveTimeData may use automated systems to help create broad informational coverage.</p>
          <p>Automated or AI-assisted material may later be supplemented, revised, corrected, expanded, or replaced using human-supplied reports, contributor information, research, editorial review, or additional sources.</p>
          <p>Artificial intelligence and automated systems can produce incorrect information, omit important information, misunderstand source material, make incorrect associations, or generate information that appears plausible but is not accurate.</p>
          <p>The appearance of information on LiveTimeData does not mean that it has been independently verified by a human.</p>
          <p>LiveTimeData does not guarantee the factual accuracy of AI-assisted or automatically processed information.</p>
          <p>LiveTimeData may revise, replace, supplement, correct, reorganize, or remove such content at any time.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">3. TIME, DATE, AND TIME-ZONE INFORMATION</h3>
          <p>Time, date, and time-zone information may depend on geographic information, time-zone databases, governmental decisions, daylight-saving rules, software, network conditions, browser or device settings, third-party information, and other technical factors.</p>
          <p>Time-zone boundaries and daylight-saving practices can change.</p>
          <p>LiveTimeData does not guarantee:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>atomic-clock accuracy;</li>
            <li>second-by-second precision;</li>
            <li>perfect synchronization;</li>
            <li>correct device-clock information;</li>
            <li>perfect daylight-saving treatment;</li>
            <li>legally authoritative time;</li>
            <li>uninterrupted availability of time information.</li>
          </ul>
          <p>Do not rely on LiveTimeData as the sole source for legal filing deadlines, transportation departures, financial transactions, medical schedules, examinations, appointments, business deadlines, broadcasts, or other consequential time-sensitive matters.</p>
          <p>Confirm important times and deadlines with the appropriate authoritative source.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">4. WEATHER AND FORECAST INFORMATION</h3>
          <p>Weather observations, current conditions, forecasts, temperatures, precipitation information, wind information, humidity information, icons, alerts, and other weather-related information are provided for general informational purposes.</p>
          <p>Weather conditions can change rapidly.</p>
          <p>Weather observations and forecasts may be delayed, estimated, modeled, geographically approximate, incomplete, unavailable, or inaccurate.</p>
          <p>Forecasts describe possible future conditions and are not guarantees.</p>
          <p>LiveTimeData is not an emergency weather service and does not provide professional meteorological, aviation, marine, emergency-management, or safety advice.</p>
          <p>For severe weather, storms, flooding, wildfire conditions, aviation, marine activity, outdoor safety, agriculture, emergencies, evacuations, or other safety-sensitive decisions, consult appropriate governmental, meteorological, emergency-management, or local authorities and evaluate actual local conditions.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">5. MAPS, COORDINATES, GEOGRAPHIC INFORMATION, AND LOCATION</h3>
          <p>Maps, coordinates, boundaries, city names, administrative regions, distances, directions, geographic classifications, and nearby-location information may be approximate, incomplete, outdated, or incorrect.</p>
          <p>Cities and places with identical or similar names may be confused.</p>
          <p>Coordinates displayed for a city may represent a city center, administrative point, approximate geographic point, or another representative location rather than an exact destination.</p>
          <p>Administrative boundaries and geographic classifications can change or vary among sources.</p>
          <p>A label such as "local," "nearby," "popular nearby," or similar wording does not guarantee that an item is within a particular municipal boundary, driving distance, walking distance, travel time, or geographic radius unless LiveTimeData expressly states a particular measurement.</p>
          <p>Users are responsible for confirming that they selected the intended city or location and for verifying geographic information when accuracy matters.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">6. CURRENCY AND EXCHANGE-RATE INFORMATION</h3>
          <p>Currency conversions, exchange rates, calculations, and related financial information displayed by LiveTimeData are provided for general informational purposes only.</p>
          <p>Displayed rates may be:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>delayed;</li>
            <li>estimated;</li>
            <li>rounded;</li>
            <li>indicative;</li>
            <li>incomplete;</li>
            <li>unavailable;</li>
            <li>different from actual transaction rates.</li>
          </ul>
          <p>Banks, payment networks, card issuers, currency exchanges, merchants, financial institutions, and other providers may use different exchange rates and may charge additional fees or commissions.</p>
          <p>LiveTimeData does not guarantee that any displayed exchange rate will be available for an actual transaction.</p>
          <p>Nothing displayed by LiveTimeData constitutes financial, investment, banking, accounting, tax, currency-trading, or other professional advice.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">7. EVENTS, CALENDARS, TICKETS, AND SCHEDULES</h3>
          <p>Event information is provided for discovery and informational purposes.</p>
          <p>Event information may originate from event organizers, venues, ticket sellers, contributors, third-party sources, public information, automated systems, or other sources.</p>
          <p>LiveTimeData does not guarantee that:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>every event occurring in a city or area is listed;</li>
            <li>an empty date means that no real-world events exist;</li>
            <li>an event listing has been independently verified;</li>
            <li>a listed event will actually occur;</li>
            <li>an event will occur at the displayed date or time;</li>
            <li>a displayed venue is correct;</li>
            <li>performers or participants will appear;</li>
            <li>prices are current;</li>
            <li>admission requirements are correct;</li>
            <li>tickets will remain available;</li>
            <li>seating will remain available;</li>
            <li>reservations will be accepted;</li>
            <li>vendor or exhibitor spaces will remain available;</li>
            <li>an event is suitable for a particular person;</li>
            <li>an organizer, promoter, venue, ticket seller, or other participant is legitimate or reliable.</li>
          </ul>
          <p>Events may be canceled, postponed, moved, rescheduled, modified, sold out, or otherwise changed without notice.</p>
          <p>Before traveling, purchasing tickets, making reservations, arranging accommodations, or otherwise relying on an event listing, confirm important information directly with the organizer, venue, ticket seller, or other authoritative source.</p>
          <p>Event categories are provided for convenience.</p>
          <p>A category such as "Family," "Kids," "Festivals," "Sports," "Concerts," or similar classification is not a guarantee of suitability, safety, accessibility, quality, content, age appropriateness, or availability.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">8. WEBCAMS, VIDEO, IMAGES, AND LIVE OR RECENT MEDIA</h3>
          <p>LiveTimeData may display, embed, link to, organize, or reference webcams, streams, refreshed images, snapshots, photographs, video, or other media.</p>
          <p>Some media may be supplied, hosted, operated, transmitted, or controlled by third parties.</p>
          <p>A label such as "Live," "Live Cam," "Webcam," or similar wording may refer to a live stream, periodically refreshed image, recent snapshot, or other camera feed.</p>
          <p>Such wording does not guarantee zero delay, continuous transmission, uninterrupted operation, or exact real-time imagery.</p>
          <p>A camera or feed may be:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>delayed;</li>
            <li>cached;</li>
            <li>frozen;</li>
            <li>temporarily unavailable;</li>
            <li>permanently offline;</li>
            <li>redirected;</li>
            <li>moved;</li>
            <li>mislabeled;</li>
            <li>obstructed;</li>
            <li>incorrectly located;</li>
            <li>displaying older imagery;</li>
            <li>changed by its operator without notice.</li>
          </ul>
          <p>LiveTimeData may not control what unexpectedly appears in a third-party camera feed.</p>
          <p>LiveTimeData does not guarantee that a webcam is continuously monitored, safe, appropriate, accurate, representative of current conditions, or available at any particular time.</p>
          <p>Webcam imagery should not be relied upon as official traffic, aviation, marine, weather, emergency, security, road-condition, or public-safety information.</p>
          <p>If you own, operate, control, appear in, or otherwise have a legitimate rights concern involving media displayed or referenced through LiveTimeData, contact:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">9. PHOTOGRAPHS AND OTHER IMAGES</h3>
          <p>Photographs and images displayed through LiveTimeData may originate from LiveTimeData, contributors, organizations, third parties, licensed sources, public sources, or other authorized sources.</p>
          <p>A photograph may not depict current conditions.</p>
          <p>Images may have been taken at an earlier date, cropped, resized, optimized, edited, enhanced, reformatted, or otherwise prepared for display.</p>
          <p>The presence of an image does not necessarily mean LiveTimeData owns the original copyright.</p>
          <p>Third-party photographs and images remain subject to the rights of their respective owners.</p>
          <p>If you believe an image violates your copyright, privacy, publicity, or other legal rights, review the LiveTimeData Copyright & Content Removal Policy or contact:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">10. ATTRACTIONS, RESTAURANTS, BUSINESSES, AND LOCAL PLACES</h3>
          <p>LiveTimeData may provide information concerning attractions, restaurants, businesses, venues, museums, parks, landmarks, entertainment, shopping, lodging, transportation, services, and other local places.</p>
          <p>This information may change frequently.</p>
          <p>LiveTimeData does not guarantee:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>that a business or attraction is currently operating;</li>
            <li>that operating hours are correct;</li>
            <li>that an address is correct;</li>
            <li>that admission is available;</li>
            <li>that reservations are available;</li>
            <li>that displayed prices are current;</li>
            <li>that menus or services are current;</li>
            <li>that a location is accessible to every visitor;</li>
            <li>that a business provides a particular product or service;</li>
            <li>that an attraction or business will meet a user's expectations;</li>
            <li>that a listed location is safe;</li>
            <li>that a listing constitutes endorsement.</li>
          </ul>
          <p>Businesses may close, relocate, change ownership, change hours, modify prices, discontinue services, or otherwise change without notice.</p>
          <p>Confirm important information directly with the applicable business, attraction, venue, transportation provider, or other authoritative source before making plans.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">11. RECOMMENDATIONS, POPULAR LOCATIONS, RANKINGS, AND FEATURED CONTENT</h3>
          <p>LiveTimeData may identify locations, events, attractions, businesses, views, photographs, webcams, or other information using descriptions such as:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>popular;</li>
            <li>featured;</li>
            <li>recommended;</li>
            <li>iconic;</li>
            <li>notable;</li>
            <li>nearby;</li>
            <li>hidden gem;</li>
            <li>top;</li>
            <li>favorite;</li>
            <li>must-see;</li>
            <li>similar descriptive terminology.</li>
          </ul>
          <p>These descriptions may reflect editorial judgment, third-party information, contributor suggestions, popularity information, automated processing, commercial arrangements where appropriately disclosed, or combinations of these factors.</p>
          <p>Such descriptions do not guarantee quality, safety, suitability, popularity, availability, accessibility, value, or user satisfaction.</p>
          <p>They should not be interpreted as professional advice, certification, or an official ranking unless expressly identified as such.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">12. SAFETY, CRIME, NEIGHBORHOODS, AND LOCAL CONDITIONS</h3>
          <p>LiveTimeData may provide or reference general information concerning safety, crime, neighborhoods, transportation, local conditions, or travel considerations.</p>
          <p>Safety conditions can vary significantly by neighborhood, location, time of day, season, current events, and individual circumstances.</p>
          <p>Crime statistics and safety information can vary according to reporting practices, geographic boundaries, methodology, source, and reporting period.</p>
          <p>LiveTimeData does not guarantee that any city, neighborhood, business, event, attraction, route, accommodation, transportation service, or other location is safe.</p>
          <p>Do not use LiveTimeData as a substitute for emergency services, law-enforcement information, governmental travel advisories, professional security advice, or reasonable personal judgment.</p>
          <p>In an emergency, contact the appropriate local emergency authority.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">13. HISTORICAL INFORMATION, FACTS, STORIES, MYTHS, AND LEGENDS</h3>
          <p>LiveTimeData may display historical information, facts, local stories, community knowledge, folklore, myths, legends, anecdotes, traditions, and contributor-supplied material.</p>
          <p>Historical accounts and community stories may differ among sources.</p>
          <p>Some information may be disputed, subjective, anecdotal, incomplete, difficult to verify, or based on tradition rather than established historical evidence.</p>
          <p>LiveTimeData may identify material as folklore, myth, legend, tradition, anecdote, opinion, or unverified information where appropriate.</p>
          <p>Publication of a statement does not establish that a disputed statement is true.</p>
          <p>If you identify a factual error or believe information should be corrected, contact LiveTimeData.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">14. AWARDS, RECOGNITIONS, AND THIRD-PARTY RANKINGS</h3>
          <p>LiveTimeData may reference awards, rankings, recognitions, certifications, designations, or similar information concerning cities, attractions, organizations, businesses, or other subjects.</p>
          <p>Such information may have been issued by independent third parties.</p>
          <p>Where practical, LiveTimeData may identify the organization, publication, year, or context associated with a recognition.</p>
          <p>Reference to an award, ranking, publication, organization, trademark, or designation does not imply that the applicable third party sponsors, endorses, or is affiliated with LiveTimeData.</p>
          <p>Awards and rankings may become outdated or may be based on subjective criteria.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">15. BUSINESS, ECONOMIC, PROPERTY, AND INVESTMENT INFORMATION</h3>
          <p>LiveTimeData may provide general information concerning local economies, businesses, industries, employment, population, demographics, development, property, investment conditions, or similar subjects.</p>
          <p>Such information is informational only.</p>
          <p>Nothing on LiveTimeData constitutes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>investment advice;</li>
            <li>financial advice;</li>
            <li>legal advice;</li>
            <li>tax advice;</li>
            <li>accounting advice;</li>
            <li>real-estate advice;</li>
            <li>business consulting;</li>
            <li>due-diligence advice;</li>
            <li>a recommendation to buy, sell, invest, relocate, or enter into a transaction.</li>
          </ul>
          <p>Users should consult appropriately qualified professionals and authoritative sources before making consequential business, financial, property, legal, tax, or investment decisions.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">16. TRANSPORTATION, AIRPORTS, TRAFFIC, AND TRAVEL INFORMATION</h3>
          <p>LiveTimeData may display or reference airports, transportation services, traffic information, roads, transit, travel conditions, distances, or other transportation-related information.</p>
          <p>This information may be delayed, incomplete, estimated, or unavailable.</p>
          <p>LiveTimeData does not provide official aviation, traffic-control, navigation, road-safety, or transportation-operational information.</p>
          <p>Do not rely on LiveTimeData as the sole source for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>flight operations;</li>
            <li>departure or arrival times;</li>
            <li>road closures;</li>
            <li>navigation;</li>
            <li>emergency routes;</li>
            <li>traffic safety;</li>
            <li>transit schedules;</li>
            <li>transportation deadlines;</li>
            <li>other safety-critical travel decisions.</li>
          </ul>
          <p>Verify consequential transportation information with the applicable transportation provider, airport, government agency, carrier, or other authoritative source.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">17. THIRD-PARTY LINKS, EMBEDS, SERVICES, AND TRANSACTIONS</h3>
          <p>LiveTimeData may contain links to or embeds from third-party websites and services.</p>
          <p>These may include businesses, event organizers, ticket sellers, webcam operators, mapping services, media services, advertisers, merchants, travel providers, attractions, restaurants, or other third parties.</p>
          <p>LiveTimeData does not control independent third-party:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>content;</li>
            <li>security;</li>
            <li>privacy practices;</li>
            <li>prices;</li>
            <li>products;</li>
            <li>services;</li>
            <li>availability;</li>
            <li>transactions;</li>
            <li>refunds;</li>
            <li>fulfillment;</li>
            <li>representations;</li>
            <li>terms and conditions.</li>
          </ul>
          <p>A link, listing, embed, mention, photograph, map, event listing, advertisement, or reference does not necessarily constitute endorsement, sponsorship, certification, partnership, or affiliation.</p>
          <p>Users interact with independent third parties at their own discretion and subject to the third party's applicable terms and policies.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">18. ADVERTISING, AFFILIATE, AND SPONSORED CONTENT</h3>
          <p>LiveTimeData may earn revenue from:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>advertisements;</li>
            <li>sponsorships;</li>
            <li>affiliate relationships;</li>
            <li>referrals;</li>
            <li>promoted placements;</li>
            <li>partnerships;</li>
            <li>other commercial arrangements.</li>
          </ul>
          <p>Where required, LiveTimeData will appropriately identify sponsored, paid, promotional, or affiliate relationships.</p>
          <p>Advertising appearing near editorial or informational content does not mean that an advertiser created, approved, or influenced that content unless expressly disclosed.</p>
          <p>Likewise, the presence of an advertisement does not constitute a LiveTimeData guarantee or endorsement of the advertiser's claims, products, services, prices, security, or fulfillment.</p>
          <p>Users should independently evaluate third-party offers before entering transactions.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">19. USER AND CONTRIBUTOR SUBMISSIONS</h3>
          <p>LiveTimeData may receive information and materials from users, contributors, organizations, businesses, event organizers, photographers, webcam owners or operators, students, educators, community members, and other sources.</p>
          <p>LiveTimeData does not guarantee that submitted information is accurate, complete, lawful, original, current, or reliable.</p>
          <p>Submission review, moderation, automated screening, or publication does not constitute a guarantee that LiveTimeData has independently verified every fact, right, permission, or claim.</p>
          <p>LiveTimeData may correct, edit, summarize, combine, restrict, replace, or remove submitted information.</p>
          <p>Additional rules governing submitted material are contained in the LiveTimeData Submission Terms.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">20. CONTENT CORRECTIONS AND CHANGES</h3>
          <p>LiveTimeData is an evolving information service.</p>
          <p>Information may be corrected, updated, expanded, reorganized, replaced, or removed as new or better information becomes available.</p>
          <p>A previous version of a page or statement should not be assumed to remain LiveTimeData's current position.</p>
          <p>If you believe information is inaccurate or outdated, you may contact:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>
          <p>Please identify the relevant page and the information you believe should be reviewed.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">21. NO PROFESSIONAL RELATIONSHIP</h3>
          <p>Use of LiveTimeData does not create an attorney-client, doctor-patient, financial-adviser, fiduciary, professional-consultant, travel-agent, broker, employment, agency, or other professional relationship.</p>
          <p>Information provided through LiveTimeData should not be treated as a substitute for professional advice where professional advice is appropriate.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">22. THIRD-PARTY AVAILABILITY AND TECHNICAL FAILURES</h3>
          <p>LiveTimeData depends in part on third-party infrastructure, data, media, advertising, communications, and other services.</p>
          <p>Third-party services may experience:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>outages;</li>
            <li>delays;</li>
            <li>rate limits;</li>
            <li>maintenance;</li>
            <li>errors;</li>
            <li>data changes;</li>
            <li>discontinued services;</li>
            <li>changed terms;</li>
            <li>unavailable content;</li>
            <li>technical failures.</li>
          </ul>
          <p>LiveTimeData does not guarantee the uninterrupted availability of third-party information or functionality.</p>
          <p>We may replace, change, suspend, or discontinue a provider, feature, data source, feed, embed, or other component at any time.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">23. NO GUARANTEE OF CONTINUOUS SERVICE</h3>
          <p>LiveTimeData itself may experience outages, maintenance, errors, interruptions, delays, security incidents, software problems, or other technical issues.</p>
          <p>We do not guarantee uninterrupted or error-free access.</p>
          <p>Features, content, categories, pages, interfaces, and functionality may be changed, replaced, suspended, or discontinued at any time.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">24. MOBILE DEVICES AND FUTURE APPLICATIONS</h3>
          <p>LiveTimeData may be accessed through desktop computers, mobile phones, tablets, and other compatible devices.</p>
          <p>Performance, layout, accuracy, permissions, availability, and functionality may vary by browser, device, network, or operating system.</p>
          <p>If LiveTimeData later provides a native mobile application or another platform requiring additional permissions or disclosures, additional terms or policies may apply.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">25. ACCESSIBILITY</h3>
          <p>LiveTimeData aims to make its website usable by as many people as reasonably possible, including people who use assistive technologies.</p>
          <p>We continue to improve accessibility as LiveTimeData evolves.</p>
          <p>LiveTimeData does not represent or guarantee that every page, third-party embed, third-party content item, or feature will meet every accessibility standard at all times.</p>
          <p>If you experience difficulty accessing any part of LiveTimeData, please contact us and describe the page, feature, or issue so that we can review it.</p>
          <p>Accessibility contact:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">26. NO GUARANTEE CREATED BY CORRECTION OR REVIEW</h3>
          <p>LiveTimeData may review, edit, correct, moderate, or update information.</p>
          <p>The fact that some information has been reviewed or corrected does not mean that every other item on the Service has been reviewed or verified.</p>
          <p>Unless LiveTimeData expressly states otherwise, words such as "reviewed," "updated," or similar editorial descriptions should not be interpreted as a warranty or guarantee of complete accuracy.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">27. LIMITATION OF RELIANCE</h3>
          <p>LiveTimeData is intended to assist with general discovery and information.</p>
          <p>Users remain responsible for evaluating information and determining whether additional verification is appropriate.</p>
          <p>LiveTimeData should not be the sole basis for decisions involving significant financial loss, personal safety, legal rights, medical matters, emergency situations, travel deadlines, transportation safety, investment decisions, property transactions, or other consequential matters.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">28. CHANGES TO THESE DISCLAIMERS</h3>
          <p>LiveTimeData may update these Legal & Disclaimers as the Service, features, information categories, technology, laws, or business practices evolve.</p>
          <p>The Effective Date at the beginning of this document identifies the current version.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">29. CONTACT</h3>
          <p>For questions, corrections, accessibility concerns, or general issues concerning information displayed through LiveTimeData:</p>
          <p className="font-bold">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States<br /><br />Email: LiveTimeData@gmail.com</p>
          <p>Copyright, media-rights, and formal content-removal concerns should also be reviewed under the LiveTimeData Copyright & Content Removal Policy.</p>
        </div>
      )
    },
    terms: {
      title: "Terms of Service",
      content: (
        <div className="space-y-4 text-slate-700 text-[11px] md:text-xs leading-relaxed">
          <p className="font-bold text-slate-900">Effective Date: August 29, 2026</p>
          <p>These Terms of Service ("Terms") govern your access to and use of LiveTimeData, including its websites, mobile experiences, pages, tools, features, content, submission forms, and related services (collectively, the "Service").</p>
          <p>LiveTimeData is currently operated from North Carolina, United States. "LiveTimeData," "we," "us," and "our" refer to the operator of the Service.</p>
          <p>By accessing or using the Service, you agree to these Terms. If you do not agree, do not use the Service.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">1. ABOUT LIVETIMEDATA</h3>
          <p>LiveTimeData is an informational, educational, planning, entertainment, and discovery service.</p>
          <p>The Service may provide, organize, generate, compile, summarize, or display information concerning cities, communities, time, dates, time zones, weather, forecasts, maps, coordinates, geographic information, currency and exchange rates, events, calendars, holidays, webcams, photographs, attractions, restaurants, businesses, transportation, history, facts, recommendations, rankings, local reports, and other subjects.</p>
          <p>Information may originate from LiveTimeData, third parties, contributors, businesses, organizations, public sources, automated systems, artificial intelligence, editorial processes, or combinations of these sources.</p>
          <p>Information may be incomplete, inaccurate, delayed, outdated, approximate, automatically generated, incorrectly categorized, changed without notice, or unavailable.</p>
          <p>You are responsible for independently confirming information when accuracy matters. Additional limitations appear in our Legal & Disclaimers page, which is incorporated into these Terms.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">2. AI-ASSISTED AND AUTOMATED CONTENT</h3>
          <p>LiveTimeData may use artificial intelligence and other automated systems to generate, seed, compile, summarize, categorize, moderate, edit, translate, analyze, organize, or otherwise assist with content.</p>
          <p>Some information may initially be generated or compiled using automated systems and later supplemented, revised, corrected, expanded, or replaced using human-supplied reports, contributor information, research, editorial review, or additional sources.</p>
          <p>Automated systems can make mistakes. The appearance of information on LiveTimeData does not mean it has been independently verified by a human.</p>
          <p>LiveTimeData may revise, supplement, replace, correct, reorganize, or remove content at any time.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">3. ELIGIBILITY AND MINORS</h3>
          <p>LiveTimeData is intended for a general audience.</p>
          <p>Children under 13 may not directly submit personal information or content through ordinary LiveTimeData forms. A parent or legal guardian, or an educational process specifically established or authorized by LiveTimeData and structured to comply with applicable requirements, must act on behalf of a child under 13.</p>
          <p>Users ages 13 through 17 may use submission features only as permitted by applicable law and subject to any parent or guardian permission required by LiveTimeData or applicable law.</p>
          <p>Additional eligibility, consent, release, or participation requirements may apply to contests, promotions, school programs, contributor programs, photographs, or other activities.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">4. ACCEPTABLE USE</h3>
          <p>You may use LiveTimeData only for lawful purposes.</p>
          <p>You may not interfere with the Service or its security; attempt unauthorized access to systems, databases, accounts, or credentials; introduce malicious software or code; impersonate another person or organization; manipulate advertising; submit fraudulent, unlawful, defamatory, malicious, threatening, exploitative, or infringing material; unlawfully violate another person's copyright, trademark, privacy, publicity, contractual, confidentiality, or other rights; or falsely suggest sponsorship, endorsement, certification, partnership, or official status.</p>
          <p>You may not use automated means to scrape, harvest, systematically download, reproduce, or extract substantial portions of the Service except with our written permission or as otherwise permitted by law.</p>
          <p>LiveTimeData may restrict, reject, remove, block, suspend, or otherwise limit content, submissions, or access when we reasonably believe doing so is appropriate.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">5. SUBMISSIONS AND CONTRIBUTIONS</h3>
          <p>LiveTimeData may accept city information, reports, facts, stories, history, myths, legends, recommendations, photographs, images, event information, webcam information or links, surveys, suggestions, corrections, feedback, contest entries, school or community contributions, supporting URLs, and other material ("Submissions").</p>
          <p>Submitting material does not guarantee review, verification, publication, continued publication, promotion, attribution, response, or compensation.</p>
          <p>You retain whatever copyright or ownership rights you legally hold in your original Submission.</p>
          <p>By making a Submission and accepting these Terms or the applicable submission-form agreement, you grant LiveTimeData a worldwide, nonexclusive, royalty-free, fully paid, sublicensable, and transferable license to use all or part of the Submission in connection with LiveTimeData's current and future activities.</p>
          <p>This license includes permission to host, store, reproduce, copy, publish, display, distribute, transmit, digitize, format, reformat, resize, crop, enhance, edit, excerpt, summarize, organize, categorize, annotate, translate, combine, compile, adapt, modify, create derivative works from, promote, advertise, market, syndicate, monetize, commercially exploit, and otherwise use the Submission.</p>
          <p>Authorized uses may include LiveTimeData websites, city pages, mobile experiences, future applications and services, social media, newsletters, emails, advertising campaigns, promotional materials, educational materials, reports, databases, presentations, publications, printed materials, print-on-demand products, contests, community or educational projects, partner media, syndication and distribution channels, and other current or future media or platforms.</p>
          <p>LiveTimeData may permit contractors, editors, moderators, technology providers, printers, publishers, distributors, production providers, promotional partners, syndication partners, and other parties working with LiveTimeData to exercise these rights as reasonably necessary for an authorized use.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">6. EDITING, AI PROCESSING, AND DERIVATIVE WORKS</h3>
          <p>LiveTimeData is not required to publish a Submission exactly as received.</p>
          <p>We may correct, shorten, summarize, reorganize, combine, rewrite, translate, adapt, categorize, compile, extract information from, create captions or descriptions for, incorporate into larger reports or databases, or otherwise prepare a Submission for use.</p>
          <p>Artificial intelligence or automated systems may assist with moderation, classification, organization, analysis, summarization, editing, rewriting, translation, compilation, comparison, or preparation of Submissions.</p>
          <p>A Submission may be used as source material for independently prepared LiveTimeData content rather than published verbatim.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">7. ATTRIBUTION AND COMPENSATION</h3>
          <p>LiveTimeData may provide contributor credit when we consider it appropriate, including credit to photographers, webcam owners or operators, writers, organizations, schools, businesses, event organizers, or community contributors.</p>
          <p>Attribution is not guaranteed unless a separate written agreement specifically requires it. LiveTimeData may determine the wording, placement, format, duration, and prominence of voluntary attribution.</p>
          <p>Unless separately agreed in writing, ordinary Submissions are voluntary and do not entitle you to payment, royalties, licensing fees, advertising revenue, affiliate revenue, sponsorship revenue, commissions, revenue sharing, employment, future work, or other compensation.</p>
          <p>LiveTimeData may monetize material incorporating or derived from a Submission without owing compensation to the contributor.</p>
          <p>Separate written agreements, paid assignments, commissioned projects, contest rules, or special arrangements may provide different terms.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">8. YOUR AUTHORITY TO SUBMIT MATERIAL</h3>
          <p>By making a Submission, you represent that you have the legal right and authority to provide the material and grant the rights described in these Terms.</p>
          <p>You represent that you are not knowingly submitting material that unlawfully infringes another person's copyright, trademark, privacy, publicity, contractual, confidentiality, or other rights, and that you are not knowingly providing unlawful, fraudulent, malicious, defamatory, or materially deceptive material.</p>
          <p>Do not submit copyrighted material simply because you found it publicly available online. Public accessibility does not necessarily mean material is free for commercial reuse.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">9. PHOTOGRAPHS, IMAGES, VIDEO, AND OTHER MEDIA</h3>
          <p>If you submit a photograph, image, video, or other media, you represent that you own it or otherwise have sufficient authority to grant LiveTimeData the rights described in these Terms.</p>
          <p>If submitted media contains identifiable people, you are responsible for obtaining any permission, consent, release, or other authority legally required for the authorized uses. Particular care must be taken when identifiable minors appear.</p>
          <p>You are also responsible for permissions reasonably required concerning private property, copyrighted artwork, performances, trademarks, signs, displays, or other protected material depicted in a Submission.</p>
          <p>LiveTimeData may crop, resize, optimize, edit, enhance, blur, reformat, or otherwise prepare media for authorized use.</p>
          <p>LiveTimeData generally prefers submitted photographs that do not prominently feature recognizable individuals unless people are reasonably necessary or appropriate to the Submission.</p>
          <p>Neither automated systems nor human review can be guaranteed to identify every person, copyright issue, privacy concern, or other rights issue.</p>
          <p>Submitted files may contain metadata, including location or device information. You should remove metadata you do not want to provide before submitting a file. LiveTimeData may remove metadata from publicly displayed copies but does not guarantee that every embedded data element will be detected or removed.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">10. EVENT SUBMISSIONS</h3>
          <p>If you submit event information, you represent that you have a reasonable basis for the factual information provided and sufficient authority to provide any copyrighted or promotional material included with the Submission.</p>
          <p>An event Submission does not guarantee publication, placement, ranking, promotion, traffic, attendance, ticket sales, vendor participation, sponsorship, or continued listing.</p>
          <p>LiveTimeData may edit event information, supplement it using other lawful sources, or remove or update an event at any time.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">11. WEBCAM SUBMISSIONS AND SUGGESTIONS</h3>
          <p>You may suggest a publicly accessible webcam or camera URL for LiveTimeData to consider.</p>
          <p>Suggesting a webcam you do not own does not mean you own the footage or have authority to grant copyright rights in the footage.</p>
          <p>LiveTimeData may independently determine whether a camera may lawfully be linked, embedded, displayed, referenced, or otherwise used.</p>
          <p>If you state that you own, operate, manage, represent, or control a webcam or camera feed, you represent that statement is accurate and that you have sufficient authority to provide any permissions you grant.</p>
          <p>LiveTimeData may request additional information and may decline, remove, replace, or discontinue a webcam listing at any time.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">12. STORIES, FACTS, HISTORY, AND LOCAL INFORMATION</h3>
          <p>Do not knowingly submit false factual claims, defamatory accusations, fabricated quotations, false endorsements, fake reviews, another person's unlawfully disclosed private information, confidential information you are not authorized to disclose, or copyrighted material copied without sufficient authority.</p>
          <p>When providing folklore, myths, legends, traditions, anecdotes, or disputed historical information, identify its nature where reasonably possible rather than intentionally presenting uncertain material as established fact.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">13. MODERATION AND PROHIBITED SUBMISSIONS</h3>
          <p>LiveTimeData may use human review, automated systems, artificial intelligence, filters, or combinations of these methods to review Submissions.</p>
          <p>We may reject, block, edit, summarize, categorize, combine, correct, restrict, remove, preserve appropriate records concerning, or decline to publish a Submission.</p>
          <p>You may not knowingly submit material that is unlawful, sexually exploitative, exploitative of minors, threatening, harassing, hateful, fraudulent, materially deceptive, impersonating, scam-related, malicious, phishing-related, malware-related, unlawfully infringing, defamatory, unlawfully invasive of privacy, unlawfully exposing personal information, encouraging illegal activity, spam, or otherwise unsuitable for LiveTimeData.</p>
          <p>Moderation does not mean that LiveTimeData has independently verified every Submission or identified every potential problem.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">14. SUBMISSION REMOVAL REQUESTS</h3>
          <p>A contributor may request that LiveTimeData stop displaying or using material they previously submitted by contacting:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>
          <p>Please identify the Submission and, where possible, provide the relevant page or URL.</p>
          <p>LiveTimeData will consider reasonable removal requests and, when appropriate, may make reasonable efforts to discontinue future standalone use within systems reasonably under our control.</p>
          <p>A removal request does not retroactively revoke permissions previously granted or make earlier authorized uses unauthorized.</p>
          <p>LiveTimeData cannot guarantee that every prior use can be located, recalled, changed, or removed. Material may remain in previously distributed emails, advertisements, social-media posts, printed materials, products already produced or ordered, partner distributions, syndicated material, derivative works, compilations, reports, databases, videos, educational materials, search-engine or third-party caches, archives, backups, or records reasonably necessary to document permissions, prior uses, legal compliance, disputes, security, or fraud prevention.</p>
          <p>Representations concerning ownership, authority, permissions, and legality survive to the extent reasonably necessary concerning uses made in reliance upon those representations.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">15. COPYRIGHT AND INTELLECTUAL PROPERTY</h3>
          <p>Except for third-party material and user-submitted material, original LiveTimeData text, software, graphics, branding, compilations, organization, interface elements, designs, photographs owned by LiveTimeData, and other original materials created for LiveTimeData are owned by or licensed to LiveTimeData and may be protected by copyright, trademark, and other laws.</p>
          <p>Use of the Service does not transfer ownership of LiveTimeData intellectual property to you.</p>
          <p>Unless otherwise permitted by law or expressly authorized by LiveTimeData, you may not commercially republish, systematically copy, resell, redistribute, reproduce, or use substantial portions of LiveTimeData content to create or operate a competing database, website, application, publication, or service.</p>
          <p>Third-party content remains subject to the rights of its respective owners.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">16. COPYRIGHT INFRINGEMENT COMPLAINTS</h3>
          <p>LiveTimeData respects intellectual-property rights.</p>
          <p>If you believe copyrighted material is being infringed on LiveTimeData, you may send a written copyright complaint to:</p>
          <p className="font-bold">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States<br /><br />Email: LiveTimeData@gmail.com</p>
          <p>To help us identify and evaluate the complaint, please provide:</p>
          <ul className="list-decimal pl-5 space-y-1">
            <li>Your physical or electronic signature, or the signature of a person authorized to act for the copyright owner.</li>
            <li>Identification of the copyrighted work claimed to have been infringed, or a representative list if multiple works are involved.</li>
            <li>Identification of the material claimed to be infringing and information reasonably sufficient for LiveTimeData to locate it, preferably including the applicable URL.</li>
            <li>Information reasonably sufficient for us to contact you, such as your name, mailing address, telephone number, and email address.</li>
            <li>A statement that you have a good-faith belief that the complained-of use is not authorized by the copyright owner, its agent, or the law.</li>
            <li>A statement that the information in your complaint is accurate and, under penalty of perjury, that you are the copyright owner or authorized to act on behalf of the owner.</li>
          </ul>
          <p>LiveTimeData may request additional information when reasonably necessary to understand or process a complaint.</p>
          <p>LiveTimeData may remove or disable access to material while a complaint is investigated.</p>
          <p className="font-bold uppercase tracking-wider">IMPORTANT: LiveTimeData has not represented that the contact listed above is currently a Copyright Office-registered DMCA designated agent. If LiveTimeData completes a designated-agent registration, this section may be updated with the applicable registered-agent information.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">17. RESPONSE TO COPYRIGHT COMPLAINTS</h3>
          <p>LiveTimeData may investigate copyright complaints and may remove or disable access to material that we reasonably believe may infringe another person's rights.</p>
          <p>Where appropriate, LiveTimeData may notify the person who supplied the affected material.</p>
          <p>LiveTimeData may preserve information and records reasonably necessary to document the complaint, the Submission, permissions, communications, removal, restoration, or other action taken.</p>
          <p>LiveTimeData reserves the right to remove material without determining whether infringement has legally occurred.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">18. COUNTER-NOTIFICATIONS</h3>
          <p>If material you provided is removed or disabled because of a copyright complaint and you believe the removal resulted from mistake or misidentification, you may contact LiveTimeData at:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>
          <p>If LiveTimeData is operating under an applicable DMCA counter-notification procedure, a legally sufficient counter-notification may be required to contain the information required by applicable law, including identification of the removed material and its former location, your contact information, appropriate statements made under penalty of perjury, consent to applicable federal court jurisdiction and service of process, and your physical or electronic signature.</p>
          <p>LiveTimeData may provide additional instructions appropriate to the circumstances.</p>
          <p>Submitting a false copyright complaint or counter-notification may have legal consequences.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">19. REPEAT INFRINGEMENT</h3>
          <p>LiveTimeData maintains a policy of taking appropriate action concerning repeat copyright infringement.</p>
          <p>Where appropriate and in circumstances reasonably within our control, LiveTimeData may reject Submissions, restrict submission privileges, block contributors, remove material, terminate access to submission features, or take other reasonable action concerning persons we reasonably determine to be repeat infringers.</p>
          <p>LiveTimeData may maintain records reasonably necessary to administer and enforce this policy.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">20. OTHER CONTENT, PHOTO, WEBCAM, PRIVACY, AND RIGHTS COMPLAINTS</h3>
          <p>Not every removal request is a copyright complaint.</p>
          <p>If you own or operate a webcam, appear in a photograph, represent a business or organization, believe information violates your privacy or publicity rights, believe material is inaccurate, or have another legitimate concern about content appearing on LiveTimeData, contact:</p>
          <p className="font-bold">LiveTimeData@gmail.com</p>
          <p>Please identify the material, provide the applicable page or URL where possible, explain the nature of your concern, and provide information reasonably sufficient for us to evaluate the request.</p>
          <p>LiveTimeData may request reasonable evidence of identity, ownership, authority, or the claimed right before acting.</p>
          <p>We may correct, edit, restrict, replace, remove, or decline to remove material depending on the circumstances and applicable law.</p>
          <p>A correction or voluntary removal does not constitute an admission of wrongdoing or liability.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">21. THIRD-PARTY CONTENT, LINKS, DATA, AND EMBEDS</h3>
          <p>LiveTimeData may display information, advertisements, maps, media, photographs, feeds, links, embeds, listings, ticket links, business information, or other material supplied, hosted, operated, or controlled by third parties.</p>
          <p>Third-party material remains subject to the rights of its respective owners.</p>
          <p>Its appearance on LiveTimeData does not necessarily mean LiveTimeData owns, controls, sponsors, endorses, verifies, recommends, or is affiliated with the third party.</p>
          <p>LiveTimeData is not responsible for independent third-party websites, transactions, products, services, security, privacy practices, prices, availability, fulfillment, refunds, or representations.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">22. INFORMATION ACCURACY</h3>
          <p>LiveTimeData does not guarantee the accuracy, completeness, timeliness, availability, or reliability of information displayed through the Service.</p>
          <p>This includes time and time-zone information; weather and forecasts; maps, coordinates, boundaries, and geographic information; currency and exchange rates; events, dates, schedules, venues, tickets, and admission information; holidays; webcams and camera locations; attractions; restaurants; businesses; addresses; operating hours; prices; reservations; transportation information; historical information; recommendations; local facts; and other city information.</p>
          <p>Users should independently verify consequential information.</p>
          <p>LiveTimeData should not be used as the sole source for emergency, medical, legal, financial, aviation, marine, transportation, safety-critical, deadline-sensitive, or other consequential decisions.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">23. ADVERTISING, SPONSORSHIPS, AND AFFILIATE RELATIONSHIPS</h3>
          <p>LiveTimeData may display advertisements, sponsored material, promoted placements, affiliate links, referral links, or other commercial content and may receive compensation from advertising, referrals, affiliate relationships, sponsorships, promotions, purchases, or other commercial arrangements.</p>
          <p>Advertisements and third-party offers are not necessarily endorsed by LiveTimeData.</p>
          <p>Transactions with advertisers, merchants, ticket sellers, affiliate partners, businesses, or other third parties are between you and that third party unless LiveTimeData expressly states otherwise.</p>
          <p>Where required by law, LiveTimeData will appropriately identify sponsored, paid, promotional, or affiliate relationships.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">24. CONTESTS, PROMOTIONS, AND SPECIAL PROGRAMS</h3>
          <p>LiveTimeData may conduct contests, sweepstakes, promotions, school projects, community programs, commissioned projects, paid contributor arrangements, or other special activities.</p>
          <p>Separate official rules, agreements, eligibility requirements, releases, licenses, payment terms, or other conditions may apply.</p>
          <p>If specific rules or a separate written agreement conflict with these Terms, the specific rules or agreement control for that program.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">25. COMMUNICATIONS</h3>
          <p>If you provide contact information to LiveTimeData, we may use it as permitted by applicable law to respond to you; administer or follow up on a Submission; request information; communicate about events, listings, photographs, webcams, corrections, or other content; provide service-related notices; invite participation in surveys, contests, community or educational projects; communicate about advertising, sponsorships, partnerships, or opportunities; conduct lawful outreach; and send promotional, informational, or other communications permitted by law.</p>
          <p>Commercial or promotional communications will include any opt-out mechanism required by applicable law.</p>
          <p>An opt-out from promotional communications does not prevent communications reasonably necessary to respond to an active request, administer a Submission or program, address legal or security matters, honor an opt-out, or otherwise communicate as permitted by law.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">26. SERVICE CHANGES AND AVAILABILITY</h3>
          <p>LiveTimeData is an evolving service.</p>
          <p>We may add, change, suspend, replace, revise, remove, or discontinue any feature, page, data source, provider, category, interface, content item, or portion of the Service.</p>
          <p>We do not guarantee that any particular page, feature, provider, feed, listing, event, webcam, city, attraction, restaurant, content item, or other feature will remain available or that the Service will be uninterrupted, secure, or error-free.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">27. DISCLAIMER OF WARRANTIES</h3>
          <p className="uppercase">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE AND ALL INFORMATION, CONTENT, FEATURES, SUBMISSIONS, THIRD-PARTY MATERIAL, LINKS, EMBEDS, DATA, AND SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE."</p>
          <p className="uppercase">TO THE MAXIMUM EXTENT PERMITTED BY LAW, LIVETIMEDATA DISCLAIMS WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF ACCURACY, COMPLETENESS, TIMELINESS, AVAILABILITY, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND QUIET ENJOYMENT.</p>
          <p className="uppercase">LIVETIMEDATA DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE FROM HARMFUL COMPONENTS.</p>
          <p>Nothing in these Terms excludes warranties, liabilities, or legal rights that cannot lawfully be excluded.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">28. LIMITATION OF LIABILITY</h3>
          <p className="uppercase">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LIVETIMEDATA AND ITS OPERATOR, CONTRACTORS, SERVICE PROVIDERS, REPRESENTATIVES, AND AFFILIATED PARTICIPANTS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST REVENUE, LOST DATA, BUSINESS INTERRUPTION, TRAVEL COSTS, MISSED EVENTS, MISSED DEADLINES, PURCHASE DECISIONS, OR OTHER LOSSES ARISING FROM OR RELATING TO:</p>
          <ul className="list-disc pl-5 space-y-1 uppercase">
            <li>use of or inability to use the Service;</li>
            <li>reliance on information displayed through the Service;</li>
            <li>inaccurate, delayed, incomplete, outdated, or unavailable information;</li>
            <li>AI-assisted or automated content;</li>
            <li>user or contributor Submissions;</li>
            <li>copyright or other rights disputes involving submitted material;</li>
            <li>third-party material, links, products, services, advertisements, or transactions;</li>
            <li>event changes or cancellations;</li>
            <li>webcam, map, weather, time, currency, geographic, attraction, restaurant, business, or transportation information;</li>
            <li>changes to or discontinuation of the Service;</li>
            <li>interruptions, errors, security incidents, or technical failures.</li>
          </ul>
          <p>Where applicable law does not permit a limitation stated above, the limitation applies only to the maximum extent permitted by that law.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">29. INDEMNIFICATION</h3>
          <p>To the extent permitted by applicable law, you agree to defend, indemnify, and hold harmless LiveTimeData and its operator from claims, liabilities, losses, damages, and reasonable costs arising from your unlawful use of the Service, your material breach of these Terms, or a Submission you knowingly provide in violation of another person's rights or without authority you represented that you possessed.</p>
          <p>This provision applies only to the extent permitted by applicable law.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">30. PRIVACY</h3>
          <p>The LiveTimeData Privacy Policy explains how LiveTimeData collects, uses, retains, discloses, and otherwise processes information associated with the Service.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">31. MOBILE DEVICES AND FUTURE APPLICATIONS</h3>
          <p>These Terms apply when LiveTimeData is accessed through desktop computers, mobile phones, tablets, and other compatible devices.</p>
          <p>If LiveTimeData later provides a native application or another new platform, additional permissions, terms, or privacy disclosures may apply.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">32. GOVERNING LAW</h3>
          <p>Except to the extent applicable law requires otherwise, these Terms are governed by the laws of the State of North Carolina, United States, without regard to conflict-of-law principles.</p>
          <p>Any dispute not subject to a mandatory forum under applicable law will be brought in a state or federal court with appropriate jurisdiction in North Carolina.</p>
          <p>Nothing in these Terms eliminates rights or remedies that applicable law does not permit you to waive.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">33. SEVERABILITY AND NO WAIVER</h3>
          <p>If any provision of these Terms is determined to be invalid, unlawful, or unenforceable, that provision will be enforced to the maximum extent permitted by law and the remaining provisions will remain in effect.</p>
          <p>A failure by LiveTimeData to enforce a provision does not waive our right to enforce that provision or another provision later.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">34. CHANGES TO THESE TERMS</h3>
          <p>LiveTimeData may update these Terms as the Service, features, submission programs, laws, or business practices evolve.</p>
          <p>The Effective Date identifies the current version.</p>
          <p>For a Submission, the version accepted when the Submission was made will generally govern that Submission unless the contributor later agrees to revised terms, a separate written agreement applies, or applicable law requires otherwise.</p>
          <p>Where required by applicable law, material changes may be communicated through additional notice.</p>

          <h3 className="font-bold text-slate-900 uppercase tracking-wider mt-6 mb-1">35. CONTACT</h3>
          <p>Questions about these Terms, Submissions, copyright, content concerns, corrections, or removal requests may be sent to:</p>
          <p className="font-bold">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States<br /><br />Email: LiveTimeData@gmail.com</p>
        </div>
      )
    }
  };

  const { title, content } = contentMap[type];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden relative border border-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-6 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">{title}</h2>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-500 text-black flex items-center justify-center transition-colors shadow-sm"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
          {content}
        </div>

        {/* FOOTER ACTIONS AND AD SPACE */}
        <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {/* Pill Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={onClose} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              BACK TO SITE
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_event' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT EVENT
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'share_insights' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SHARE INSIGHTS
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_photo' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT PHOTO
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT WEBCAM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
