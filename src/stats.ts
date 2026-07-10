import { isStatsSession, teamDisplayName } from './teams';
import { getDeviceId } from './storage';
import type { AppData, Distance, Game, Outcome, Player, Shot, ShotType } from './types';
import { DISTANCES, OUTCOMES, ALL_SHOT_TYPES } from './types';

export function formatDistanceLabel(distance: Distance): string {
  if (distance === '10+') return '10m+';
  return typeof distance === 'string' ? distance : `${distance}m`;
}

export function isHitShot(shot: Shot): boolean {
  if (shot.score !== null) return shot.score > 0;
  return shot.outcome !== 'Miss' && shot.outcome !== 'Wrong Pin';
}

export function isIntendedOutcome(shot: Shot): boolean {
  return shot.outcome === 'Intended';
}

export function isSosoPlusOutcome(shot: Shot): boolean {
  return shot.outcome === 'Intended' || shot.outcome === 'So-so';
}

export function isSosoOnlyOutcome(shot: Shot): boolean {
  return shot.outcome === 'So-so';
}

export interface PlayerStats {
  player: Player;
  totalShots: number;
  totalPoints: number;
  avgScorePerShot: number;
  /** Intended outcome / all throws */
  successRate: number;
  /** So-so only / all throws */
  sosoOnlyRate: number;
  /** Intended + So-so / all throws */
  sosoPlusRate: number;
  shotTypeCounts: Record<ShotType, number>;
  outcomeCounts: Record<Outcome, number>;
  distanceBuckets: { label: string; count: number; pct: number }[];
  avgDistance: number | null;
  scoreDistribution: { score: number; count: number }[];
  scoringRate: number;
  twelveRate: number;
  bestScoringStreak: number;
  heatmapGrid: HeatmapRow[];
  outcomeByShotType: OutcomeByTypeRow[];
  distanceRatesByShotType: ShotTypeDistanceRates[];
}

export interface DistanceRatePoint {
  label: string;
  distance: string;
  attempts: number;
  successRate: number | null;
  sosoOnlyRate: number | null;
  sosoPlusRate: number | null;
}

export interface ShotTypeDistanceRates {
  shotType: ShotType | 'ALL';
  points: DistanceRatePoint[];
}

export interface HeatmapCell {
  distance: string;
  attempts: number;
  successRate: number | null;
  sosoOnlyRate: number | null;
  sosoPlusRate: number | null;
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
  return Object.fromEntries(ALL_SHOT_TYPES.map((t) => [t, 0])) as Record<ShotType, number>;
}

function initOutcomeCounts(): Record<Outcome, number> {
  return Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
}

const DISTANCE_KEYS = DISTANCES.map((d) => (typeof d === 'string' ? d : String(d)));

function distanceSortIndex(label: string): number {
  if (label.endsWith('+')) return 100;
  const n = Number(label.replace(/m$/i, ''));
  return Number.isFinite(n) ? n : 101;
}

function sortDistanceLabels(a: string, b: string): number {
  return distanceSortIndex(a) - distanceSortIndex(b);
}

export function getPlayerShots(data: AppData, playerId: string): Shot[] {
  return data.shots.filter((s) => s.playerId === playerId);
}

function outcomeRate(shots: Shot[], predicate: (shot: Shot) => boolean): number | null {
  if (shots.length === 0) return null;
  return (shots.filter(predicate).length / shots.length) * 100;
}

function distanceNumericValue(distance: Shot['distance']): number {
  if (distance === '10+') return 10;
  return distance;
}

