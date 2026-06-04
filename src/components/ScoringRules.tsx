import { FINSKA_BUST_SCORE, FINSKA_TARGET } from '../scoring';

export function ScoringRules({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="rules-hint">
        Race to <strong>{FINSKA_TARGET}</strong> exactly. Over {FINSKA_TARGET} → reset to{' '}
        <strong>{FINSKA_BUST_SCORE}</strong>.
      </p>
    );
  }

  return (
    <aside className="rules-card">
      <h3>Scoring rules</h3>
      <ul>
        <li>
          First player to reach <strong>{FINSKA_TARGET}</strong> exactly wins.
        </li>
        <li>
          If a throw would take you <strong>over {FINSKA_TARGET}</strong>, your score resets to{' '}
          <strong>{FINSKA_BUST_SCORE}</strong>.
        </li>
        <li>Log pins knocked (0–12) each throw; the app applies the rules automatically.</li>
      </ul>
    </aside>
  );
}
