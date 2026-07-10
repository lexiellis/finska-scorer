-- Legacy blob store (kept for one-time migration from older app versions)
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists app_state_set_updated_at on public.app_state;
create trigger app_state_set_updated_at
before update on public.app_state
for each row execute function public.set_updated_at();

alter table public.app_state enable row level security;

drop policy if exists "Public read app_state" on public.app_state;
create policy "Public read app_state"
on public.app_state for select to anon using (true);

drop policy if exists "Public upsert app_state" on public.app_state;
create policy "Public upsert app_state"
on public.app_state for insert to anon with check (true);

drop policy if exists "Public update app_state" on public.app_state;
create policy "Public update app_state"
on public.app_state for update to anon using (true) with check (true);

-- Relational store: insert/upsert per row, shared stats, scribe-owned live sessions
create table if not exists public.finska_players (
  id text primary key,
  name text not null,
  created_at timestamptz not null
);

create table if not exists public.finska_matches (
  id text primary key,
  teams jsonb not null,
  team_order jsonb not null default '[]'::jsonb,
  player_order jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  ended_at timestamptz
);

create table if not exists public.finska_games (
  id text primary key,
  match_id text references public.finska_matches(id) on delete set null,
  mode text not null default 'game',
  teams jsonb not null,
  throw_order jsonb,
  scores jsonb not null default '{}'::jsonb,
  eliminated_team_ids jsonb not null default '[]'::jsonb,
  winner_team_id text,
  started_at timestamptz not null,
  ended_at timestamptz,
  game_number int,
  scribe_device_id text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.finska_shots (
  id text primary key,
  game_id text not null references public.finska_games(id) on delete cascade,
  team_id text not null,
  player_id text not null,
  shot_type text not null,
  distance text not null,
  score int,
  outcome text not null,
  recorded_at timestamptz not null,
  score_before int not null default 0,
  score_after int not null default 0,
  device_id text not null
);

create index if not exists finska_shots_game_id_idx on public.finska_shots(game_id);
create index if not exists finska_games_ended_at_idx on public.finska_games(ended_at);
create index if not exists finska_games_scribe_active_idx
  on public.finska_games(scribe_device_id) where ended_at is null;

drop trigger if exists finska_games_set_updated_at on public.finska_games;
create trigger finska_games_set_updated_at
before update on public.finska_games
for each row execute function public.set_updated_at();

alter table public.finska_players enable row level security;
alter table public.finska_matches enable row level security;
alter table public.finska_games enable row level security;
alter table public.finska_shots enable row level security;

drop policy if exists "Public read finska_players" on public.finska_players;
create policy "Public read finska_players"
on public.finska_players for select to anon using (true);
drop policy if exists "Public write finska_players" on public.finska_players;
create policy "Public write finska_players"
on public.finska_players for insert to anon with check (true);
drop policy if exists "Public update finska_players" on public.finska_players;
create policy "Public update finska_players"
on public.finska_players for update to anon using (true) with check (true);

drop policy if exists "Public delete finska_players" on public.finska_players;
create policy "Public delete finska_players"
on public.finska_players for delete to anon using (true);

drop policy if exists "Public read finska_matches" on public.finska_matches;
create policy "Public read finska_matches"
on public.finska_matches for select to anon using (true);
drop policy if exists "Public write finska_matches" on public.finska_matches;
create policy "Public write finska_matches"
on public.finska_matches for insert to anon with check (true);
drop policy if exists "Public update finska_matches" on public.finska_matches;
create policy "Public update finska_matches"
on public.finska_matches for update to anon using (true) with check (true);

drop policy if exists "Public read finska_games" on public.finska_games;
create policy "Public read finska_games"
on public.finska_games for select to anon using (true);
drop policy if exists "Public write finska_games" on public.finska_games;
create policy "Public write finska_games"
on public.finska_games for insert to anon with check (true);
drop policy if exists "Public update finska_games" on public.finska_games;
create policy "Public update finska_games"
on public.finska_games for update to anon using (true) with check (true);

drop policy if exists "Public read finska_shots" on public.finska_shots;
create policy "Public read finska_shots"
on public.finska_shots for select to anon using (true);
drop policy if exists "Public write finska_shots" on public.finska_shots;
create policy "Public write finska_shots"
on public.finska_shots for insert to anon with check (true);
drop policy if exists "Public update finska_shots" on public.finska_shots;
create policy "Public update finska_shots"
on public.finska_shots for update to anon using (true) with check (true);
