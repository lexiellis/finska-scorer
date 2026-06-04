import { useEffect, useState } from 'react';
import { FINSKA_TARGET, scoreEventMessage } from '../scoring';
import { getActiveGame } from '../stats';
import type { AppData, Distance, Game, Outcome, ShotType } from '../types';
import { DISTANCES, OUTCOMES, SHOT_TYPES } from '../types';
import { OptionGrid } from './OptionGrid';
import { ScorePicker } from './ScorePicker';
import { ScoringRules } from './ScoringRules';

interface LogShotResult {
  shot: { id: string } | null;
  event: 'normal' | 'bust' | 'win';
  newScore: number | null;
}

interface GamePanelProps {
  data: AppData;
  onStartGame: (playerIds: string[]) => void;
  onStartPractice: (playerId: string) => void;
  onEndGame: (gameId: string, winnerId: string) => void;
  onEndPractice: (gameId: string) => void;
  onAbandonGame: (gameId: string) => void;
  onResetPracticeRound: (gameId: string, playerId: string) => void;
  onLogShot: (params: {
    gameId: string;
    playerId: string;
    shotType: ShotType;
    distance: Distance;
    score: number;
    outcome: Outcome;
  }) => LogShotResult;
  onUndo: (gameId: string) => void;
}

export function GamePanel({
  data,
  onStartGame,
  onStartPractice,
  onEndGame,
  onEndPractice,
  onAbandonGame,
  onResetPracticeRound,
  onLogShot,
  onUndo,
}: GamePanelProps) {
  const activeGame = getActiveGame(data);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [practicePlayerId, setPracticePlayerId] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [shotType, setShotType] = useState<ShotType | null>(null);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [flash, setFlash] = useState('');
  const [flashKind, setFlashKind] = useState<'info' | 'bust' | 'win'>('info');
  const [practiceHit50, setPracticeHit50] = useState(false);
  const [completedGameId, setCompletedGameId] = useState<string | null>(null);

  const completedGame = completedGameId
    ? data.games.find((g) => g.id === completedGameId)
    : null;

  const sessionGame = activeGame ?? completedGame;

  useEffect(() => {
    if (activeGame && !activePlayerId) {
      setActivePlayerId(activeGame.playerIds[0] ?? null);
    }
    if (!activeGame && !completedGameId) {
      setPracticeHit50(false);
    }
  }, [activeGame, activePlayerId, completedGameId]);

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

  const showFlash = (message: string, kind: 'info' | 'bust' | 'win' = 'info') => {
    setFlash(message);
    setFlashKind(kind);
    if (kind !== 'win') {
      setTimeout(() => setFlash(''), 3500);
    }
  };

  const handleLogShot = () => {
    if (
      !activeGame ||
      !activePlayerId ||
      shotType === null ||
      distance === null ||
      score === null ||
      outcome === null
    ) {
      showFlash('Fill in player, shot type, distance, score, and outcome.');
      return;
    }

    const player = data.players.find((p) => p.id === activePlayerId);
    const name = player?.name ?? 'player';
    const { event, newScore } = onLogShot({
      gameId: activeGame.id,
      playerId: activePlayerId,
      shotType,
      distance,
      score,
      outcome,
    });

    let message = scoreEventMessage(event, name, score);
    if (event === 'normal' && newScore !== null && score > 0) {
      message = `${name}: ${message} (now ${newScore}/${FINSKA_TARGET})`;
    }
    showFlash(message, event === 'win' ? 'win' : event === 'bust' ? 'bust' : 'info');
    resetShotForm();

    if (activeGame.mode === 'game' && event === 'win') {
      setCompletedGameId(activeGame.id);
    }
    if (activeGame.mode === 'practice' && event === 'win') {
      setPracticeHit50(true);
    }
  };

  if (completedGame?.winnerId && completedGame.endedAt) {
    const winner = data.players.find((p) => p.id === completedGame.winnerId);
    return (
      <div className="panel">
        <section className="end-game game-finished">
          <p className="flash-win">{winner?.name ?? 'Player'} hit {FINSKA_TARGET} and wins!</p>
          <ScoringRules compact />
          <button
            type="button"
            className="btn primary large"
            onClick={() => {
              setCompletedGameId(null);
              setFlash('');
            }}
          >
            Back to menu
          </button>
        </section>
      </div>
    );
  }

  if (!sessionGame) {
    return (
      <div className="panel">
        <header className="panel-header">
          <h2>Play or practice</h2>
          <p className="panel-subtitle">
            Competitive game (2+ players) or solo practice — stats log either way.
          </p>
        </header>

        <ScoringRules />

        {data.players.length === 0 ? (
          <p className="empty-state">Add at least one player on the Players tab first.</p>
        ) : (
          <>
            <section className="start-section">
              <h3 className="field-label">Practice mode</h3>
              <p className="section-hint">Solo logging with full rules. Does not affect win rate.</p>
              <div className="player-chips">
                {data.players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`chip ${practicePlayerId === p.id ? 'selected' : ''}`}
                    onClick={() => setPracticePlayerId(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn secondary large"
                disabled={!practicePlayerId}
                onClick={() => {
                  if (!practicePlayerId) return;
                  onStartPractice(practicePlayerId);
                  setActivePlayerId(practicePlayerId);
                  setPracticePlayerId(null);
                }}
              >
                Start practice
              </button>
            </section>

            <section className="start-section">
              <h3 className="field-label">Competitive game</h3>
              <p className="section-hint">Pick 2+ players. First to {FINSKA_TARGET} exactly wins.</p>
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
            </section>
          </>
        )}
      </div>
    );
  }

  const isPractice = sessionGame.mode === 'practice';

  return (
    <div className="panel game-panel">
      <div className="session-badge-row">
        <span className={`session-badge ${isPractice ? 'practice' : 'game'}`}>
          {isPractice ? 'Practice' : 'Game'}
        </span>
        <ScoringRules compact />
      </div>

      <GameScoreboard game={sessionGame} players={data.players} />

      {!isPractice && (
        <section className="field-section">
          <h3 className="field-label">Who threw?</h3>
          <div className="player-chips">
            {sessionGame.playerIds.map((id) => {
              const p = data.players.find((pl) => pl.id === id);
              if (!p) return null;
              const pts = sessionGame.scores[id] ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  className={`chip ${activePlayerId === id ? 'selected' : ''} ${pts >= FINSKA_TARGET - 6 && pts < FINSKA_TARGET ? 'near-win' : ''}`}
                  onClick={() => setActivePlayerId(id)}
                >
                  {p.name}
                  <span className="chip-score">{pts}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

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

      {flash && (
        <p className={`flash-msg flash-${flashKind}`} role="status">
          {flash}
        </p>
      )}

      {practiceHit50 && isPractice && activePlayerId && activeGame && (
        <section className="practice-win-banner">
          <p>You hit {FINSKA_TARGET} in practice!</p>
          <div className="action-row">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onResetPracticeRound(activeGame.id, activePlayerId);
                setPracticeHit50(false);
                setFlash('');
              }}
            >
              New round (0)
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                onEndPractice(activeGame.id);
                setPracticeHit50(false);
              }}
            >
              End practice
            </button>
          </div>
        </section>
      )}

      {activeGame && (
        <>
          <div className="action-row">
            <button type="button" className="btn primary large" onClick={handleLogShot}>
              Log shot
            </button>
            <button type="button" className="btn secondary" onClick={() => onUndo(activeGame.id)}>
              Undo last
            </button>
          </div>

          {isPractice ? (
            <PracticeEndSection
              onEnd={() => onEndPractice(activeGame.id)}
              onDiscard={() => {
                if (confirm('Discard this practice session and its shots?')) {
                  onAbandonGame(activeGame.id);
                }
              }}
            />
          ) : (
            <EndGameSection
              game={activeGame}
              players={data.players}
              onEnd={onEndGame}
              onAbandon={onAbandonGame}
            />
          )}
        </>
      )}
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
      <h2>{game.mode === 'practice' ? 'Practice score' : 'Live scores'}</h2>
      <ul className="scoreboard-list">
        {sorted.map((id) => {
          const p = players.find((pl) => pl.id === id);
          const pts = game.scores[id] ?? 0;
          return (
            <li key={id} className={pts === FINSKA_TARGET ? 'at-target' : ''}>
              <span>{p?.name ?? 'Unknown'}</span>
              <strong>
                {pts}
                <span className="score-target"> / {FINSKA_TARGET}</span>
              </strong>
            </li>
          );
        })}
      </ul>
    </header>
  );
}

function PracticeEndSection({
  onEnd,
  onDiscard,
}: {
  onEnd: () => void;
  onDiscard: () => void;
}) {
  return (
    <section className="end-game">
      <button type="button" className="btn ghost end-toggle" onClick={onEnd}>
        End practice
      </button>
      <button type="button" className="btn ghost danger" onClick={onDiscard}>
        Discard session
      </button>
    </section>
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
        End game manually…
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
