import { useState } from 'react';
import type { AppData } from '../types';
import { getPlayerThrowCount } from '../stats';

interface PlayersPanelProps {
  data: AppData;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export function PlayersPanel({ data, onAdd, onRemove }: PlayersPanelProps) {
  const { players } = data;
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <div className="panel">
      <header className="panel-header">
        <h2>Players</h2>
      </header>

      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <input
          type="text"
          name="playerName"
          placeholder="Player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-input"
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="submit" className="btn primary add-btn">
          Add
        </button>
      </form>

      {players.length === 0 ? (
        <p className="empty-state">No players yet. Add at least two to start a game.</p>
      ) : (
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id} className="player-row">
              <span className="player-name">
                {p.name}
                <span className="player-throws">
                  {getPlayerThrowCount(data, p.id)} throws
                </span>
              </span>
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
