-- Migration: Open read access for leaderboard queries
-- Run this in the Supabase SQL editor on your existing database.
-- The schema.sql file already reflects these changes for fresh installs.

-- profiles: allow anyone to read (for nickname display on leaderboards)
drop policy if exists "Users can read own profile" on profiles;
create policy "Anyone can read profiles"
  on profiles for select using (true);

-- user_cosmetics: allow anyone to read (for avatar/cosmetics display)
drop policy if exists "Users can read own cosmetics" on user_cosmetics;
create policy "Anyone can read cosmetics"
  on user_cosmetics for select using (true);

-- user_stats: allow anyone to read (for leaderboard rankings)
drop policy if exists "Users can read own stats" on user_stats;
create policy "Anyone can read stats"
  on user_stats for select using (true);

-- user_achievements: allow anyone to read (for public profile achievement counts)
drop policy if exists "Users can read own achievements" on user_achievements;
create policy "Anyone can read achievements"
  on user_achievements for select using (true);
