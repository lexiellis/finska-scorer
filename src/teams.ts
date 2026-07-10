import { applyFinskaScore } from './scoring';
import type { Game, Outcome, Shot, Team } from './types';

export const CONSECUTIVE_MISS_LIMIT = 3;

export function isMissOutcome(outcome: Outcome, score: number | null): boolean {
  if (score === null) {
    return outcome === 'Miss' || outcome === 'Wrong Pin';
  }
  return score === 0 || outcome === 'Miss' || outcome === 'Wrong Pin';
}

export function isStatsSession(game: Game): boolean {
  return game.mode === 'stats';
}

export function getGamePlayerIds(game: Game): string[] {
  return game.teams.flatMap((t) => t.playerIds);
}

export function getTeamForPlayer(game: Game, playerId: string): Team | undefined {
  return game.teams.find((t) => t.playerIds.includes(playerId));
}

export function getActiveTeams(game: Game): Team[] {
  return game.teams.filter((t) => !game.eliminatedTeamIds.includes(t.id));
}

export function getActivePlayerIds(game: Game): string[] {
  return getActiveTeams(game).flatMap((t) => t.playerIds);
}

function getActiveThrowOrder(game: Game): string[] {
  const activeIds = new Set(getActivePlayerIds(game));
  if (game.throwOrder?.length) {
    return game.throwOrder.filter((id) => activeIds.has(id));
  }
  return getActiveTeams(game).flatMap((t) => t.playerIds);
}

/** Flat throw rotation: teams alternate in teamOrder; players rotate within each team. */
export function buildThrowOrder(
  teams: Team[],
  teamOrder: string[],
  playerOrder: Record<string, string[]>,
  startingTeamId?: string,
): string[] {
  if (teams.length === 0 || teamOrder.length === 0) return [];

  let orderedTeamIds = teamOrder.filter((id) => teams.some((t) => t.id === id));
  if (orderedTeamIds.length === 0) return [];

  if (startingTeamId && orderedTeamIds.includes(startingTeamId)) {
    const idx = orderedTeamIds.indexOf(startingTeamId);
    orderedTeamIds = [...orderedTeamIds.slice(idx), ...orderedTeamIds.slice(0, idx)];
  }

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const orderedTeams = orderedTeamIds
    .map((id) => teamById[id])
    .filter((t): t is Team => Boolean(t));

  const teamShotCounts = Object.fromEntries(orderedTeams.map((t) => [t.id, 0]));
  const order: string[] = [];
  let lastTeamIdx = orderedTeams.length - 1;

  for (let i = 0; i < 600; i++) {
    const nextTeamIdx = (lastTeamIdx + 1) % orderedTeams.length;
    const team = orderedTeams[nextTeamIdx]!;
    const count = teamShotCounts[team.id] ?? 0;
    const rotation =
      playerOrder[team.id]?.filter((id) => team.playerIds.includes(id)) ?? team.playerIds;
    if (rotation.length === 0) break;
    const playerIdx = count % rotation.length;
    const playerId = rotation[playerIdx];
    if (!playerId) break;
    order.push(playerId);
    teamShotCounts[team.id] = count + 1;
    lastTeamIdx = nextTeamIdx;
  }

  return order;
}

export function getPlayerName(
  players: { id: string; name: string }[],
  playerId: string,
): string {
  return players.find((p) => p.id === playerId)?.name ?? 'Player';
}

export function getGameShots(game: Game, shots: Shot[]): Shot[] {
  return shots
    .filter((s) => s.gameId === game.id)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

export function getFirstThrowPlayer(game: Game): string | null {
  const order = getActiveThrowOrder(game);
  return order[0] ?? null;
}

/** Teams alternate each throw; within a team, players rotate in order. */
export function getNextThrowPlayer(
  game: Game,
  shots: Shot[],
  lastPlayerId: string | null,
): string | null {
  if (game.throwOrder?.length) {
    const order = getActiveThrowOrder(game);
    if (order.length === 0) return null;
    if (!lastPlayerId) return order[0] ?? null;
    const idx = order.indexOf(lastPlayerId);
    const nextIdx = idx < 0 ? 0 : (idx + 1) % order.length;
    return order[nextIdx] ?? null;
  }

  const activeTeams = getActiveTeams(game);
  if (activeTeams.length === 0) return null;

  if (!lastPlayerId) {
    return getFirstThrowPlayer(game);
  }

  const gameShots = getGameShots(game, shots);
  const lastTeam = getTeamForPlayer(game, lastPlayerId);
  const lastTeamIndex = lastTeam
    ? activeTeams.findIndex((t) => t.id === lastTeam.id)
    : -1;
  const nextTeamIndex =
    lastTeamIndex >= 0 ? (lastTeamIndex + 1) % activeTeams.length : 0;
  const nextTeam = activeTeams[nextTeamIndex]!;

  const teamShotCount = gameShots.filter((s) => s.teamId === nextTeam.id).length;
  const playerIndex = teamShotCount % nextTeam.playerIds.length;
  return nextTeam.playerIds[playerIndex] ?? null;
}

export function teamDisplayName(team: Team, players: { id: string; name: string }[]): string {
  const names = team.playerIds
    .map((id) => players.find((p) => p.id === id)?.name)
    .filter(Boolean);
  return names.length > 0 ? names.join(' & ') : 'Team';
}

export type GameEndReason = 'win_50' | 'three_misses' | null;

export interface RecomputedGameState {
  scores: Record<string, number>;
  missStreaks: Record<string, number>;
  eliminatedTeamIds: string[];
  winnerTeamId: string | null;
  endReason: GameEndReason;
  isEnded: boolean;
}

export function recomputeGameState(game: Game, shots: Shot[]): RecomputedGameState {
  const scores = Object.fromEntries(game.teams.map((t) => [t.id, 0]));
  const missStreaks = Object.fromEntries(game.teams.map((t) => [t.id, 0]));
  const eliminated = new Set<string>(game.eliminatedTeamIds);

  if (isStatsSession(game)) {
    return {
      scores,
      missStreaks,
      eliminatedTeamIds: [],
      winnerTeamId: null,
      endReason: null,
      isEnded: false,
    };
  }

  let winnerTeamId: string | null = null;
  let endReason: GameEndReason = null;

  const gameShots = shots
    .filter((s) => s.gameId === game.id)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  for (const shot of gameShots) {
    const teamId = shot.teamId;
    if (!teamId || eliminated.has(teamId)) continue;

    if (isMissOutcome(shot.outcome, shot.score) || shot.score === null) {
      const streak = (missStreaks[teamId] ?? 0) + 1;
      missStreaks[teamId] = streak;
      if (streak >= CONSECUTIVE_MISS_LIMIT) {
        eliminated.add(teamId);
        missStreaks[teamId] = CONSECUTIVE_MISS_LIMIT;
      }
    } else {
      missStreaks[teamId] = 0;
      const before = scores[teamId] ?? 0;
      const pins = shot.score ?? 0;
      const { newScore, event } = applyFinskaScore(before, pins);
      scores[teamId] = newScore;
      if (event === 'win') {
        winnerTeamId = teamId;
        endReason = 'win_50';
      }
    }
  }

  if (!winnerTeamId) {
    const active = game.teams.filter((t) => !eliminated.has(t.id));
    if (eliminated.size > 0 && active.length === 1) {
      winnerTeamId = active[0]!.id;
      endReason = 'three_misses';
    }
  }

  const isEnded = endReason === 'win_50' || winnerTeamId !== null;

  return {
    scores,
    missStreaks,
    eliminatedTeamIds: [...eliminated],
    winnerTeamId,
    endReason,
    isEnded,
  };
}
