import { FINSKA_BUST_SCORE, FINSKA_TARGET } from '../scoring';
import { CONSECUTIVE_MISS_LIMIT } from '../teams';

export function ScoringRules({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="rules-hint">
        Race to <strong>{FINSKA_TARGET}</strong> exactly. Over {FINSKA_TARGET} →{' '}
        <strong>{FINSKA_BUST_SCORE}</strong>. <strong>{CONSECUTIVE_MISS_LIMIT}</strong> team misses
        in a row = out.
      </p>
    );
  }

  return (
    <aside className="rules-card">
      <h3>Scoring rules</h3>
      <ul>
        <li>
          First <strong>team</strong> to reach <strong>{FINSKA_TARGET}</strong> exactly wins.
        </li>
        <li>
          If a throw would take a team <strong>over {FINSKA_TARGET}</strong>, that team&apos;s score
          resets to <strong>{FINSKA_BUST_SCORE}</strong>.
        </li>
        <li>
          <strong>{CONSECUTIVE_MISS_LIMIT} misses in a row</strong> (outcome: Miss) eliminates the
          team — shared across all players on that team.
        </li>
        <li>Log pins knocked (0–12) each throw; the app applies the rules automatically.</li>
      </ul>
    </aside>
  );
}