function buildHeatmapGrid(shots: Shot[]): HeatmapRow[] {
  const rows: HeatmapRow[] = ALL_SHOT_TYPES.map((shotType) => {
    const typeShots = shots.filter((s) => s.shotType === shotType);
    const cells: HeatmapCell[] = DISTANCE_KEYS.map((distance) => {
      const cellShots = typeShots.filter((s) => String(s.distance) === distance);
      const attempts = cellShots.length;
      return {
        distance,
        attempts,
        successRate: outcomeRate(cellShots, isIntendedOutcome),
        sosoOnlyRate: outcomeRate(cellShots, isSosoOnlyOutcome),
        sosoPlusRate: outcomeRate(cellShots, isSosoPlusOutcome),
      };
    });
    return {
      shotType,
      cells,
      overallRate: outcomeRate(typeShots, isIntendedOutcome),
    };
  }).filter((row) => row.cells.some((c) => c.attempts > 0));

  if (shots.length > 0) {
    const cells: HeatmapCell[] = DISTANCE_KEYS.map((distance) => {
      const cellShots = shots.filter((s) => String(s.distance) === distance);
      const attempts = cellShots.length;
      return {
        distance,
        attempts,
        successRate: outcomeRate(cellShots, isIntendedOutcome),
        sosoOnlyRate: outcomeRate(cellShots, isSosoOnlyOutcome),
        sosoPlusRate: outcomeRate(cellShots, isSosoPlusOutcome),
      };
    });
    rows.push({
      shotType: 'ALL SHOTS',
      cells,
      overallRate: outcomeRate(shots, isIntendedOutcome),
    });
  }

  return rows;
}

function buildDistanceRatesForShots(shots: Shot[]): DistanceRatePoint[] {
  return DISTANCE_KEYS.map((distance) => {
    const cellShots = shots.filter((s) => String(s.distance) === distance);
    const attempts = cellShots.length;
    const label = distance.endsWith('+') ? distance : `${distance}m`;
    return {
      label,
      distance,
      attempts,
      successRate: outcomeRate(cellShots, isIntendedOutcome),
      sosoOnlyRate: outcomeRate(cellShots, isSosoOnlyOutcome),
      sosoPlusRate: outcomeRate(cellShots, isSosoPlusOutcome),
    };
  }).filter((point) => point.attempts > 0);
}

function buildDistanceRatesByShotType(shots: Shot[]): ShotTypeDistanceRates[] {
  const result: ShotTypeDistanceRates[] = [];
  if (shots.length > 0) {
    result.push({ shotType: 'ALL', points: buildDistanceRatesForShots(shots) });
  }
  for (const shotType of ALL_SHOT_TYPES) {
    const typeShots = shots.filter((s) => s.shotType === shotType);
    if (typeShots.length === 0) continue;
    result.push({ shotType, points: buildDistanceRatesForShots(typeShots) });
  }
  return result;
}

