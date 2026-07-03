import type { Outcome } from './types';

export function getOutcomeIcon(outcome: Outcome | string): string {
  switch (outcome) {
    case 'Intended':
      return '✅';
    case 'So-so':
      return '🤷';
    case 'Unintended':
      return '❌';
    case 'Miss':
      return '✗';
    case 'Wrong Pin':
      return '📌';
    case 'Collateral':
      return '💥';
    default:
      return '⚪';
  }
}

export const OUTCOME_BUTTON_LABELS: Record<Outcome, string> = {
  Intended: '✅ Intended',
  'So-so': '🤷 So-so',
  Unintended: '❌ Unintended',
  Miss: '✗ Miss',
  'Wrong Pin': '📌 Wrong pin',
  Collateral: '💥 Collateral',
};
