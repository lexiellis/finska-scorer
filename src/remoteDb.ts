import type { SupabaseClient } from '@supabase/supabase-js';
import { dedupePlayersByName } from './dedupePlayers';
import type { AppData, Game, Match, Player, Shot } from './types';

const RELATIONAL_MIGRATED_KEY = 'finska-relational-v1';
const LEGACY_SHARED_STATE_ID = 'global';
const LEGACY_TABLE = 'app_state';
const BATCH_SIZE = 400;

type LegacyStateRow = { id: string; data: AppData };

type PlayerRow = {
  id: string;
  name: string;
  created_at: string;
};

type MatchRow = {
  id: string;
  teams: Match['teams'];
  team_order: string[];
  player_order: Record<string, string[]>;
  started_at: string;
  ended_at: string | null;
};

type GameRow = {
  id: string;
  match_id: string | null;
  mode: Game['mode'];
  teams: Game['teams'];
  throw_order: string[] | null;
  scores: Record<string, number>;
  eliminated_team_ids: string[];
  winner_team_id: string | null;
  started_at: string;
  ended_at: string | null;
  game_number: number | null;
  scribe_device_id: string;
  updated_at?: string;
};

type ShotRow = {
  id: string;
  game_id: string;
  team_id: string;
  player_id: string;
  shot_type: Shot['shotType'];
  distance: string;
  score: number | null;
  outcome: Shot['outcome'];
  recorded_at: string;
  score_before: number;
  score_after: number;
  device_id: string;
};

function emptyData(): AppData {
  return { players: [], matches: [], games: [], shots: [] };
}

function mergeById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function pickNewerGame(a: Game, b: Game): Game {
  const aTime = a.endedAt ?? a.startedAt;
  const bTime = b.endedAt ?? b.startedAt;
  return aTime >= bTime ? a : b;
}

function annotateActiveScribe(games: Game[], sourceDeviceId: string): Game[] {
  return games.map((game) => {
    if (game.endedAt !== null || game.scribeDeviceId) return game;
    return { ...game, scribeDeviceId: sourceDeviceId };
  });
}

/** Merge many AppData blobs (local + legacy rows) into one dataset. */
export function mergeAppDataSources(
  sources: Array<{ deviceId: string; data: AppData }>,
): AppData {
  let players: Player[] = [];
  let matches: Match[] = [];
  let games: Game[] = [];
  let shots: Shot[] = [];

  for (const source of sources) {
    const annotatedGames = annotateActiveScribe(source.data.games, source.deviceId);
    players = mergeById([...players, ...source.data.players]);
    matches = mergeById([...matches, ...source.data.matches]);
    shots = mergeById([...shots, ...source.data.shots]);

    const gameMap = new Map(games.map((g) => [g.id, g]));
    for (const game of annotatedGames) {
      const existing = gameMap.get(game.id);
      if (!existing) {
        gameMap.set(game.id, game);
        continue;
      }
      if (existing.endedAt === null && game.endedAt === null) {
        if (existing.scribeDeviceId === game.scribeDeviceId) {
          gameMap.set(game.id, pickNewerGame(existing, game));
        } else if (existing.scribeDeviceId === source.deviceId) {
          gameMap.set(game.id, game);
        }
      } else if (existing.endedAt !== null && game.endedAt !== null) {
        gameMap.set(game.id, pickNewerGame(existing, game));
      } else if (game.endedAt !== null) {
        gameMap.set(game.id, game);
      }
    }
    games = [...gameMap.values()];
  }

  return dedupePlayersByName({ players, matches, games, shots }).data;
}

/** Prefer local active session for this device; union everything else. */
export function mergeLocalWithRemote(
  local: AppData,
  remote: AppData,
  deviceId: string,
): AppData {
  const merged = mergeAppDataSources([
    { deviceId, data: remote },
    { deviceId, data: local },
  ]);

  const localActive = local.games.find(
    (g) => g.endedAt === null && (g.scribeDeviceId === deviceId || !g.scribeDeviceId),
  );
  if (!localActive) return merged;

  return {
    ...merged,
    games: merged.games.map((g) => (g.id === localActive.id ? localActive : g)),
    shots: mergeById([
      ...merged.shots.filter((s) => s.gameId !== localActive.id),
      ...local.shots.filter((s) => s.gameId === localActive.id),
    ]),
  };
}

