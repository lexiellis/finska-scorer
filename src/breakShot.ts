import { isMissOutcome } from './teams';
import type { Shot } from './types';

/** First pin-knocking throw in a game (not per player). */
export function isScoringShot(shot: Pick<Shot, 'score' | 'outcome'>): boolean {
  if (shot.score === null || shot.score <= 0) return false;
  return !isMissOutcome(shot.outcome, shot.score);
}

/** Tag only the game's first scoring shot as Break; clear Break elsewhere. */
export function normalizeGameBreakShotTypes(shots: Shot[]): Shot[] {
  const ordered = [...shots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  let breakAssigned = false;

  return ordered.map((shot) => {
    if (!breakAssigned && isScoringShot(shot)) {
      breakAssigned = true;
      return { ...shot, shotType: 'Break' };
    }
    if (shot.shotType === 'Break') {
      return { ...shot, shotType: 'Standard' };
    }
    return shot;
  });
}

export function replaceGameShots(allShots: Shot[], gameId: string, gameShots: Shot[]): Shot[] {
  const normalized = normalizeGameBreakShotTypes(gameShots);
  return [...allShots.filter((s) => s.gameId !== gameId), ...normalized];
}
