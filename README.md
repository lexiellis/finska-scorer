# Finska Scorer

A touch-friendly web app for logging Finska throws on iPad (or any device). Track every shot per player, live game scores, win rates, and stats charts.

## Features

- **Shot logging**: shot type, distance (4–12+ m), score (0–12), outcome
- **Teams** — multiple players per team; shared team score and miss streak
- **Live scores** with official Finska rules (first to **50** exactly; over 50 resets to **25**)
- **Three-miss rule** — 3 consecutive misses (outcome: Miss) eliminates the team
- **Practice mode** — solo logging with full rules; shots count in stats but not win rate
- **Player management** with persistent local storage
- **Stats & graphs**: win %, score distribution, distance, shot types, outcomes

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Use on iPad

1. Run the dev server on your PC, or build and host the app (`npm run build` then serve `dist/`).
2. On iPad Safari, open the app URL.
3. Tap **Share → Add to Home Screen** for a full-screen app-like experience.

Data is stored in the browser on that device (no account or server required).

## Deploy with shared storage (Vercel + Supabase)

This app can run as a shared scoreboard with one public URL and one shared data store.

### 1) Create a Supabase project

In the Supabase SQL editor, run:

```sql
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
on public.app_state
for select
to anon
using (true);

drop policy if exists "Public upsert app_state" on public.app_state;
create policy "Public upsert app_state"
on public.app_state
for insert
to anon
with check (true);

drop policy if exists "Public update app_state" on public.app_state;
create policy "Public update app_state"
on public.app_state
for update
to anon
using (true)
with check (true);
```

Then copy:
- Project URL (`Settings -> API -> Project URL`)
- `anon` public key (`Settings -> API -> Project API keys`)

### 2) Configure environment variables

Create `.env.local` for local testing:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3) Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repo and deploy.
3. In Vercel project settings, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Redeploy.

If Supabase env vars are not set, the app still works in local-only mode using browser storage.

## Shot fields

| Field | Options |
|-------|---------|
| Shot type | Standard, Retro, Elephant, Kick, Puikula, Bunch, Tuck, Crowd |
| Distance | 4–12 m, 12+ |
| Score | 0–12 (tap a circle) |
| Outcome | Intended, So-so, Unintended, Miss, Wrong pin, Collateral |

## Scoring rules

- Log **pins knocked** (0–12) each throw.
- First **team** to reach **50 exactly** wins a competitive game.
- If a throw would take a team **over 50**, that team's score resets to **25**.
- **3 misses in a row** (log outcome as **Miss**) eliminates the team — streak is shared by everyone on that team.
- Set up **2+ teams** with one or more players each before a competitive game.
- **Practice mode** uses the same rules for one player; end practice or start a new round after hitting 50 or 3 misses.
