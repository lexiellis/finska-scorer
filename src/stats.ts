import { getGamePlayerIds } from './teams';
import type { AppData, Game, Outcome, Player, Shot, ShotType } from './types';
import { OUTCOMES, SHOT_TYPES } from './types';

export interface PlayerStats {
  player: Player;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  totalShots: number;
  totalPoints: number;
  avgScorePerShot: number;
  shotTypeCounts: Record<ShotType, number>;
  outcomeCounts: Record<Outcome, number>;
  distanceBuckets: { label: string; count: number }[];
  scoreDistribution: { score: number; count: number }[];
  scoringRate: number;
  twelveRate: number;
  bestScoringStreak: number;
  shotTypeDistanceSuccess: {
    label: string;
    shotType: ShotType;
    distance: string;
    attempts: number;
    successRate: number;
  }[];
}

function initShotTypeCounts(): Record<ShotType, number> {
  return Object.fromEntries(SHOT_TYPES.map((t) => [t, 0])) as Record<ShotType, number>;
}

function initOutcomeCounts(): Record<Outcome, number> {
  return Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
}

export function getPlayerShots(data: AppData, playerId: string): Shot[] {
  return data.shots.filter((s) => s.playerId === playerId);
}

export function computePlayerStats(data: AppData, playerId: string): PlayerStats | null {
  const player = data.players.find((p) => p.id === playerId);
  if (!player) return null;

  const shots = getPlayerShots(data, playerId);
  const competitiveGames = data.games.filter(
    (g) => g.mode === 'game' && g.endedAt !== null,
  );
  const gamesPlayed = competitiveGames.filter((g) =>
    getGamePlayerIds(g).includes(playerId),
  ).length;
  const wins = competitiveGames.filter((g) => {
    if (!g.winnerTeamId) return false;
    const team = g.teams.find((t) => t.id === g.winnerTeamId);
    return team?.playerIds.includes(playerId) ?? false;
  }).length;
  const shotTypeCounts = initShotTypeCounts();
  const outcomeCounts = initOutcomeCounts();
  const distanceMap = new Map<string, number>();
  const scoreMap = new Map<number, number>();
  const successByTypeDistance = new Map<string, { shotType: ShotType; distance: string; attempts: number; successes: number }>();
  let madeShots = 0;
  let twelveShots = 0;
  let currentScoringStreak = 0;
  let bestScoringStreak = 0;

  let totalPoints = 0;
  for (const shot of shots) {
    totalPoints += shot.score;
    shotTypeCounts[shot.shotType]++;
    outcomeCounts[shot.outcome]++;
    const distKey = String(shot.distance);
    distanceMap.set(distKey, (distanceMap.get(distKey) ?? 0) + 1);
    scoreMap.set(shot.score, (scoreMap.get(shot.score) ?? 0) + 1);

    const comboKey = `${shot.shotType}@@${distKey}`;
    const combo = successByTypeDistance.get(comboKey) ?? {
      shotType: shot.shotType,
      distance: distKey,
      attempts: 0,
      successes: 0,
    };
    combo.attempts += 1;
    if (shot.score > 0) {
      combo.successes += 1;
      madeShots += 1;
      currentScoringStreak += 1;
      bestScoringStreak = Math.max(bestScoringStreak, currentScoringStreak);
    } else {
      currentScoringStreak = 0;
    }
    if (shot.score === 12) {
      twelveShots += 1;
    }
    successByTypeDistance.set(comboKey, combo);
  }

  const distanceBuckets = [...distanceMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (a.label.endsWith('+')) return 1;
      if (b.label.endsWith('+')) return -1;
      return Number(a.label) - Number(b.label);
    });

  const scoreDistribution = Array.from({ length: 13 }, (_, score) => ({
    score,
    count: scoreMap.get(score) ?? 0,
  }));

  const shotTypeDistanceSuccess = [...successByTypeDistance.values()]
    .map((entry) => ({
      label: `${entry.shotType} @ ${entry.distance}`,
      shotType: entry.shotType,
      distance: entry.distance,
      attempts: entry.attempts,
      successRate: entry.attempts > 0 ? (entry.successes / entry.attempts) * 100 : 0,
    }))
    .sort((a, b) => {
      if (a.distance.endsWith('+') && !b.distance.endsWith('+')) return 1;
      if (!a.distance.endsWith('+') && b.distance.endsWith('+')) return -1;
      if (a.distance !== b.distance) return Number(a.distance) - Number(b.distance);
      return a.shotType.localeCompare(b.shotType);
    });

  return {
    player,
    gamesPlayed,
    wins,
    winRate: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
    totalShots: shots.length,
    totalPoints,
    avgScorePerShot: shots.length > 0 ? totalPoints / shots.length : 0,
    shotTypeCounts,
    outcomeCounts,
    distanceBuckets,
    scoreDistribution,
    scoringRate: shots.length > 0 ? (madeShots / shots.length) * 100 : 0,
    twelveRate: shots.length > 0 ? (twelveShots / shots.length) * 100 : 0,
    bestScoringStreak,
    shotTypeDistanceSuccess,
  };
}

export function getActiveGame(data: AppData): Game | null {
  return data.games.find((g) => g.endedAt === null) ?? null;
}

export function getGameShots(data: AppData, gameId: string): Shot[] {
  return data.shots.filter((s) => s.gameId === gameId);
}
