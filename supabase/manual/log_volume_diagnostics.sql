-- Read-only: changes nothing. Shows where the Logs Ingest quota goes, to compare before and after a deploy.

-- 1. SQL Editor: the Postgres settings that decide how much Postgres itself logs.
SELECT name, setting, unit
FROM pg_settings
WHERE name IN ('log_statement', 'log_min_duration_statement', 'log_min_messages', 'log_connections', 'log_disconnections')
ORDER BY name;

-- 2. SQL Editor: the statements that run most often. Needs the pg_stat_statements extension, which Supabase enables by
--    default. Run each statement on its own: the editor may only show the last result.
SELECT calls, round(total_exec_time::numeric) AS total_ms, round(mean_exec_time::numeric, 1) AS mean_ms, left(query, 120) AS query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 25;

-- 2a. The period those counts cover: they add up from this moment.
SELECT stats_reset FROM pg_stat_statements_info;

-- 2b. The statements that take the most total time. Rare but slow ones, like the portal's list, only show up here.
SELECT calls, round(total_exec_time::numeric) AS total_ms, round(mean_exec_time::numeric, 1) AS mean_ms, left(query, 120) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 25;

-- The next three are NOT for the SQL Editor: paste them, without the leading "-- ", into Logs & Analytics -> Logs Explorer.
--
-- 3. Log lines per source:
-- select 'edge' as source, count(*) as lines from edge_logs
-- union all select 'postgres', count(*) from postgres_logs
-- union all select 'auth', count(*) from auth_logs
-- union all select 'postgrest', count(*) from postgrest_logs
-- union all select 'storage', count(*) from storage_logs
-- order by lines desc
--
-- 4. Which API paths produce the most requests:
-- select r.path as path, count(*) as requests
-- from edge_logs
-- cross join unnest(metadata) as m
-- cross join unnest(m.request) as r
-- group by path
-- order by requests desc
-- limit 30
--
-- 5. Who validates tokens: a "node" user agent is the app's server, a browser name is a visitor's tab.
-- select h.user_agent as user_agent, count(*) as requests
-- from edge_logs
-- cross join unnest(metadata) as m
-- cross join unnest(m.request) as r
-- cross join unnest(r.headers) as h
-- where r.path = '/auth/v1/user'
-- group by user_agent
-- order by requests desc
-- limit 20
