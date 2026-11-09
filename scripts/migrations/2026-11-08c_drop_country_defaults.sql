-- scripts/migrations/2026-11-08c_drop_country_defaults.sql
-- No column may silently default a country (owner rule: no location defaults).
ALTER TABLE IF EXISTS entities         ALTER COLUMN country_code DROP DEFAULT;
ALTER TABLE IF EXISTS outreach_targets ALTER COLUMN country      DROP DEFAULT;
ALTER TABLE IF EXISTS city_fun_facts   ALTER COLUMN country_name DROP DEFAULT;
