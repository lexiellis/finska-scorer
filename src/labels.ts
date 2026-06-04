import type { Outcome, ShotType } from './types';

export const SHOT_TYPE_SHORT: Record<ShotType, string> = {
  Standard: 'Std',
  Retro: 'Ret',
  Elephant: 'El',
  Kick: 'Kick',
  Puikula: 'Pui',
  Bunch: 'Bnch',
  Tuck: 'Tuck',
  Crowd: 'Crwd',
};

export const OUTCOME_SHORT: Record<Outcome, string> = {
  'Intended outcome': 'OK',
  'So-so outcome': 'So-so',
  'Unintended outcome': 'Oops',
  Miss: 'Miss',
  'Wrong pin': 'Wrong',
  Collateral: 'Coll',
};
