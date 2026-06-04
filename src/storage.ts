import type { AppData, Game, Player } from './types';

const STORAGE_KEY = 'finska-scorer-data';

const emptyData = (): AppData => ({
  players: [],
  games: [],
  shots: [],
});

function migrateGame(game: Game, players: Player[]): Game {
  if (game.teams?.length) {
    return {
      ...game,
      mode: game.mode ?? 'game',
      eliminatedTeamIds: game.eliminatedTeamIds ?? [],
      winnerTeamId: game.winnerTeamId ?? null,
    };
  }

  const legacyIds = game.playerIds ?? [];
  const teams = legacyIds.map((pid) => ({
    id: pid,
    name: players.find((p) => p.id === pid)?.name ?? 'Player',
    playerIds: [pid],
  }));

  const scores: Record<string, number> = {};
  for (const t of teams) {
    const pid = t.playerIds[0]!;
    scores[t.id] = game.scores?.[pid] ?? game.scores?.[t.id] ?? 0;
  }

  return {
    ...game,
    mode: game.mode ?? 'game',
    teams,
    scores,
    eliminatedTeamIds: [],
    winnerTeamId: game.winnerTeamId ?? game.winnerId ?? null,
    endedAt: game.endedAt,
    startedAt: game.startedAt,
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

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return migrate({ ...emptyData(), ...JSON.parse(raw) } as AppData);
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Works on LAN HTTP (phones) where crypto.randomUUID is unavailable. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
