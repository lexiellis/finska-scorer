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
    startPractice,
    endGame,
    endPractice,
    abandonGame,
    resetPracticeRound,
    logShot,
    undoLastShot,
  } = useAppData();

  const loggingActive = tab === 'game' && getActiveGame(data) !== null;

  return (
    <div className={`app ${loggingActive ? 'app--logging' : ''}`}>
      <header className="app-header">
        <h1>Finska</h1>
      </header>

      <main className={`app-main ${loggingActive ? 'app-main--log' : ''}`}>
        {tab === 'game' && (
          <GamePanel
            data={data}
            onStartGame={(ids) => startGame(ids)}
            onStartPractice={startPractice}
            onEndGame={endGame}
            onEndPractice={endPractice}
            onAbandonGame={abandonGame}
            onResetPracticeRound={(gameId) => resetPracticeRound(gameId)}
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
