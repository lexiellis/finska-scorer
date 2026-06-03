import { useEffect, useState } from 'react';
import { getActiveGame } from '../stats';
import type { AppData, Distance, Game, Outcome, ShotType } from '../types';
import {
  DISTANCES,
  OUTCOMES,
  SHOT_TYPES,
} from '../types';
import { OptionGrid } from './OptionGrid';
import { ScorePicker } from './ScorePicker';

interface GamePanelProps {
  data: AppData;
  onStartGame: (playerIds: string[]) => void;
  onEndGame: (gameId: string, winnerId: string) => void;
  onAbandonGame: (gameId: string) => void;
  onLogShot: (params: {
    gameId: string;
    playerId: string;
    shotType: ShotType;
    distance: Distance;
    score: number;
    outcome: Outcome;
  }) => void;
  onUndo: (gameId: string) => void;
}

export function GamePanel({
  data,
  onStartGame,
  onEndGame,
  onAbandonGame,
  onLogShot,
  onUndo,
}: GamePanelProps) {
  const activeGame = getActiveGame(data);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [shotType, setShotType] = useState<ShotType | null>(null);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (activeGame && !activePlayerId) {
      setActivePlayerId(activeGame.playerIds[0] ?? null);
    }
  }, [activeGame, activePlayerId]);

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const resetShotForm = () => {
    setShotType(null);
    setDistance(null);
    setScore(null);
    setOutcome(null);
  };

  const handleLogShot = () => {
    if (!activeGame || !activePlayerId || shotType === null || distance === null || score === null || outcome === null) {
      setFlash('Fill in player, shot type, distance, score, and outcome.');
      return;
    }
    onLogShot({
      gameId: activeGame.id,
      playerId: activePlayerId,
      shotType,
      distance,
      score,
      outcome,
    });
    const player = data.players.find((p) => p.id === activePlayerId);
    setFlash(`Logged +${score} for ${player?.name ?? 'player'}`);
    resetShotForm();
    setTimeout(() => setFlash(''), 2000);
  };

  if (!activeGame) {
    return (
      <div className="panel">
        <header className="panel-header">
          <h2>New game</h2>
          <p className="panel-subtitle">Pick who is playing, then start logging shots.</p>
        </header>

        {data.players.length < 2 ? (
          <p className="empty-state">Add at least two players on the Players tab first.</p>
        ) : (
          <>
            <div className="player-chips">
              {data.players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${selectedPlayers.includes(p.id) ? 'selected' : ''}`}
                  onClick={() => togglePlayer(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn primary large"
              disabled={selectedPlayers.length < 2}
              onClick={() => {
                const first = selectedPlayers[0] ?? null;
                onStartGame(selectedPlayers);
                setSelectedPlayers([]);
                setActivePlayerId(first);
              }}
            >
              Start game
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="panel game-panel">
      <GameScoreboard game={activeGame} players={data.players} />

      <section className="field-section">
        <h3 className="field-label">Who threw?</h3>
        <div className="player-chips">
          {activeGame.playerIds.map((id) => {
            const p = data.players.find((pl) => pl.id === id);
            if (!p) return null;
            return (
              <button
                key={id}
                type="button"
                className={`chip ${activePlayerId === id ? 'selected' : ''}`}
                onClick={() => setActivePlayerId(id)}
              >
                {p.name}
                <span className="chip-score">{activeGame.scores[id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </section>

      <OptionGrid
        label="Shot type"
        options={SHOT_TYPES}
        value={shotType}
        onChange={setShotType}
        columns={4}
      />

      <OptionGrid
        label="Distance (m)"
        options={DISTANCES}
        value={distance}
        onChange={setDistance}
        formatLabel={(d) => (d === '12+' ? '12+' : `${d}m`)}
        columns={4}
      />

      <ScorePicker value={score} onChange={setScore} />

      <OptionGrid
        label="Outcome"
        options={OUTCOMES}
        value={outcome}
        onChange={setOutcome}
        columns={2}
      />

      {flash && <p className="flash-msg">{flash}</p>}

      <div className="action-row">
        <button type="button" className="btn primary large" onClick={handleLogShot}>
          Log shot
        </button>
        <button type="button" className="btn secondary" onClick={() => onUndo(activeGame.id)}>
          Undo last
        </button>
      </div>

      <EndGameSection
        game={activeGame}
        players={data.players}
        onEnd={onEndGame}
        onAbandon={onAbandonGame}
      />
    </div>
  );
}

function GameScoreboard({
  game,
  players,
}: {
  game: Game;
  players: AppData['players'];
}) {
  const sorted = [...game.playerIds].sort(
    (a, b) => (game.scores[b] ?? 0) - (game.scores[a] ?? 0),
  );

  return (
    <header className="scoreboard">
      <h2>Live scores</h2>
      <ul className="scoreboard-list">
        {sorted.map((id) => {
          const p = players.find((pl) => pl.id === id);
          return (
            <li key={id}>
              <span>{p?.name ?? 'Unknown'}</span>
              <strong>{game.scores[id] ?? 0}</strong>
            </li>
          );
        })}
      </ul>
    </header>
  );
}

function EndGameSection({
  game,
  players,
  onEnd,
  onAbandon,
}: {
  game: Game;
  players: AppData['players'];
  onEnd: (gameId: string, winnerId: string) => void;
  onAbandon: (gameId: string) => void;
}) {
  const [showEnd, setShowEnd] = useState(false);

  if (!showEnd) {
    return (
      <button type="button" className="btn ghost end-toggle" onClick={() => setShowEnd(true)}>
        End game…
      </button>
    );
  }

  return (
    <section className="end-game">
      <h3>Game over — who won?</h3>
      <div className="player-chips">
        {game.playerIds.map((id) => {
          const p = players.find((pl) => pl.id === id);
          return (
            <button
              key={id}
              type="button"
              className="chip selected-outline"
              onClick={() => {
                onEnd(game.id, id);
                setShowEnd(false);
              }}
            >
              {p?.name} won
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="btn ghost danger"
        onClick={() => {
          if (confirm('Discard this game and all its shots?')) {
            onAbandon(game.id);
            setShowEnd(false);
          }
        }}
      >
        Discard game
      </button>
      <button type="button" className="btn ghost" onClick={() => setShowEnd(false)}>
        Cancel
      </button>
    </section>
  );
}
