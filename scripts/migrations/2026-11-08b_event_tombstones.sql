-- scripts/migrations/2026-11-08b_event_tombstones.sql
-- Records deleted event IDs so /events/{id} can answer 410 Gone (tells Google the page was removed on purpose).
CREATE TABLE IF NOT EXISTS event_tombstones (
  id         integer PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT NOW(),
  reason     text
);
