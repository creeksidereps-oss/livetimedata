import { sql } from "@/lib/db";
import { notFound } from "next/navigation";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";
import { Calendar, MapPin, Clock, ExternalLink, Mail, Phone, User, Ticket } from "lucide-react";
import AddToCalendarButton from '@/components/AddToCalendarButton';

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { rows } = await sql`SELECT * FROM events WHERE id = ${resolvedParams.id} LIMIT 1`;
  const event = rows[0];

  if (!event) {
    return {
      title: 'Event Not Found | LiveTimeData',
      description: 'The requested event could not be found.'
    };
  }

  return {
    title: `${event.title} - ${event.city_name} | LiveTimeData`,
    description: event.details.substring(0, 160),
    openGraph: {
      title: `${event.title} in ${event.city_name}`,
      description: event.details.substring(0, 160),
      images: [
        {
          url: event.event_flyer_url || '/default-event-fallback.jpg', 
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${event.title} in ${event.city_name}`,
      description: event.details.substring(0, 160),
      images: [event.event_flyer_url || '/default-event-fallback.jpg'],
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { rows } = await sql`SELECT * FROM events WHERE id = ${resolvedParams.id}`;
  if (rows.length === 0) return notFound();
  
  const event = rows[0];

  const shareUrl = `https://livetimedata.com/events/${event.id}`;
  const displayDate = new Date(event.event_date).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-purple-200">
      
      {/* Premium Gradient Header */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 pt-8 pb-32 px-4 sm:px-6 relative overflow-hidden">
        {/* Subtle decorative background shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500 rounded-full mix-blend-screen filter blur-[100px] opacity-50"></div>
          <div className="absolute top-24 -right-24 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-[100px] opacity-50"></div>
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <Link href={`/city-dashboard?slug=${event.city_name.toLowerCase().replace(/\s+/g, '-')}-${(event.state_name || '').toLowerCase()}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-sm font-bold text-white uppercase tracking-wider backdrop-blur-md transition-all mb-8 shadow-sm">
            &larr; Back to {event.city_name} Calendar
          </Link>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {event.category?.split(',').map((cat: string) => (
              <span key={cat} className="px-3 py-1 bg-white/10 text-white text-[10px] font-black uppercase rounded-full tracking-[0.1em] border border-white/20 backdrop-blur-sm shadow-sm">
                {cat.trim()}
              </span>
            ))}
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight drop-shadow-md mb-4">
            {event.title}
          </h1>
          <p className="text-indigo-200 font-medium text-lg md:text-xl max-w-2xl flex items-center gap-2">
            <MapPin size={20} className="shrink-0" /> {event.city_name}{event.state_name ? `, ${event.state_name}` : ''}
          </p>
        </div>
      </div>

      {/* Main Content Area overlapping the header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-24 relative z-20 pb-20">
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
          
          <div className="p-8 md:p-12 space-y-10">
            {/* Action Bar (Buttons) */}
            <div className="flex flex-wrap items-center gap-3 pb-8 border-b border-slate-100">
              <AddToCalendarButton 
                event={{
                  title: event.title,
                  details: event.details,
                  venue: event.venue,
                  eventDate: new Date(event.event_date).toISOString().slice(0, 10),
                  startTime: event.start_time
                }} 
              />
              {event.affiliate_url && (
                <a 
                  href={event.affiliate_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Ticket size={18} /> Get Tickets
                </a>
              )}

              {event.registration_url && (
                <a 
                  href={event.registration_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <User size={18} /> Vendor Registration
                </a>
              )}


              <div className="ml-auto">
                <ShareButton title={event.title} text={`Check out ${event.title} in ${event.city_name}!`} url={shareUrl} />
              </div>
            </div>

            {/* Quick Info Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                    <Calendar size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Date & Time</h3>
                    <div className="font-bold text-slate-900 text-lg leading-snug">{displayDate}</div>
                    <div className="text-slate-600 font-medium">{event.start_time || "Time TBA"}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <MapPin size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Location</h3>
                    <div className="font-bold text-slate-900 text-lg leading-snug">{event.venue}</div>
                    {event.venue_address ? (
                      <a 
                        href={`https://maps.google.com/?q=${encodeURIComponent(event.venue + ' ' + event.venue_address + ' ' + event.city_name)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium transition-colors hover:underline"
                      >
                        {event.venue_address}
                      </a>
                    ) : (
                      <div className="text-slate-600 font-medium">{event.city_name}{event.state_name ? `, ${event.state_name}` : ''}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Organizer Info</h3>
                
                {event.hosting_entity && (
                  <div className="flex items-center gap-3">
                    <User size={16} className="text-slate-400" />
                    <span className="font-semibold text-slate-800">{event.hosting_entity}</span>
                  </div>
                )}
                
                {event.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-slate-400" />
                    <a href={`mailto:${event.contact_email}`} className="font-medium text-blue-600 hover:underline">{event.contact_email}</a>
                  </div>
                )}
                
                {event.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-slate-400" />
                    <a href={`tel:${event.contact_phone}`} className="font-medium text-blue-600 hover:underline">{event.contact_phone}</a>
                  </div>
                )}

                {(!event.hosting_entity && !event.contact_email && !event.contact_phone) && (
                  <div className="text-sm text-slate-500 italic">No specific organizer details provided.</div>
                )}
              </div>
            </div>

            {/* Event Description */}
            <div>
              <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                About this Event
              </h3>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 leading-relaxed text-[17px] whitespace-pre-wrap">{event.details}</p>
              </div>
            </div>
          </div>

          {/* Flyer / Ads Section at the bottom */}
          {event.event_flyer_url && (
            <div className="border-t border-slate-100 bg-slate-50 p-8 md:p-12">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-6 text-center">Event Flyer & Materials</h3>
              <div className="max-w-2xl mx-auto rounded-xl overflow-hidden shadow-lg border border-slate-200/60 bg-white">
                <img 
                  src={event.event_flyer_url} 
                  alt={`${event.title} Flyer`} 
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