function visibleGamesForDevice(games: Game[], deviceId: string): Game[] {
  return games.filter(
    (g) => g.endedAt !== null || (Boolean(g.scribeDeviceId) && g.scribeDeviceId === deviceId),
  );
}

function syncableGames(games: Game[], deviceId: string): Game[] {
  return games.filter(
    (g) => g.endedAt !== null || g.scribeDeviceId === deviceId || !g.scribeDeviceId,
  );
}

function toPlayerRow(player: Player): PlayerRow {
  return {
    id: player.id,
    name: player.name,
    created_at: player.createdAt,
  };
}

function fromPlayerRow(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function toMatchRow(match: Match): MatchRow {
  return {
    id: match.id,
    teams: match.teams,
    team_order: match.teamOrder,
    player_order: match.playerOrder,
    started_at: match.startedAt,
    ended_at: match.endedAt,
  };
}

function fromMatchRow(row: MatchRow): Match {
  return {
    id: row.id,
    teams: row.teams,
    teamOrder: row.team_order,
    playerOrder: row.player_order,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function toGameRow(game: Game, deviceId: string): GameRow {
  return {
    id: game.id,
    match_id: game.matchId ?? null,
    mode: game.mode,
    teams: game.teams,
    throw_order: game.throwOrder ?? null,
    scores: game.scores,
    eliminated_team_ids: game.eliminatedTeamIds,
    winner_team_id: game.winnerTeamId,
    started_at: game.startedAt,
    ended_at: game.endedAt,
    game_number: game.gameNumber ?? null,
    scribe_device_id: game.scribeDeviceId ?? deviceId,
  };
}

function fromGameRow(row: GameRow): Game {
  return {
    id: row.id,
    matchId: row.match_id ?? undefined,
    mode: row.mode,
    teams: row.teams,
    throwOrder: row.throw_order ?? undefined,
    scores: row.scores,
    eliminatedTeamIds: row.eliminated_team_ids,
    winnerTeamId: row.winner_team_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    gameNumber: row.game_number ?? undefined,
    scribeDeviceId: row.scribe_device_id,
  };
}

function toShotRow(shot: Shot, deviceId: string): ShotRow {
  return {
    id: shot.id,
    game_id: shot.gameId,
    team_id: shot.teamId,
    player_id: shot.playerId,
    shot_type: shot.shotType,
    distance: String(shot.distance),
    score: shot.score,
    outcome: shot.outcome,
    recorded_at: shot.recordedAt,
    score_before: shot.scoreBefore,
    score_after: shot.scoreAfter,
    device_id: deviceId,
  };
}

function fromShotRow(row: ShotRow): Shot {
  const distance = row.distance === '12+' ? '12+' : (Number(row.distance) as Shot['distance']);
  return {
    id: row.id,
    gameId: row.game_id,
    teamId: row.team_id,
    playerId: row.player_id,
    shotType: row.shot_type,
    distance,
    score: row.score,
    outcome: row.outcome,
    recordedAt: row.recorded_at,
    scoreBefore: row.score_before,
    scoreAfter: row.score_after,
  };
}

async function batchUpsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<string | null> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (chunk.length === 0) continue;
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) return error.message;
  }
  return null;
}

export function isRelationalMigrated(): boolean {
  try {
    return localStorage.getItem(RELATIONAL_MIGRATED_KEY) === '1';
  } catch {
    return false;
  }
}

function markRelationalMigrated(): void {
  localStorage.setItem(RELATIONAL_MIGRATED_KEY, '1');
}

