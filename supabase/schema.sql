-- ════════════════════════════════════════════════════════════════════════════
-- WebGames — Supabase schema for cloud sync
-- Run once via Supabase SQL editor or migration tool.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Profiles ─────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  nickname   text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Anyone can read profiles"
  on profiles for select using (true);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- ── User cosmetics ───────────────────────────────────────────────────────────

create table if not exists user_cosmetics (
  user_id uuid primary key references auth.users on delete cascade,
  data    jsonb not null default '{}'::jsonb
);

alter table user_cosmetics enable row level security;

create policy "Anyone can read cosmetics"
  on user_cosmetics for select using (true);

create policy "Users can insert own cosmetics"
  on user_cosmetics for insert with check (auth.uid() = user_id);

create policy "Users can update own cosmetics"
  on user_cosmetics for update using (auth.uid() = user_id);

-- ── User achievements ────────────────────────────────────────────────────────

create table if not exists user_achievements (
  user_id  uuid primary key references auth.users on delete cascade,
  unlocked text[] not null default '{}'::text[]
);

alter table user_achievements enable row level security;

create policy "Anyone can read achievements"
  on user_achievements for select using (true);

create policy "Users can insert own achievements"
  on user_achievements for insert with check (auth.uid() = user_id);

create policy "Users can update own achievements"
  on user_achievements for update using (auth.uid() = user_id);

-- ── User stats ───────────────────────────────────────────────────────────────

create table if not exists user_stats (
  user_id       uuid primary key references auth.users on delete cascade,
  plays_total   int  not null default 0,
  wins_total    int  not null default 0,
  invites_total int  not null default 0,
  plays_by_game jsonb not null default '{}'::jsonb,
  wins_by_game  jsonb not null default '{}'::jsonb
);

alter table user_stats enable row level security;

create policy "Anyone can read stats"
  on user_stats for select using (true);

create policy "Users can insert own stats"
  on user_stats for insert with check (auth.uid() = user_id);

create policy "Users can update own stats"
  on user_stats for update using (auth.uid() = user_id);

-- ── User unlocked cosmetics ─────────────────────────────────────────────────

create table if not exists user_unlocked_cosmetics (
  user_id uuid primary key references auth.users on delete cascade,
  data    jsonb not null default '{}'::jsonb
);

alter table user_unlocked_cosmetics enable row level security;

create policy "Users can read own unlocked cosmetics"
  on user_unlocked_cosmetics for select using (auth.uid() = user_id);

create policy "Users can insert own unlocked cosmetics"
  on user_unlocked_cosmetics for insert with check (auth.uid() = user_id);

create policy "Users can update own unlocked cosmetics"
  on user_unlocked_cosmetics for update using (auth.uid() = user_id);
