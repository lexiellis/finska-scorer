import { useState } from 'react';
import type { AppData } from '../types';
import type { StorageMode } from '../storage';
import { getPlayerThrowCount } from '../stats';

interface PlayersPanelProps {
  data: AppData;
  storageMode: StorageMode;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onImportCsv: (csvText: string) => string;
  onResetToImportedLog: () => Promise<string>;
}

export function PlayersPanel({
  data,
  storageMode,
  onAdd,
  onRemove,
  onImportCsv,
  onResetToImportedLog,
}: PlayersPanelProps) {
  const { players } = data;
  const [name, setName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };

  const storageLabel =
    storageMode === 'supabase'
      ? 'Shared sync (Supabase) — all devices see the same data'
      : 'This device only (browser localStorage) — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on Vercel to sync';

  return (
    <div className="panel">
      <header className="panel-header">
        <h2>Players</h2>
      </header>

      <p className={`storage-status storage-status--${storageMode}`}>{storageLabel}</p>

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

      <section className="import-section">
        <h3 className="field-label">Import spreadsheet log</h3>
        <p className="import-hint">
          Upload a Log.csv export (stats session). Pin counts are left blank unless you enter them
          when logging new throws.
        </p>
        <label className="btn secondary import-file-btn">
          Choose CSV
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text = typeof reader.result === 'string' ? reader.result : '';
                setImportMessage(onImportCsv(text));
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="btn ghost danger reset-data-btn"
          disabled={resetting}
          onClick={() => {
            setResetting(true);
            void onResetToImportedLog().then((message) => {
              setImportMessage(message);
              setResetting(false);
            });
          }}
        >
          {resetting ? 'Resetting…' : 'Clear all & re-import bundled log'}
        </button>
        {importMessage && <p className="import-status">{importMessage}</p>}
      </section>
    </div>
  );
}
