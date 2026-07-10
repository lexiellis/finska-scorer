import { createId } from './storage';
import type { AppData, Distance, Game, Outcome, Player, Shot, ShotType } from './types';
import { DISTANCES, OUTCOMES, SHOT_TYPES } from './types';

export const BUNDLED_LOG_SESSION_ID = 'import-molkky-log-v1';

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export interface ImportLogResult {
  data: AppData;
  imported: number;
  skipped: boolean;
  message: string;
}

interface CsvRow {
  player: string;
  shotType: string;
  distance: string;
  outcome: string;
  hit: string;
  date: string;
}

function parseCsvRows(csvText: string): CsvRow[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: CsvRow[] = [];

  for (const line of lines) {
    if (line.startsWith('MÖLKKY') || line.startsWith('Player,')) continue;
    const parts = line.split(',');
    if (parts.length < 5 || !parts[0]?.trim()) continue;
    rows.push({
      player: parts[0].trim(),
      shotType: parts[1]?.trim() ?? '',
      distance: parts[2]?.trim() ?? '',
      outcome: parts[3]?.trim() ?? '',
      hit: parts[4]?.trim() ?? '',
      date: parts[5]?.trim() ?? '',
    });
  }

  return rows;
}

function parseLogDate(value: string, fallback: Date): Date {
  if (!value) return fallback;
  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!match) return fallback;
  const day = Number(match[1]);
  const month = MONTHS[match[2]!];
  const year = 2000 + Number(match[3]);
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return fallback;
  return new Date(year, month, day, 12, 0, 0, 0);
}

function parseDistance(raw: string): Distance | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('+')) {
    const label = trimmed.replace(/m$/i, '');
    return label === '12' ? '12+' : null;
  }
  const n = Number(trimmed.replace(/m$/i, ''));
  if (!Number.isFinite(n)) return null;
  if (n === 12) return '12+';
  return DISTANCES.includes(n as Distance) ? (n as Distance) : null;
}

function normalizeOutcome(raw: string): Outcome | null {
  const normalized = raw === 'So-So' ? 'So-so' : raw;
  return OUTCOMES.includes(normalized as Outcome) ? (normalized as Outcome) : null;
}

function normalizeShotType(raw: string): ShotType | null {
  const mapped = raw === '12 Break' ? 'Break' : raw;
  return SHOT_TYPES.includes(mapped as ShotType) ? (mapped as ShotType) : null;
}

function scoreFromRow(_hit: string, _outcome: Outcome): number | null {
  return null;
}

function upsertPlayer(players: Player[], name: string): { players: Player[]; player: Player } {
  const existing = players.find((p) => p.name === name);
  if (existing) return { players, player: existing };
  const player: Player = {
    id: createId(),
    name,
    createdAt: new Date().toISOString(),
  };
  return { players: [...players, player], player };
}

export const IMPORT_DATA_VERSION = 'v2-null-scores';

export function importLogCsv(
  csvText: string,
  existing: AppData,
  options: { sessionId?: string; replaceExisting?: boolean; freshImport?: boolean } = {},
): ImportLogResult {
  const sessionId = options.sessionId ?? BUNDLED_LOG_SESSION_ID;
  const base = options.freshImport ? emptyAppData() : existing;
  const rows = parseCsvRows(csvText);

  if (rows.length === 0) {
    return { data: base, imported: 0, skipped: true, message: 'No rows found in CSV' };
  }

  const alreadyImported = base.games.some((g) => g.id === sessionId);
  if (alreadyImported && !options.replaceExisting && !options.freshImport) {
    return {
      data: base,
      imported: 0,
      skipped: true,
      message: 'This log was already imported',
    };
  }

  let players = [...base.players];
  const playerIdByName = new Map<string, string>();
  const shots: Shot[] = [];
  let lastDate = new Date(2026, 6, 2, 12, 0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const shotType = normalizeShotType(row.shotType);
    const distance = parseDistance(row.distance);
    const outcome = normalizeOutcome(row.outcome);
    if (!shotType || distance === null || !outcome) continue;

    const rowDate = parseLogDate(row.date, lastDate);
    lastDate = rowDate;

    let nextPlayers = players;
    let player: Player;
    const cachedId = playerIdByName.get(row.player);
    if (cachedId) {
      player = players.find((p) => p.id === cachedId)!;
    } else {
      const upserted = upsertPlayer(players, row.player);
      nextPlayers = upserted.players;
      player = upserted.player;
      playerIdByName.set(row.player, player.id);
    }
    players = nextPlayers;

    const score = scoreFromRow(row.hit, outcome);
    const recordedAt = new Date(rowDate.getTime() + i * 1000).toISOString();

    shots.push({
      id: createId(),
      gameId: sessionId,
      teamId: player.id,
      playerId: player.id,
      shotType,
      distance,
      score,
      outcome,
      recordedAt,
      scoreBefore: 0,
      scoreAfter: 0,
    });
  }

  if (shots.length === 0) {
    return { data: base, imported: 0, skipped: true, message: 'No valid shots in CSV' };
  }

  const teamPlayerIds = [...new Set(shots.map((s) => s.playerId))];
  const teams = teamPlayerIds.map((pid) => ({
    id: pid,
    name: '',
    playerIds: [pid],
  }));

  const game: Game = {
    id: sessionId,
    mode: 'stats',
    teams,
    throwOrder: teamPlayerIds,
    scores: Object.fromEntries(teams.map((t) => [t.id, 0])),
    eliminatedTeamIds: [],
    winnerTeamId: null,
    startedAt: shots[0]!.recordedAt,
    endedAt: shots[shots.length - 1]!.recordedAt,
  };

  const games = options.freshImport
    ? [game]
    : alreadyImported
      ? base.games.map((g) => (g.id === sessionId ? game : g))
      : [...base.games, game];
  const existingShots = options.freshImport
    ? []
    : alreadyImported
      ? base.shots.filter((s) => s.gameId !== sessionId)
      : base.shots;

  return {
    data: {
      players,
      matches: base.matches ?? [],
      games,
      shots: [...existingShots, ...shots],
    },
    imported: shots.length,
    skipped: false,
    message: `Imported ${shots.length} throws from spreadsheet`,
  };
}

function emptyAppData(): AppData {
  return { players: [], matches: [], games: [], shots: [] };
}

export async function importBundledMolkkyLog(
  existing: AppData,
  options: { freshImport?: boolean } = {},
): Promise<ImportLogResult> {
  try {
    const res = await fetch('/data/molkky-log.csv');
    if (!res.ok) {
      return { data: existing, imported: 0, skipped: true, message: 'Bundled CSV not found' };
    }
    const csv = await res.text();
    return importLogCsv(csv, existing, {
      sessionId: BUNDLED_LOG_SESSION_ID,
      replaceExisting: true,
      freshImport: options.freshImport,
    });
  } catch {
    return { data: existing, imported: 0, skipped: true, message: 'Failed to load bundled CSV' };
  }
}
