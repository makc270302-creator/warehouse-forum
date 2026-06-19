create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'google',
  triggered_by text,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  deactivated_count integer not null default 0,
  skipped_count integer not null default 0,
  password_updated_count integer not null default 0,
  error_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sync_logs_created_at_idx
on public.sync_logs (created_at desc);

alter table public.sync_logs enable row level security;

create policy "Admins can read sync logs"
on public.sync_logs for select
to authenticated
using (public.current_user_role() = 'admin');
