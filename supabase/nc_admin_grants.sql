-- Migration: nc_admin_grants table for Nexus Clash admin reward grants

create table nc_admin_grants (
  id         uuid         primary key default gen_random_uuid(),
  user_id    uuid         not null references auth.users(id) on delete cascade,
  coins      integer      not null default 0,
  gems       integer      not null default 0,
  shards     integer      not null default 0,
  cards      text[]       not null default '{}',
  claimed    boolean      not null default false,
  note       text,
  admin_id   uuid         not null references auth.users(id),
  created_at timestamptz  not null default now()
);

-- Fast lookup for a user's unclaimed grants
create index idx_nc_admin_grants_user_claimed
  on nc_admin_grants (user_id, claimed);

-- Row-Level Security
alter table nc_admin_grants enable row level security;

-- Admins can insert new grants
create policy "Admins can insert grants"
  on nc_admin_grants
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Users can read their own unclaimed grants
create policy "Users can select own unclaimed grants"
  on nc_admin_grants
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and claimed = false
  );

-- Users can claim their own grants (set claimed = true only)
create policy "Users can claim own grants"
  on nc_admin_grants
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and claimed = false
  )
  with check (
    auth.uid() = user_id
    and claimed = true
  );
