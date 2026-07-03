import { getGamePlayerIds } from './teams';
import type { AppData, Distance, Game, Outcome, Player, Shot, ShotType } from './types';
import { DISTANCES, OUTCOMES, SHOT_TYPES } from './types';

export function formatDistanceLabel(distance: Distance): string {
  return typeof distance === 'string' ? distance : `${distance}m`;
}

export function isHitShot(shot: Shot): boolean {
  return shot.score > 0;
}

export interface PlayerStats {
  player: Player;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  totalShots: number;
  totalPoints: number;
  avgScorePerShot: number;
  hitRate: number;
  shotTypeCounts: Record<ShotType, number>;
  outcomeCounts: Record<Outcome, number>;
  distanceBuckets: { label: string; count: number }[];
  scoreDistribution: { score: number; count: number }[];
  scoringRate: number;
  twelveRate: number;
  bestScoringStreak: number;
  heatmapGrid: HeatmapRow[];
  outcomeByShotType: OutcomeByTypeRow[];
}

export interface HeatmapCell {
  distance: string;
  attempts: number;
  successRate: number | null;
}

export interface HeatmapRow {
  shotType: ShotType | 'ALL SHOTS';
  cells: HeatmapCell[];
  overallRate: number | null;
}

export interface OutcomeByTypeRow {
  shotType: ShotType;
  throws: number;
  outcomeCounts: Record<Outcome, number>;
  outcomeRates: Record<Outcome, number | null>;
}

function initShotTypeCounts(): Record<ShotType, number> {
  return Object.fromEntries(SHOT_TYPES.map((t) => [t, 0])) as Record<ShotType, number>;
}

function initOutcomeCounts(): Record<Outcome, number> {
  return Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
}

const DISTANCE_KEYS = DISTANCES.map((d) => (typeof d === 'string' ? d : String(d)));

export function getPlayerShots(data: AppData, playerId: string): Shot[] {
  return data.shots.filter((s) => s.playerId === playerId);
}

function buildHeatmapGrid(shots: Shot[]): HeatmapRow[] {
  const rows: HeatmapRow[] = SHOT_TYPES.map((shotType) => {
    const typeShots = shots.filter((s) => s.shotType === shotType);
    const cells: HeatmapCell[] = DISTANCE_KEYS.map((distance) => {
      const cellShots = typeShots.filter((s) => String(s.distance) === distance);
      const attempts = cellShots.length;
      const successes = cellShots.filter(isHitShot).length;
      return {
        distance,
        attempts,
        successRate: attempts > 0 ? (successes / attempts) * 100 : null,
      };
    });
    const attempts = typeShots.length;
    const successes = typeShots.filter(isHitShot).length;
    return {
      shotType,
      cells,
      overallRate: attempts > 0 ? (successes / attempts) * 100 : null,
    };
  }).filter((row) => row.cells.some((c) => c.attempts > 0));

  if (shots.length > 0) {
    const cells: HeatmapCell[] = DISTANCE_KEYS.map((distance) => {
      const cellShots = shots.filter((s) => String(s.distance) === distance);
      const attempts = cellShots.length;
      const successes = cellShots.filter(isHitShot).length;
      return {
        distance,
        attempts,
        successRate: attempts > 0 ? (successes / attempts) * 100 : null,
      };
    });
    const successes = shots.filter(isHitShot).length;
    rows.push({
      shotType: 'ALL SHOTS',
      cells,
      overallRate: (successes / shots.length) * 100,
    });
  }

  return rows;
}

function buildOutcomeByShotType(shots: Shot[]): OutcomeByTypeRow[] {
  return SHOT_TYPES.map((shotType) => {
    const typeShots = shots.filter((s) => s.shotType === shotType);
    const outcomeCounts = initOutcomeCounts();
    for (const shot of typeShots) {
      outcomeCounts[shot.outcome]++;
    }
    const throws = typeShots.length;
    const outcomeRates = Object.fromEntries(
      OUTCOMES.map((o) => [
        o,
        throws > 0 ? (outcomeCounts[o] / throws) * 100 : null,
      ]),
    ) as Record<Outcome, number | null>;
    return { shotType, throws, outcomeCounts, outcomeRates };
  }).filter((row) => row.throws > 0);
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

    if (isHitShot(shot)) {
      madeShots += 1;
      currentScoringStreak += 1;
      bestScoringStreak = Math.max(bestScoringStreak, currentScoringStreak);
    } else {
      currentScoringStreak = 0;
    }
    if (shot.score === 12) {
      twelveShots += 1;
    }
  }

  const distanceBuckets = [...distanceMap.entries()]
    .map(([label, count]) => ({ label: label.endsWith('+') ? label : `${label}m`, count }))
    .sort((a, b) => {
      if (a.label.endsWith('+')) return 1;
      if (b.label.endsWith('+')) return -1;
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
    hitRate: shots.length > 0 ? (madeShots / shots.length) * 100 : 0,
    shotTypeCounts,
    outcomeCounts,
    distanceBuckets,
    scoreDistribution,
    scoringRate: shots.length > 0 ? (madeShots / shots.length) * 100 : 0,
    twelveRate: shots.length > 0 ? (twelveShots / shots.length) * 100 : 0,
    bestScoringStreak,
    heatmapGrid: buildHeatmapGrid(shots),
    outcomeByShotType: buildOutcomeByShotType(shots),
  };
}

export function getPlayerThrowCount(data: AppData, playerId: string): number {
  return data.shots.filter((s) => s.playerId === playerId).length;
}

export function getActiveGame(data: AppData): Game | null {
  return data.games.find((g) => g.endedAt === null) ?? null;
}

export function getGameShots(data: AppData, gameId: string): Shot[] {
  return data.shots.filter((s) => s.gameId === gameId);
}
