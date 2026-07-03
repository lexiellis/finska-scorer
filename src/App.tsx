import { useState } from 'react';
import { GamePanel } from './components/GamePanel';
import { PlayersPanel } from './components/PlayersPanel';
import { StatsPanel } from './components/StatsPanel';
import { useAppData } from './hooks/useAppData';
import { getActiveGame } from './stats';
import type { Tab } from './types';
import './App.css';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'game', label: 'Log', icon: '🎯' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'players', label: 'Players', icon: '👥' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('game');
  const {
    data,
    addPlayer,
    removePlayer,
    startGame,
    startStatsSession,
    endStatsSession,
    endGame,
    abandonGame,
    logShot,
    undoLastShot,
    updateShot,
    importCsvLog,
  } = useAppData();

  const loggingActive = tab === 'game' && getActiveGame(data) !== null;

  return (
    <div className={`app ${loggingActive ? 'app--logging' : ''}`}>
      <header className="app-header">
        <h1>{loggingActive ? '🎯 Finska Scorer' : 'Finska Scorer'}</h1>
        {!loggingActive && (
          <p className="app-tagline">Log every throw. Throw every log.</p>
        )}
      </header>

      <main className={`app-main ${loggingActive ? 'app-main--log' : ''}`}>
        {tab === 'game' && (
          <GamePanel
            data={data}
            onStartGame={startGame}
            onStartStatsSession={startStatsSession}
            onEndGame={endGame}
            onEndStatsSession={endStatsSession}
            onAbandonGame={abandonGame}
            onLogShot={logShot}
            onUndo={undoLastShot}
            onUpdateShot={updateShot}
          />
        )}
        {tab === 'stats' && <StatsPanel data={data} />}
        {tab === 'players' && (
          <PlayersPanel
            data={data}
            onAdd={addPlayer}
            onRemove={removePlayer}
            onImportCsv={importCsvLog}
          />
        )}
      </main>

      <nav className="tab-bar" aria-label="Main navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
