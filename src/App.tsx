import { useState } from 'react';
import { GamePanel } from './components/GamePanel';
import { PlayersPanel } from './components/PlayersPanel';
import { StatsPanel } from './components/StatsPanel';
import { useAppData } from './hooks/useAppData';
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
    startPractice,
    endGame,
    endPractice,
    abandonGame,
    resetPracticeRound,
    logShot,
    undoLastShot,
  } = useAppData();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Finska Scorer</h1>
        <p>Log every throw. Track the stats.</p>
      </header>

      <main className="app-main">
        {tab === 'game' && (
          <GamePanel
            data={data}
            onStartGame={(ids) => startGame(ids)}
            onStartPractice={startPractice}
            onEndGame={endGame}
            onEndPractice={endPractice}
            onAbandonGame={abandonGame}
            onResetPracticeRound={resetPracticeRound}
            onLogShot={logShot}
            onUndo={undoLastShot}
          />
        )}
        {tab === 'stats' && <StatsPanel data={data} />}
        {tab === 'players' && (
          <PlayersPanel
            players={data.players}
            onAdd={addPlayer}
            onRemove={removePlayer}
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
