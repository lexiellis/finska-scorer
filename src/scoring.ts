export const FINSKA_TARGET = 50;
export const FINSKA_BUST_SCORE = 25;

export type ScoreEvent = 'normal' | 'bust' | 'win' | 'miss_loss';

export interface ScoreResult {
  newScore: number;
  event: ScoreEvent;
}

/** Official Finska/Mölkky race-to-50: exact 50 wins; over 50 resets to 25. */
export function applyFinskaScore(current: number, pins: number): ScoreResult {
  const next = current + pins;

  if (next === FINSKA_TARGET) {
    return { newScore: FINSKA_TARGET, event: 'win' };
  }
  if (next > FINSKA_TARGET) {
    return { newScore: FINSKA_BUST_SCORE, event: 'bust' };
  }
  return { newScore: next, event: 'normal' };
}

export function scoreEventMessage(
  event: ScoreEvent,
  label: string,
  pins: number,
): string {
  switch (event) {
    case 'win':
      return `${label} hit ${FINSKA_TARGET}!`;
    case 'miss_loss':
      return `${label} — 3 misses in a row!`;
    case 'bust':
      return `Over 50 with +${pins} — bust back to ${FINSKA_BUST_SCORE}`;
    default:
      return pins === 0 ? 'No pins — score unchanged' : `+${pins} pins logged`;
  }
}
