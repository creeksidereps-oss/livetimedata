import { sql } from '@vercel/postgres';
import { DashboardControls, RowCard, MassReleaseButton, FranchiseBuilder, GovCameraCard } from './ClientComponents';

export const dynamic = 'force-dynamic';

export default async function AdminCurationDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const tab = typeof params.tab === 'string' ? params.tab : 'events';
  const filter = typeof params.filter === 'string' ? params.filter : 'pending';

  let items: any[] = [];
  let error: string | null = null;

  try {
    if (tab === 'events') {
      if (filter === 'pending') {
        const { rows } = await sql`SELECT * FROM events WHERE status IN ('pending', 'pending_review', 'needs_attention', 'franchise_pending') ORDER BY created_at DESC LIMIT 50`;
        items = rows;
      } else if (filter === 'ai_approved') {
        const { rows } = await sql`SELECT * FROM events WHERE status = 'ai_approved' ORDER BY created_at ASC LIMIT 50`;
        items = rows;
      } else if (filter === 'approved') {
        const { rows } = await sql`SELECT * FROM events WHERE status = 'approved' AND event_date >= NOW() ORDER BY event_date ASC LIMIT 50`;
        items = rows;
      } else if (filter === 'historical') {
        const { rows } = await sql`SELECT * FROM events WHERE status = 'approved' AND event_date < NOW() AND event_date >= NOW() - INTERVAL '18 months' ORDER BY event_date DESC LIMIT 50`;
        items = rows;
      }
    } else if (tab === 'webcams') {
      if (filter === 'pending') {
        const { rows } = await sql`SELECT * FROM webcams WHERE status IN ('pending', 'needs_attention') ORDER BY created_at DESC LIMIT 50`;
        items = rows;
      } else if (filter === 'approved') {
        const { rows } = await sql`SELECT * FROM webcams WHERE status IN ('approved', 'live') AND source NOT IN ('DriveNC', 'NPS API') ORDER BY created_at DESC LIMIT 50`;
        items = rows;
      } else if (filter === 'government') {
        const { rows } = await sql`SELECT * FROM webcams WHERE status = 'live' OR source IN ('DriveNC', 'NPS API') ORDER BY created_at DESC LIMIT 100`;
        items = rows;
      } else if (filter === 'historical') {
        // Just mock historical webcams logic based on creation date
        const { rows } = await sql`SELECT * FROM webcams WHERE status = 'approved' AND created_at < NOW() - INTERVAL '18 months' ORDER BY created_at DESC LIMIT 50`;
        items = rows;
      }
    } else if (tab === 'photos') {
      if (filter === 'pending') {
        const { rows } = await sql`SELECT * FROM photos WHERE status IN ('pending', 'pending_review', 'needs_attention') ORDER BY created_at DESC LIMIT 50`;
        items = rows;
      } else if (filter === 'approved') {
        const { rows } = await sql`SELECT * FROM photos WHERE status = 'approved' ORDER BY created_at DESC LIMIT 50`;
        items = rows;
      } else if (filter === 'historical') {
        const { rows } = await sql`SELECT * FROM photos WHERE status = 'approved' AND created_at < NOW() - INTERVAL '18 months' ORDER BY created_at DESC LIMIT 50`;
        items = rows;
      }
    } else if (tab === 'franchises') {
      const { rows } = await sql`
        SELECT f.*, COUNT(fl.id) as location_count 
        FROM franchises f 
        LEFT JOIN franchise_locations fl ON f.id = fl.franchise_id 
        GROUP BY f.id 
        ORDER BY f.created_at DESC
      `;
      items = rows;
    }
  } catch (err: any) {
    console.error('Raw SQL Fetch Error:', err);
    error = "Failed to fetch dashboard data. Ensure the database schemas have been updated.";
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Admin Curation Console</h1>
          <p className="text-sm text-gray-500 font-medium">Raw Database Operations & Telemetry Monitoring</p>
        </div>

        <DashboardControls />

        {error ? (
          <div className="p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm font-bold">
            {error}
          </div>
        ) : tab === 'franchises' ? (
          <FranchiseBuilder items={items} />
        ) : (
          <div>
            {items.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-gray-300 rounded-2xl bg-white text-gray-400 font-semibold">
                No items found for this view.
              </div>
            ) : (
              <div className="space-y-4">
                {filter === 'ai_approved' && tab === 'events' && items.length > 0 && (
                  <MassReleaseButton items={items.map(i => ({ id: i.id, type: 'event', email: i.user_email, title: i.title }))} />
                )}
                {items.map((item) => (
                  filter === 'government' || item.source === 'DriveNC' || item.source === 'NPS API' ? (
                    <GovCameraCard key={item.id} item={item} />
                  ) : (
                    <RowCard key={item.id} item={item} type={tab === 'photos' ? 'photo' : tab.slice(0, -1)} />
                  )
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
