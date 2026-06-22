create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('employee', 'shift_lead', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type user_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type post_type as enum ('announcement', 'discussion', 'instruction');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type priority as enum ('normal', 'important', 'critical');
exception when duplicate_object then null;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  full_name text not null,
  password_hash text not null,
  role user_role not null default 'employee',
  status user_status not null default 'active',
  department text,
  position text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_username_unique on users (lower(username));
create index if not exists users_status_idx on users (status);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expiry_idx on sessions (expires_at);

create table if not exists login_attempts (
  attempt_key text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);

create index if not exists login_attempts_blocked_idx on login_attempts (blocked_until);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 3 and 8000),
  type post_type not null default 'discussion',
  priority priority not null default 'normal',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_feed_idx on posts (is_pinned desc, created_at desc);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on comments (post_id, created_at);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text,
  file_path text not null,
  original_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual',
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

create table if not exists audit_logs (
  id bigserial primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  ip_address inet,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_id, created_at desc);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users for each row execute function set_updated_at();

drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at before update on posts for each row execute function set_updated_at();
