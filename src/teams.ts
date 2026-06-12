import { applyFinskaScore } from './scoring';
import type { Game, Outcome, Shot, Team } from './types';

export const CONSECUTIVE_MISS_LIMIT = 3;

export function isMissOutcome(_outcome: Outcome, score: number): boolean {
  return score === 0;
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

export function getGameShots(game: Game, shots: Shot[]): Shot[] {
  return shots
    .filter((s) => s.gameId === game.id)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

export function getFirstThrowPlayer(game: Game): string | null {
  const team = getActiveTeams(game)[0];
  return team?.playerIds[0] ?? null;
}

/** Teams alternate each throw; within a team, players rotate in order. */
export function getNextThrowPlayer(
  game: Game,
  shots: Shot[],
  lastPlayerId: string | null,
): string | null {
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
  let winnerTeamId: string | null = null;
  let endReason: GameEndReason = null;

  const gameShots = shots
    .filter((s) => s.gameId === game.id)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  for (const shot of gameShots) {
    const teamId = shot.teamId;
    if (!teamId || eliminated.has(teamId)) continue;

    if (isMissOutcome(shot.outcome, shot.score)) {
      const streak = (missStreaks[teamId] ?? 0) + 1;
      missStreaks[teamId] = streak;
      if (streak >= CONSECUTIVE_MISS_LIMIT) {
        eliminated.add(teamId);
        missStreaks[teamId] = CONSECUTIVE_MISS_LIMIT;
      }
    } else {
      missStreaks[teamId] = 0;
      const before = scores[teamId] ?? 0;
      const { newScore, event } = applyFinskaScore(before, shot.score);
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
