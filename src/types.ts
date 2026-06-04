export const SHOT_TYPES = [
  'Standard',
  'Retro',
  'Elephant',
  'Kick',
  'Puikula',
  'Bunch',
  'Tuck',
  'Crowd',
] as const;

export type ShotType = (typeof SHOT_TYPES)[number];

export const DISTANCES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, '12+'] as const;

export type Distance = (typeof DISTANCES)[number];

export const OUTCOMES = [
  'Intended outcome',
  'So-so outcome',
  'Unintended outcome',
  'Miss',
  'Wrong pin',
  'Collateral',
] as const;

export type Outcome = (typeof OUTCOMES)[number];

export type Tab = 'game' | 'stats' | 'players';

export type GameMode = 'game' | 'practice';

export interface Player {
  id: string;
  name: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
}

export interface Shot {
  id: string;
  gameId: string;
  teamId: string;
  playerId: string;
  shotType: ShotType;
  distance: Distance;
  /** Pins knocked (0–12). */
  score: number;
  outcome: Outcome;
  recordedAt: string;
  scoreBefore: number;
  scoreAfter: number;
}

export interface Game {
  id: string;
  mode: GameMode;
  teams: Team[];
  scores: Record<string, number>;
  eliminatedTeamIds: string[];
  winnerTeamId: string | null;
  startedAt: string;
  endedAt: string | null;
  /** @deprecated Migrated from pre-team games */
  playerIds?: string[];
  /** @deprecated Use winnerTeamId */
  winnerId?: string | null;
}

export interface AppData {
  players: Player[];
  games: Game[];
  shots: Shot[];
}
