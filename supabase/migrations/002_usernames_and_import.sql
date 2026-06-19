alter table public.profiles
add column if not exists username text,
add column if not exists status text not null default 'active' check (status in ('active', 'inactive'));

create unique index if not exists profiles_username_unique
on public.profiles (lower(username))
where username is not null;

create index if not exists profiles_status_idx
on public.profiles (status);