export async function upsertAppData(
  supabase: SupabaseClient,
  data: AppData,
  deviceId: string,
): Promise<string | null> {
  const { data: deduped, droppedPlayerIds } = dedupePlayersByName(data);
  const games = syncableGames(deduped.games, deviceId).map((g) =>
    g.scribeDeviceId ? g : { ...g, scribeDeviceId: deviceId },
  );
  const gameIds = new Set(games.map((g) => g.id));
  const matchIds = new Set(games.map((g) => g.matchId).filter(Boolean) as string[]);
  const matches = deduped.matches.filter((m) => matchIds.has(m.id) || m.endedAt !== null);
  const shots = deduped.shots.filter((s) => gameIds.has(s.gameId));

  let err = await batchUpsert(
    supabase,
    'finska_players',
    deduped.players.map((p) => toPlayerRow(p) as unknown as Record<string, unknown>),
  );
  if (err) return err;

  if (droppedPlayerIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('finska_players')
      .delete()
      .in('id', droppedPlayerIds);
    if (deleteError && !deleteError.message.includes('policy')) {
      console.warn('Could not delete duplicate player rows:', deleteError.message);
    }
  }

  err = await batchUpsert(
    supabase,
    'finska_matches',
    matches.map((m) => toMatchRow(m) as unknown as Record<string, unknown>),
  );
  if (err) return err;

  err = await batchUpsert(
    supabase,
    'finska_games',
    games.map((g) => toGameRow(g, deviceId) as unknown as Record<string, unknown>),
  );
  if (err) return err;

  err = await batchUpsert(
    supabase,
    'finska_shots',
    shots.map((s) => toShotRow(s, deviceId) as unknown as Record<string, unknown>),
  );
  return err;
}

export async function fetchRelationalAppData(
  supabase: SupabaseClient,
  deviceId: string,
): Promise<{ data: AppData | null; error: string | null }> {
  const [playersRes, matchesRes, gamesRes, shotsRes] = await Promise.all([
    supabase.from('finska_players').select('*'),
    supabase.from('finska_matches').select('*'),
    supabase.from('finska_games').select('*'),
    supabase.from('finska_shots').select('*'),
  ]);

  const firstError =
    playersRes.error?.message ??
    matchesRes.error?.message ??
    gamesRes.error?.message ??
    shotsRes.error?.message ??
    null;

  if (firstError) {
    if (firstError.includes('does not exist') || firstError.includes('schema cache')) {
      return { data: null, error: 'relational_tables_missing' };
    }
    return { data: null, error: firstError };
  }

  const games = visibleGamesForDevice(
    (gamesRes.data as GameRow[] | null)?.map(fromGameRow) ?? [],
    deviceId,
  );
  const gameIds = new Set(games.map((g) => g.id));

  const data: AppData = dedupePlayersByName({
    players: (playersRes.data as PlayerRow[] | null)?.map(fromPlayerRow) ?? [],
    matches: (matchesRes.data as MatchRow[] | null)?.map(fromMatchRow) ?? [],
    games,
    shots:
      (shotsRes.data as ShotRow[] | null)
        ?.map(fromShotRow)
        .filter((s) => gameIds.has(s.gameId)) ?? [],
  }).data;

  return { data, error: null };
}

export async function migrateLegacyBlobs(
  supabase: SupabaseClient,
  localData: AppData,
  deviceId: string,
  migrateFn: (data: AppData) => AppData,
): Promise<{ merged: AppData; error: string | null }> {
  if (isRelationalMigrated()) {
    return { merged: localData, error: null };
  }

  const sources: Array<{ deviceId: string; data: AppData }> = [
    { deviceId, data: localData },
  ];

  const { data: legacyRows, error } = await supabase
    .from(LEGACY_TABLE)
    .select('id, data');

  if (error && !error.message.includes('does not exist')) {
    return { merged: localData, error: error.message };
  }

  for (const row of (legacyRows as LegacyStateRow[] | null) ?? []) {
    if (!row?.data) continue;
    const sourceId = row.id === LEGACY_SHARED_STATE_ID ? deviceId : row.id;
    sources.push({ deviceId: sourceId, data: migrateFn({ ...emptyData(), ...row.data }) });
  }

  const merged = mergeAppDataSources(sources);
  const upsertError = await upsertAppData(supabase, merged, deviceId);
  if (upsertError) {
    return { merged: localData, error: upsertError };
  }

  markRelationalMigrated();
  return { merged, error: null };
}
