import { FINSKA_TARGET } from '../scoring';
import { CONSECUTIVE_MISS_LIMIT, teamDisplayName } from '../teams';
import type { AppData, Distance, Game, Outcome, ShotType } from '../types';
import { DISTANCES, OUTCOMES, SHOT_TYPES } from '../types';
import { OUTCOME_SHORT, SHOT_TYPE_SHORT } from '../labels';

interface ShotLogFormProps {
  game: Game;
  players: AppData['players'];
  activePlayerId: string | null;
  onSelectPlayer: (id: string) => void;
  missStreaks: Record<string, number>;
  shotType: ShotType | null;
  distance: Distance | null;
  score: number | null;
  outcome: Outcome | null;
  onShotType: (v: ShotType) => void;
  onDistance: (v: Distance) => void;
  onScore: (v: number) => void;
  onOutcome: (v: Outcome) => void;
  onLog: () => void;
  onUndo: () => void;
  onEnd: () => void;
  flash: string;
  flashKind: 'info' | 'bust' | 'win' | 'danger';
}

export function ShotLogForm({
  game,
  players,
  activePlayerId,
  onSelectPlayer,
  missStreaks,
  shotType,
  distance,
  score,
  outcome,
  onShotType,
  onDistance,
  onScore,
  onOutcome,
  onLog,
  onUndo,
  onEnd,
  flash,
  flashKind,
}: ShotLogFormProps) {
  const teams =
    game.mode === 'practice'
      ? game.teams
      : game.teams.filter((t) => !game.eliminatedTeamIds.includes(t.id));

  return (
    <div className="shot-log">
      {flash && (
        <p className={`shot-toast flash-${flashKind}`} role="status">
          {flash}
        </p>
      )}

      <div className="score-strip">
        {teams.map((team) => {
          const pts = game.scores[team.id] ?? 0;
          const streak = missStreaks[team.id] ?? 0;
          return (
            <span
              key={team.id}
              className={`score-pill ${pts === FINSKA_TARGET ? 'at-target' : ''} ${streak >= 2 ? 'miss-hot' : ''}`}
            >
              <span className="score-pill-name">{teamDisplayName(team, players)}</span>
              <span className="score-pill-pts">
                {pts}
                {streak > 0 && <em className="score-pill-miss">·{streak}m</em>}
              </span>
            </span>
          );
        })}
        <button type="button" className="btn-icon" onClick={onEnd} aria-label="End session">
          ⋯
        </button>
      </div>

      <div className="player-strip">
        {teams.flatMap((team) =>
          team.playerIds.map((id) => {
            const p = players.find((pl) => pl.id === id);
            if (!p) return null;
            return (
              <button
                key={id}
                type="button"
                className={`player-pill ${activePlayerId === id ? 'selected' : ''}`}
                onClick={() => onSelectPlayer(id)}
              >
                {p.name}
              </button>
            );
          }),
        )}
      </div>

      <div className="log-block">
        <span className="log-label">Type</span>
        <div className="btn-grid cols-4">
          {SHOT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`pick-btn ${shotType === t ? 'selected' : ''}`}
              onClick={() => onShotType(t)}
            >
              {SHOT_TYPE_SHORT[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="log-block">
        <span className="log-label">m</span>
        <div className="btn-grid cols-6">
          {DISTANCES.map((d) => (
            <button
              key={String(d)}
              type="button"
              className={`pick-btn ${distance === d ? 'selected' : ''}`}
              onClick={() => onDistance(d)}
            >
              {d === '12+' ? '12+' : d}
            </button>
          ))}
        </div>
      </div>

      <div className="log-block log-block-score">
        <span className="log-label">Pts</span>
        <div className="score-row">
          {Array.from({ length: 13 }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`score-btn ${score === i ? 'selected' : ''}`}
              onClick={() => onScore(i)}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="log-block">
        <span className="log-label">Out</span>
        <div className="btn-grid cols-3">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              className={`pick-btn ${outcome === o ? 'selected' : ''}`}
              onClick={() => onOutcome(o)}
            >
              {OUTCOME_SHORT[o]}
            </button>
          ))}
        </div>
      </div>

      <footer className="log-footer">
        <button type="button" className="btn primary log-btn" onClick={onLog}>
          Log
        </button>
        <button type="button" className="btn secondary log-btn" onClick={onUndo}>
          Undo
        </button>
      </footer>
    </div>
  );
}

export function PracticeOverlay({
  kind,
  onPrimary,
  onSecondary,
}: {
  kind: 'win' | 'miss';
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="practice-overlay">
      <p>{kind === 'win' ? `Hit ${FINSKA_TARGET}` : `${CONSECUTIVE_MISS_LIMIT} misses`}</p>
      <div className="practice-overlay-actions">
        <button type="button" className="btn primary" onClick={onPrimary}>
          Again
        </button>
        <button type="button" className="btn secondary" onClick={onSecondary}>
          Done
        </button>
      </div>
    </div>
  );
}
