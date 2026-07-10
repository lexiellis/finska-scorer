import { useState } from 'react';
import type { AppData } from '../types';
import type { SyncStatus } from '../storage';
import { getPlayerThrowCount } from '../stats';

interface PlayersPanelProps {
  data: AppData;
  syncStatus: SyncStatus;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onImportCsv: (csvText: string) => string;
  onResetToImportedLog: () => Promise<string>;
}

function syncStatusClass(sync: SyncStatus): string {
  if (sync.error || sync.lastSaveOk === false) return 'storage-status--error';
  if (sync.mode === 'supabase' && sync.lastSaveOk) return 'storage-status--ok';
  if (sync.mode === 'supabase') return 'storage-status--supabase';
  return 'storage-status--local';
}

function syncStatusMessage(sync: SyncStatus, playerCount: number, shotCount: number): string {
  const shortId = sync.deviceId.slice(0, 8);

  if (sync.mode === 'local') {
    return `This phone/browser only — data is not shared with other devices (id ${shortId}…).`;
  }

  if (sync.error) {
    return `Backup error: ${sync.error}. Data is still saved on this device.`;
  }

  if (sync.lastSaveOk === false) {
    return 'Could not back up to Supabase. Data is still saved on this device.';
  }

  const summary = `${playerCount} players, ${shotCount} throws`;
  if (sync.lastSaveOk) {
    return `This phone only — ${summary}. Backed up to your device row (${shortId}…), not shared with other phones.`;
  }

  if (sync.remoteRowFound === false) {
    return `This device (${shortId}…) — backing up ${summary}…`;
  }

  return `This device (${shortId}…) — loading backup…`;
}

export function PlayersPanel({
  data,
  syncStatus,
  onAdd,
  onRemove,
  onImportCsv,
  onResetToImportedLog,
}: PlayersPanelProps) {
  const { players, shots } = data;
  const [name, setName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [resetting, setResetting] = useState(false);

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

      <div className={`storage-status ${syncStatusClass(syncStatus)}`} role="status">
        <strong>Data storage</strong>
        <p>{syncStatusMessage(syncStatus, players.length, shots.length)}</p>
      </div>

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