function buildOutcomeByShotType(shots: Shot[]): OutcomeByTypeRow[] {
  return ALL_SHOT_TYPES.map((shotType) => {
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
  return computeStatsFromShots(player, getPlayerShots(data, playerId));
}

export function computeAllPlayersStats(data: AppData): PlayerStats | null {
  if (data.players.length === 0) return null;
  const player: Player = {
    id: '__all__',
    name: 'All players',
    createdAt: '',
  };
  return computeStatsFromShots(player, data.shots);
}

function computeStatsFromShots(player: Player, shots: Shot[]): PlayerStats {
  const shotTypeCounts = initShotTypeCounts();
  const outcomeCounts = initOutcomeCounts();
  const distanceMap = new Map<string, number>();
  const scoreMap = new Map<number, number>();
  let intendedShots = 0;
  let sosoOnlyShots = 0;
  let sosoPlusShots = 0;
  let twelveShots = 0;
  let currentScoringStreak = 0;
  let bestScoringStreak = 0;

  let totalPoints = 0;
  let scoredShotCount = 0;
  let distanceSum = 0;
  for (const shot of shots) {
    distanceSum += distanceNumericValue(shot.distance);
    if (shot.score !== null) {
      totalPoints += shot.score;
      scoredShotCount += 1;
    }
    shotTypeCounts[shot.shotType]++;
    outcomeCounts[shot.outcome]++;
    const distKey = String(shot.distance);
    distanceMap.set(distKey, (distanceMap.get(distKey) ?? 0) + 1);
    if (shot.score !== null) {
      scoreMap.set(shot.score, (scoreMap.get(shot.score) ?? 0) + 1);
    }

    if (isIntendedOutcome(shot)) {
      intendedShots += 1;
      currentScoringStreak += 1;
      bestScoringStreak = Math.max(bestScoringStreak, currentScoringStreak);
    } else {
      currentScoringStreak = 0;
    }
    if (isSosoPlusOutcome(shot)) {
      sosoPlusShots += 1;
    }
    if (isSosoOnlyOutcome(shot)) {
      sosoOnlyShots += 1;
    }
    if (shot.score === 12) {
      twelveShots += 1;
    }
  }

  const distanceBuckets = [...distanceMap.entries()]
    .map(([label, count]) => ({
      label: label.endsWith('+') ? label : `${label}m`,
      count,
      pct: shots.length > 0 ? (count / shots.length) * 100 : 0,
    }))
    .sort((a, b) => sortDistanceLabels(a.label, b.label));

  const scoreDistribution = Array.from({ length: 13 }, (_, score) => ({
    score,
    count: scoreMap.get(score) ?? 0,
  }));

  return {
    player,
    totalShots: shots.length,
    totalPoints,
    avgScorePerShot: scoredShotCount > 0 ? totalPoints / scoredShotCount : 0,
    successRate: shots.length > 0 ? (intendedShots / shots.length) * 100 : 0,
    sosoOnlyRate: shots.length > 0 ? (sosoOnlyShots / shots.length) * 100 : 0,
    sosoPlusRate: shots.length > 0 ? (sosoPlusShots / shots.length) * 100 : 0,
    shotTypeCounts,
    outcomeCounts,
    distanceBuckets,
    avgDistance: shots.length > 0 ? distanceSum / shots.length : null,
    scoreDistribution,
    scoringRate: shots.length > 0 ? (intendedShots / shots.length) * 100 : 0,
    twelveRate: shots.length > 0 ? (twelveShots / shots.length) * 100 : 0,
    bestScoringStreak,
    heatmapGrid: buildHeatmapGrid(shots),
    outcomeByShotType: buildOutcomeByShotType(shots),
    distanceRatesByShotType: buildDistanceRatesByShotType(shots),
  };
}

export function getPlayerThrowCount(data: AppData, playerId: string): number {
  return data.shots.filter((s) => s.playerId === playerId).length;
}

export function getGameShots(data: AppData, gameId: string): Shot[] {
  return data.shots.filter((s) => s.gameId === gameId);
}

export function getEndedSessions(data: AppData): Game[] {
  return [...data.games]
    .filter((g) => g.endedAt !== null)
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));
}

export function formatSessionLabel(game: Game, players: Player[]): string {
  const teamLabels = game.teams.map((t) => teamDisplayName(t, players));
  if (isStatsSession(game)) {
    return `Stats · ${teamLabels.join(', ')}`;
  }
  if (game.winnerTeamId) {
    const winner = game.teams.find((t) => t.id === game.winnerTeamId);
    const winnerName = winner ? teamDisplayName(winner, players) : 'Winner';
    return `${teamLabels.join(' vs ')} · ${winnerName} won`;
  }
  return teamLabels.join(' vs ');
}

export function formatSessionDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function computeSessionStats(data: AppData, gameId: string): PlayerStats | null {
  const game = data.games.find((g) => g.id === gameId);
  if (!game) return null;
  const shots = getGameShots(data, gameId);
  if (shots.length === 0) return null;
  const player: Player = {
    id: '__session__',
    name: 'This session',
    createdAt: '',
  };
  return computeStatsFromShots(player, shots);
}

export function computeSessionPlayerStats(
  data: AppData,
  gameId: string,
  playerId: string,
): PlayerStats | null {
  const player = data.players.find((p) => p.id === playerId);
  if (!player) return null;
  const shots = getGameShots(data, gameId).filter((s) => s.playerId === playerId);
  if (shots.length === 0) return null;
  return computeStatsFromShots(player, shots);
}

export function getActiveGame(data: AppData): Game | null {
  const deviceId = getDeviceId();
  return (
    data.games.find(
      (g) =>
        g.endedAt === null &&
        (g.scribeDeviceId === deviceId || !g.scribeDeviceId),
    ) ?? null
  );
}
