import { useState } from 'react';
import type { Player } from '../types';

interface PlayersPanelProps {
  players: Player[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export function PlayersPanel({ players, onAdd, onRemove }: PlayersPanelProps) {
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName('');
  };

  return (
    <div className="panel">
      <header className="panel-header">
        <h2>Players</h2>
        <p className="panel-subtitle">Add everyone you track stats for.</p>
      </header>

      <div className="add-row">
        <input
          type="text"
          placeholder="Player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="text-input"
        />
        <button type="button" className="btn primary" onClick={handleAdd}>
          Add
        </button>
      </div>

      {players.length === 0 ? (
        <p className="empty-state">No players yet. Add at least two to start a game.</p>
      ) : (
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id} className="player-row">
              <span className="player-name">{p.name}</span>
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => onRemove(p.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
