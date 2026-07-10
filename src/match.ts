import type { AppData, Game, Match, Team } from './types';

export function getActiveMatch(data: AppData): Match | null {
  return data.matches.find((m) => m.endedAt === null) ?? null;
}

export function getMatchGames(data: AppData, matchId: string): Game[] {
  return data.games
    .filter((g) => g.matchId === matchId)
    .sort((a, b) => (a.gameNumber ?? 0) - (b.gameNumber ?? 0));
}

export function getGameStartingTeamId(game: Game, shots: { gameId: string; teamId: string; recordedAt: string }[]): string | null {
  const first = shots
    .filter((s) => s.gameId === game.id)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[0];
  return first?.teamId ?? null;
}

/** Points scored in games that team lost, summed across the match. */
export function computeSmallPoints(
  data: AppData,
  match: Match,
): Record<string, number> {
  const small = Object.fromEntries(match.teams.map((t) => [t.id, 0]));
  for (const game of getMatchGames(data, match.id)) {
    if (!game.endedAt || !game.winnerTeamId) continue;
    for (const team of game.teams) {
      if (team.id !== game.winnerTeamId) {
        small[team.id] = (small[team.id] ?? 0) + (game.scores[team.id] ?? 0);
      }
    }
  }
  return small;
}

export function computeMatchWins(data: AppData, match: Match): Record<string, number> {
  const wins = Object.fromEntries(match.teams.map((t) => [t.id, 0]));
  for (const game of getMatchGames(data, match.id)) {
    if (game.winnerTeamId) {
      wins[game.winnerTeamId] = (wins[game.winnerTeamId] ?? 0) + 1;
    }
  }
  return wins;
}

function teamWithMaxSmallPoints(
  teamOrder: string[],
  smallPoints: Record<string, number>,
): string {
  let bestId = teamOrder[0]!;
  let best = smallPoints[bestId] ?? 0;
  for (const teamId of teamOrder) {
    const pts = smallPoints[teamId] ?? 0;
    if (pts > best) {
      best = pts;
      bestId = teamId;
    }
  }
  return bestId;
}

function nextTeamInOrder(teamOrder: string[], currentTeamId: string): string {
  const idx = teamOrder.indexOf(currentTeamId);
  if (idx < 0) return teamOrder[0]!;
  return teamOrder[(idx + 1) % teamOrder.length]!;
}

/** Which team throws first in the upcoming game. */
export function getStartingTeamForGame(
  data: AppData,
  match: Match,
  nextGameNumber: number,
): string {
  if (nextGameNumber === 1) {
    return match.teamOrder[0]!;
  }

  const completed = getMatchGames(data, match.id).filter((g) => g.endedAt);
  const prevGame = completed[completed.length - 1];

  if ([3, 5, 7, 9].includes(nextGameNumber)) {
    const small = computeSmallPoints(data, match);
    return teamWithMaxSmallPoints(match.teamOrder, small);
  }

  if (prevGame) {
    const prevStarter = getGameStartingTeamId(prevGame, data.shots);
    if (prevStarter) {
      return nextTeamInOrder(match.teamOrder, prevStarter);
    }
  }

  return match.teamOrder[(nextGameNumber - 1) % match.teamOrder.length]!;
}

export function defaultPlayerOrder(teams: Team[]): Record<string, string[]> {
  return Object.fromEntries(teams.map((t) => [t.id, [...t.playerIds]]));
}

export function defaultTeamOrder(teams: Team[]): string[] {
  return teams.map((t) => t.id);
}

export function teamsWithPlayerOrder(
  teams: Team[],
  playerOrder: Record<string, string[]>,
): Team[] {
  return teams.map((t) => ({
    ...t,
    playerIds: (playerOrder[t.id] ?? t.playerIds).filter((id) => t.playerIds.includes(id)),
  }));
}
