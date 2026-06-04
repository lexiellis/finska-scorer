import { applyFinskaScore } from './scoring';
import type { Game, Outcome, Shot, Team } from './types';

export const CONSECUTIVE_MISS_LIMIT = 3;

export function isMissOutcome(outcome: Outcome): boolean {
  return outcome === 'Miss';
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

export function teamDisplayName(team: Team, players: { id: string; name: string }[]): string {
  if (team.name.trim()) return team.name.trim();
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

    if (isMissOutcome(shot.outcome)) {
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

  if (!winnerTeamId && game.mode === 'game') {
    const active = game.teams.filter((t) => !eliminated.has(t.id));
    if (eliminated.size > 0 && active.length === 1) {
      winnerTeamId = active[0]!.id;
      endReason = 'three_misses';
    }
  }

  if (game.mode === 'practice') {
    const team = game.teams[0];
    if (team && eliminated.has(team.id)) {
      endReason = 'three_misses';
    }
  }

  const isEnded =
    endReason === 'win_50' ||
    (game.mode === 'game' && winnerTeamId !== null);

  return {
    scores,
    missStreaks,
    eliminatedTeamIds: [...eliminated],
    winnerTeamId,
    endReason,
    isEnded,
  };
}
