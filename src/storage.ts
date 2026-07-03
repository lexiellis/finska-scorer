import type { AppData, Distance, Game, Outcome, Player } from './types';
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'finska-scorer-data';
const IMPORT_VERSION_KEY = 'finska-import-version';
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

function migrateDistance(distance: Distance | '9+' | string): Distance {
  if (distance === '9+') return '12+';
  return distance as Distance;
}

function migrateOutcome(outcome: string): Outcome {
  if (outcome === 'So-So') return 'So-so';
  return outcome as Outcome;
}

function migrateGame(raw: Game, players: Player[]): Game {
  const storedMode = (raw as { mode?: string }).mode;
  const endedAt =
    storedMode === 'practice' && !raw.endedAt
      ? new Date().toISOString()
      : raw.endedAt;
  const mode = storedMode === 'stats' ? 'stats' : 'game';

  if (raw.teams?.length) {
    return {
      ...raw,
      mode,
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
    mode,
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
      scoreAfter: s.scoreAfter ?? (s.score ?? 0),
      score: typeof s.score === 'number' ? s.score : null,
      distance: migrateDistance(s.distance as Distance | '9+'),
      outcome: migrateOutcome(s.outcome as string),
    })),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const hasAnySupabaseEnv = supabaseUrl.length > 0 || supabaseAnonKey.length > 0;
const isSupabaseConfigValid = isHttpUrl(supabaseUrl) && supabaseAnonKey.length > 0;

const supabase =
  isSupabaseConfigValid
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

let warnedMissingSupabaseConfig = false;

export function isRemoteStorageConfigured(): boolean {
  return Boolean(supabase);
}

export type StorageMode = 'supabase' | 'local';

export type RemoteLoadResult =
  | { status: 'ok'; data: AppData }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'disabled' };

export type SaveResult =
  | { ok: true }
  | { ok: false; message: string }
  | { ok: true; skipped: true };

export interface SyncStatus {
  mode: StorageMode;
  remoteRowFound: boolean | null;
  lastSaveOk: boolean | null;
  error: string | null;
}

export function getStorageMode(): StorageMode {
  return isRemoteStorageConfigured() ? 'supabase' : 'local';
}

export function initialSyncStatus(): SyncStatus {
  return {
    mode: getStorageMode(),
    remoteRowFound: null,
    lastSaveOk: null,
    error: null,
  };
}

export function getImportDataVersion(): string | null {
  try {
    return localStorage.getItem(IMPORT_VERSION_KEY);
  } catch {
    return null;
  }
}

export function setImportDataVersion(version: string): void {
  localStorage.setItem(IMPORT_VERSION_KEY, version);
}

export function clearLocalAppData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(IMPORT_VERSION_KEY);
}

function warnIfRemoteStorageDisabled() {
  if (supabase || warnedMissingSupabaseConfig) return;
  warnedMissingSupabaseConfig = true;
  if (hasAnySupabaseEnv) {
    console.warn(
      'Supabase config is invalid. VITE_SUPABASE_URL must be a full http(s) URL and VITE_SUPABASE_ANON_KEY must be set. Using local-only storage.',
    );
    return;
  }
  console.info('Supabase not configured. Using local-only storage.');
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

export async function loadRemoteData(): Promise<RemoteLoadResult> {
  if (!supabase) {
    warnIfRemoteStorageDisabled();
    return { status: 'disabled' };
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('id, data')
    .eq('id', SHARED_STATE_ID)
    .maybeSingle<SupabaseStateRow>();

  if (error) {
    const message = error.message;
    console.error('Failed to load shared app data from Supabase:', message);
    return { status: 'error', message };
  }

  if (!data?.data) return { status: 'empty' };

  const migrated = migrate({ ...emptyData(), ...data.data });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  return { status: 'ok', data: migrated };
}

export async function saveData(data: AppData): Promise<SaveResult> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (!supabase) {
    warnIfRemoteStorageDisabled();
    return { ok: true, skipped: true };
  }

  const { error } = await supabase.from(SUPABASE_TABLE).upsert(
    {
      id: SHARED_STATE_ID,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    const message = error.message;
    console.error('Failed to save shared app data to Supabase:', message);
    return { ok: false, message };
  }

  return { ok: true };
}

/** Works on LAN HTTP (phones) where crypto.randomUUID is unavailable. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
