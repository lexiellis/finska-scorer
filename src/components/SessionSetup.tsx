import { TeamSetup } from './TeamSetup';
import { useState } from 'react';
import type { Player, Team } from '../types';

type SessionMode = 'practice' | 'game';

interface SessionSetupProps {
  players: Player[];
  onTeamsReady: (teams: Team[], mode: SessionMode) => void;
}

export function SessionSetup({ players, onTeamsReady }: SessionSetupProps) {
  const [mode, setMode] = useState<SessionMode>('practice');

  return (
    <section className="session-setup">
      <div className="session-mode-picker">
        <button
          type="button"
          className={`mode-btn ${mode === 'practice' ? 'selected' : ''}`}
          onClick={() => setMode('practice')}
        >
          Practice Mode
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'game' ? 'selected' : ''}`}
          onClick={() => setMode('game')}
        >
          Stat Mode
        </button>
      </div>

      {mode === 'practice' ? (
        <>
          <p className="session-hint">
            Practice Mode — same rules as a game to 50 (bust to 25, three misses). Only the pin
            score is logged each throw.
          </p>
          <TeamSetup players={players} onTeamsReady={(teams) => onTeamsReady(teams, 'practice')} />
        </>
      ) : (
        <>
          <p className="session-hint">
            Stat Mode — game to 50 with full throw logging (shot type, distance, score, outcome).
          </p>
          <TeamSetup players={players} onTeamsReady={(teams) => onTeamsReady(teams, 'game')} />
        </>
      )}
    </section>
  );
}
