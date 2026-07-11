import { useState } from 'react';
import { TeamSetup } from './TeamSetup';
import type { Player, Team } from '../types';

type SessionMode = 'practice' | 'game';

interface SessionSetupProps {
  players: Player[];
  onTeamsReady: (teams: Team[]) => void;
  onStartStatsSession: (playerIds: string[]) => void;
}

export function SessionSetup({
  players,
  onTeamsReady,
  onStartStatsSession,
}: SessionSetupProps) {
  const [mode, setMode] = useState<SessionMode>('practice');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const addPracticePlayer = (id: string) => {
    setSelectedIds((prev) => [...prev, id]);
  };

  const removePracticePlayerAt = (index: number) => {
    setSelectedIds((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <section className="session-setup">
      <div className="session-mode-picker">
        <button
          type="button"
          className={`mode-btn ${mode === 'practice' ? 'selected' : ''}`}
          onClick={() => setMode('practice')}
        >
          Practice
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'game' ? 'selected' : ''}`}
          onClick={() => setMode('game')}
        >
          Game to 50
        </button>
      </div>

      {mode === 'practice' ? (
        <>
          <p className="session-hint">
            Pick throwers for practice. Tap players to add them in throw order (duplicates allowed,
            e.g. Lexi vs Lexi). Practice throws are excluded from saved stats.
          </p>
          <div className="player-chips">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                onClick={() => addPracticePlayer(p.id)}
              >
                + {p.name}
              </button>
            ))}
          </div>
          {selectedIds.length > 0 && (
            <div className="player-chips">
              {selectedIds.map((id, index) => {
                const player = players.find((p) => p.id === id);
                if (!player) return null;
                return (
                  <button
                    key={`${id}-${index}`}
                    type="button"
                    className="chip selected"
                    onClick={() => removePracticePlayerAt(index)}
                    title="Remove thrower"
                  >
                    {player.name}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="btn primary large"
            disabled={selectedIds.length < 1}
            onClick={() => onStartStatsSession(selectedIds)}
          >
            Start practice
          </button>
        </>
      ) : (
        <TeamSetup players={players} onTeamsReady={onTeamsReady} />
      )}
    </section>
  );
}
