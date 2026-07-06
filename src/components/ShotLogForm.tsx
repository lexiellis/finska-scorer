import { useRef, useState } from 'react';
import type { AppData, Distance, Game, Outcome, Shot, ShotType } from '../types';
import { DISTANCES, OUTCOMES, SHOT_TYPES } from '../types';
import { formatDistanceLabel } from '../stats';
import { OUTCOME_BUTTON_LABELS } from '../outcomeDisplay';
import { ScoreBoard } from './ScoreBoard';

interface ShotLogFormProps {
  game: Game;
  players: AppData['players'];
  shots: Shot[];
  activePlayerId: string | null;
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
  onUpdateShot: (
    shotId: string,
    patch: { shotType: ShotType; distance: Distance; score: number; outcome: Outcome },
  ) => void;
  onEnd: () => void;
  flash: string;
  flashKind: 'info' | 'bust' | 'win' | 'danger';
}

const OUTCOME_LABELS = OUTCOME_BUTTON_LABELS;

export function ShotLogForm({
  game,
  players,
  shots,
  activePlayerId,
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
  onUpdateShot,
  onEnd,
  flash,
  flashKind,
}: ShotLogFormProps) {
  const [showHistory, setShowHistory] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [scoreTravel, setScoreTravel] = useState(120);

  const openHistory = () => {
    const header = headerRef.current;
    if (header) {
      const totalEl = header.querySelector<HTMLElement>('.score-bubble-total');
      const headerRect = header.getBoundingClientRect();
      const viewportMid = window.innerHeight * 0.72;
      const fromY = totalEl?.getBoundingClientRect().top ?? headerRect.bottom;
      setScoreTravel(Math.max(80, viewportMid - fromY));
    }
    setShowHistory(true);
  };

  const isDistanceLocked = shotType === 'Break';
  const canLog =
    shotType !== null && distance !== null && score !== null && outcome !== null;

  const handleMainAction = () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    if (canLog) onLog();
    else openHistory();
  };

  const mainLabel = showHistory ? 'Back' : canLog ? 'Log shot' : 'View game';
  const mainBtnClass = showHistory || !canLog ? 'btn dark log-btn' : 'btn primary log-btn';

  return (
    <div className="shot-log">
      {flash && (
        <p className={`shot-toast flash-${flashKind}`} role="status">
          {flash}
        </p>
      )}

      {!showHistory && (
        <header className="log-header" ref={headerRef}>
          <ScoreBoard
            game={game}
            players={players}
            shots={shots}
            activePlayerId={activePlayerId}
            mode="compact"
          />
        </header>
      )}

      {showHistory ? (
        <ScoreBoard
          game={game}
          players={players}
          shots={shots}
          activePlayerId={activePlayerId}
          mode="expanded"
          scoreTravel={scoreTravel}
          onUpdateShot={onUpdateShot}
        />
      ) : (
      <div className="log-fields">
        <section className="log-section log-section--type">
          <h3 className="log-section-title">Shot type</h3>
          <div className="btn-grid cols-5">
            {SHOT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`pick-btn pick-btn--compact ${shotType === t ? 'selected' : ''}`}
                onClick={() => onShotType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="log-section log-section--distance">
          <h3 className="log-section-title">
            Distance {isDistanceLocked ? '(locked to 3m)' : ''}
          </h3>
          <div className="btn-grid btn-grid--distance">
            {DISTANCES.map((d) => (
              <button
                key={String(d)}
                type="button"
                className={`pick-btn pick-btn--compact ${distance === d ? 'selected' : ''}`}
                onClick={() => {
                  if (!isDistanceLocked) onDistance(d);
                }}
                disabled={isDistanceLocked}
              >
                {formatDistanceLabel(d)}
              </button>
            ))}
          </div>
        </section>

        <section className="log-section log-section--score">
          <h3 className="log-section-title">Score</h3>
          <div className="score-grid">
            {Array.from({ length: 13 }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`score-btn ${score === i ? 'selected' : ''}`}
                onClick={() => onScore(i)}
                aria-label={`Score ${i}`}
              >
                {i}
              </button>
            ))}
          </div>
        </section>

        <section className="log-section log-section--outcome">
          <h3 className="log-section-title">Outcome</h3>
          <div className="btn-grid cols-3 btn-grid--outcomes">
            {OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                className={`pick-btn pick-btn--outcome ${outcome === o ? 'selected' : ''}`}
                onClick={() => onOutcome(o)}
              >
                {OUTCOME_LABELS[o]}
              </button>
            ))}
          </div>
        </section>
      </div>
      )}

      <footer className="log-footer">
        <button type="button" className={mainBtnClass} onClick={handleMainAction}>
          {mainLabel}
        </button>
        <div className="log-footer-actions">
          <button
            type="button"
            className="btn-icon log-footer-icon"
            onClick={() => {
              if (confirm('Undo last shot?')) onUndo();
            }}
            aria-label="Undo last shot"
          >
            ↩
          </button>
          <button
            type="button"
            className="btn-icon log-footer-icon"
            onClick={onEnd}
            aria-label="End session"
          >
            ⋯
          </button>
        </div>
      </footer>
    </div>
  );
}
