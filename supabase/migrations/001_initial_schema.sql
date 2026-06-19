create extension if not exists "pgcrypto";

create type public.user_role as enum ('employee', 'shift_lead', 'admin');
create type public.post_type as enum ('announcement', 'discussion', 'instruction');
create type public.priority as enum ('normal', 'important', 'critical');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text not null,
  role public.user_role not null default 'employee',
  status text not null default 'active' check (status in ('active', 'inactive')),
  department text,
  position text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 3 and 8000),
  type public.post_type not null default 'discussion',
  priority public.priority not null default 'normal',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text,
  file_path text not null,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.documents enable row level security;

create policy "Authenticated users can read profiles"
on public.profiles for select
to authenticated
using (true);

create policy "Admins can manage profiles"
on public.profiles for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Authenticated users can read posts"
on public.posts for select
to authenticated
using (true);

create policy "Authenticated users can create posts"
on public.posts for insert
to authenticated
with check (author_id = auth.uid() and type = 'discussion' and priority in ('normal', 'important') and is_pinned = false);

create policy "Authors can update own posts"
on public.posts for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "Shift leads and admins can manage posts"
on public.posts for all
to authenticated
using (public.current_user_role() in ('shift_lead', 'admin'))
with check (public.current_user_role() in ('shift_lead', 'admin'));

create policy "Authenticated users can read comments"
on public.comments for select
to authenticated
using (true);

create policy "Authenticated users can create comments"
on public.comments for insert
to authenticated
with check (author_id = auth.uid());

create policy "Authors can update own comments"
on public.comments for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "Authenticated users can read documents"
on public.documents for select
to authenticated
using (true);

create policy "Shift leads and admins can add documents"
on public.documents for insert
to authenticated
with check (uploaded_by = auth.uid() and public.current_user_role() in ('shift_lead', 'admin'));

create policy "Admins can manage documents"
on public.documents for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('warehouse-documents', 'warehouse-documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can read warehouse documents"
on storage.objects for select
to authenticated
using (bucket_id = 'warehouse-documents');

create policy "Shift leads and admins can upload warehouse documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'warehouse-documents' and public.current_user_role() in ('shift_lead', 'admin'));

create policy "Admins can manage warehouse documents"
on storage.objects for all
to authenticated
using (bucket_id = 'warehouse-documents' and public.current_user_role() = 'admin')
with check (bucket_id = 'warehouse-documents' and public.current_user_role() = 'admin');
