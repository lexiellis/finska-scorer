import type { AppData, Game, Player } from './types';
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'finska-scorer-data';
const SHARED_STATE_ID = 'global';
const SUPABASE_TABLE = 'app_state';

type SupabaseStateRow = {
  id: string;
  data: AppData;
};

const emptyData = (): AppData => ({
  players: [],
  games: [],
  shots: [],
});

function migrateGame(raw: Game, players: Player[]): Game {
  const storedMode = (raw as { mode?: string }).mode;
  const endedAt =
    storedMode === 'practice' && !raw.endedAt
      ? new Date().toISOString()
      : raw.endedAt;

  if (raw.teams?.length) {
    return {
      ...raw,
      mode: 'game',
      endedAt,
      eliminatedTeamIds: raw.eliminatedTeamIds ?? [],
      winnerTeamId: raw.winnerTeamId ?? null,
    };
  }

  const legacyIds = raw.playerIds ?? [];
  const teams = legacyIds.map((pid) => ({
    id: pid,
    name: players.find((p) => p.id === pid)?.name ?? 'Player',
    playerIds: [pid],
  }));

  const scores: Record<string, number> = {};
  for (const t of teams) {
    const pid = t.playerIds[0]!;
    scores[t.id] = raw.scores?.[pid] ?? raw.scores?.[t.id] ?? 0;
  }

  return {
    ...raw,
    mode: 'game',
    teams,
    scores,
    eliminatedTeamIds: [],
    winnerTeamId: raw.winnerTeamId ?? raw.winnerId ?? null,
    endedAt,
    startedAt: raw.startedAt,
  };
}

function migrate(data: AppData): AppData {
  const players = data.players ?? [];
  return {
    ...data,
    games: (data.games ?? []).map((g) => migrateGame(g, players)),
    shots: (data.shots ?? []).map((s) => ({
      ...s,
      teamId: s.teamId ?? s.playerId,
      scoreBefore: s.scoreBefore ?? 0,
      scoreAfter: s.scoreAfter ?? s.score,
    })),
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

let warnedMissingSupabaseConfig = false;

export function isRemoteStorageConfigured(): boolean {
  return Boolean(supabase);
}

function warnIfRemoteStorageDisabled() {
  if (supabase || warnedMissingSupabaseConfig) return;
  warnedMissingSupabaseConfig = true;
  console.info(
    'Supabase not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY). Using local-only storage.',
  );
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return migrate({ ...emptyData(), ...JSON.parse(raw) } as AppData);
  } catch {
    return emptyData();
  }
}

export async function loadRemoteData(): Promise<AppData | null> {
  if (!supabase) {
    warnIfRemoteStorageDisabled();
    return null;
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('id, data')
    .eq('id', SHARED_STATE_ID)
    .maybeSingle<SupabaseStateRow>();

  if (error) {
    console.error('Failed to load shared app data from Supabase:', error.message);
    return null;
  }

  if (!data?.data) return null;
  const migrated = migrate({ ...emptyData(), ...data.data });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}

export async function saveData(data: AppData): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (!supabase) {
    warnIfRemoteStorageDisabled();
    return;
  }

  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .upsert({ id: SHARED_STATE_ID, data }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to save shared app data to Supabase:', error.message);
  }
}

/** Works on LAN HTTP (phones) where crypto.randomUUID is unavailable. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
