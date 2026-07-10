import type { AppData, Distance, Game, Outcome, Player, ShotType } from './types';
import { defaultPlayerOrder, defaultTeamOrder } from './match';
import { buildThrowOrder } from './teams';
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'finska-scorer-data';
const IMPORT_VERSION_KEY = 'finska-import-version';
const DEVICE_ID_KEY = 'finska-device-id';
const SUPABASE_TABLE = 'app_state';

type SupabaseStateRow = {
  id: string;
  data: AppData;
};

const emptyData = (): AppData => ({
  players: [],
  matches: [],
  games: [],
  shots: [],
});

function migrateShotType(shotType: string): ShotType {
  if (shotType === '12 Break') return 'Break';
  return shotType as ShotType;
}

function migrateDistance(distance: Distance | '9+' | number | string): Distance {
  if (distance === '9+') return '12+';
  if (distance === 12 || distance === '12') return '12+';
  return distance as Distance;
}

function migrateOutcome(outcome: string): Outcome {
  if (outcome === 'So-So') return 'So-so';
  return outcome as Outcome;
}

function migrateThrowOrder(game: Game): string[] | undefined {
  if (game.throwOrder?.length) return game.throwOrder;
  const teams = game.teams ?? [];
  if (teams.length === 0) return undefined;
  const teamOrder = defaultTeamOrder(teams);
  const playerOrder = defaultPlayerOrder(teams);
  return buildThrowOrder(teams, teamOrder, playerOrder);
}

function migrateGame(raw: Game, players: Player[]): Game {
  const storedMode = (raw as { mode?: string }).mode;
  const endedAt =
    storedMode === 'practice' && !raw.endedAt
      ? new Date().toISOString()
      : raw.endedAt;
  const mode = storedMode === 'stats' ? 'stats' : 'game';

  if (raw.teams?.length) {
    const migrated: Game = {
      ...raw,
      mode,
      endedAt,
      eliminatedTeamIds: raw.eliminatedTeamIds ?? [],
      winnerTeamId: raw.winnerTeamId ?? null,
    };
    return { ...migrated, throwOrder: migrateThrowOrder(migrated) };
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

  const migrated: Game = {
    ...raw,
    mode,
    teams,
    scores,
    eliminatedTeamIds: [],
    winnerTeamId: raw.winnerTeamId ?? raw.winnerId ?? null,
    endedAt,
    startedAt: raw.startedAt,
  };
  return { ...migrated, throwOrder: migrateThrowOrder(migrated) };
}

function migrate(data: AppData): AppData {
  const players = data.players ?? [];
  return {
    ...data,
    matches: data.matches ?? [],
    games: (data.games ?? []).map((g) => migrateGame(g, players)),
    shots: (data.shots ?? []).map((s) => ({
      ...s,
      teamId: s.teamId ?? s.playerId,
      scoreBefore: s.scoreBefore ?? 0,
      scoreAfter: s.scoreAfter ?? (s.score ?? 0),
      score: typeof s.score === 'number' ? s.score : null,
      shotType: migrateShotType(s.shotType as string),
      distance: migrateDistance(s.distance as Distance | '9+' | number | string),
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
  deviceId: string;
  remoteRowFound: boolean | null;
  lastSaveOk: boolean | null;
  error: string | null;
}

/** Stable id for this browser — each phone gets its own Supabase row. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = createId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return 'local-fallback';
  }
}

function getDeviceStateId(): string {
  return getDeviceId();
}

export function getStorageMode(): StorageMode {
  return isRemoteStorageConfigured() ? 'supabase' : 'local';
}

export function initialSyncStatus(): SyncStatus {
  return {
    mode: getStorageMode(),
    deviceId: getDeviceId(),
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

  const deviceId = getDeviceStateId();

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('id, data')
    .eq('id', deviceId)
    .maybeSingle<SupabaseStateRow>();

  if (error) {
    const message = error.message;
    console.error('Failed to load device app data from Supabase:', message);
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

  const deviceId = getDeviceStateId();

  const { error } = await supabase.from(SUPABASE_TABLE).upsert(
    {
      id: deviceId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    const message = error.message;
    console.error('Failed to save device app data to Supabase:', message);
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
