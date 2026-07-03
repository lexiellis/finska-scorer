import { useState } from 'react';
import { TeamSetup } from './TeamSetup';
import type { Player, Team } from '../types';

type SessionMode = 'stats' | 'game';

interface SessionSetupProps {
  players: Player[];
  onStartGame: (teams: Team[]) => void;
  onStartStatsSession: (playerIds: string[]) => void;
}

export function SessionSetup({
  players,
  onStartGame,
  onStartStatsSession,
}: SessionSetupProps) {
  const [mode, setMode] = useState<SessionMode>('stats');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  return (
    <section className="session-setup">
      <div className="session-mode-picker">
        <button
          type="button"
          className={`mode-btn ${mode === 'stats' ? 'selected' : ''}`}
          onClick={() => setMode('stats')}
        >
          Stats session
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'game' ? 'selected' : ''}`}
          onClick={() => setMode('game')}
        >
          Game to 50
        </button>
      </div>

      {mode === 'stats' ? (
        <>
          <p className="session-hint">
            Pick who&apos;s throwing. Log every throw - no game scoring. Can be used for solo play.
          </p>
          <div className="player-chips">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${selectedIds.includes(p.id) ? 'selected' : ''}`}
                onClick={() => togglePlayer(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn primary large"
            disabled={selectedIds.length < 1}
            onClick={() => onStartStatsSession(selectedIds)}
          >
            Start session
          </button>
        </>
      ) : (
        <TeamSetup players={players} onStart={onStartGame} />
      )}
    </section>
  );
}
