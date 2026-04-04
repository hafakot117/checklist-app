-- ============================================================
-- Multi-Tool Platform Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Profiles (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'free' check (role in ('admin', 'pro', 'basic', 'free')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on first login
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. Tool access (which user can access which tool)
create table if not exists tool_access (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  tool_slug text not null,
  granted_at timestamptz default now(),
  unique(user_id, tool_slug)
);

-- 3. Checklists
create table if not exists checklists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Checklist items
create table if not exists checklist_items (
  id uuid default gen_random_uuid() primary key,
  checklist_id uuid references checklists(id) on delete cascade not null,
  text text not null,
  checked boolean not null default false,
  position int not null default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table tool_access enable row level security;
alter table checklists enable row level security;
alter table checklist_items enable row level security;

-- Profiles: users can read/update their own
create policy "own profile select" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);

-- Tool access: users can read their own
create policy "own tool_access select" on tool_access for select using (user_id = auth.uid());

-- Checklists: full CRUD on own checklists
create policy "own checklists" on checklists for all using (user_id = auth.uid());

-- Checklist items: full CRUD on items of own checklists
create policy "own checklist_items" on checklist_items for all using (
  exists (
    select 1 from checklists where id = checklist_id and user_id = auth.uid()
  )
);

-- ============================================================
-- Make yourself admin (replace with your email)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
-- ============================================================
