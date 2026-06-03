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
  const gamesPlayed = data.games.filter((g) => g.playerIds.includes(playerId)).length;
  const wins = data.games.filter((g) => g.winnerId === playerId).length;

  const shotTypeCounts = initShotTypeCounts();
  const outcomeCounts = initOutcomeCounts();
  const distanceMap = new Map<string, number>();
  const scoreMap = new Map<number, number>();

  let totalPoints = 0;
  for (const shot of shots) {
    totalPoints += shot.score;
    shotTypeCounts[shot.shotType]++;
    outcomeCounts[shot.outcome]++;
    const distKey = String(shot.distance);
    distanceMap.set(distKey, (distanceMap.get(distKey) ?? 0) + 1);
    scoreMap.set(shot.score, (scoreMap.get(shot.score) ?? 0) + 1);
  }

  const distanceBuckets = [...distanceMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (a.label === '12+') return 1;
      if (b.label === '12+') return -1;
      return Number(a.label) - Number(b.label);
    });

  const scoreDistribution = Array.from({ length: 13 }, (_, score) => ({
    score,
    count: scoreMap.get(score) ?? 0,
  }));

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
  };
}

export function getActiveGame(data: AppData): Game | null {
  return data.games.find((g) => g.endedAt === null) ?? null;
}

export function getGameShots(data: AppData, gameId: string): Shot[] {
  return data.shots.filter((s) => s.gameId === gameId);
}
