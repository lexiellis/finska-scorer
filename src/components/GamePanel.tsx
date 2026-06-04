import { useEffect, useState } from 'react';
import { FINSKA_TARGET, scoreEventMessage } from '../scoring';
import { getActiveGame } from '../stats';
import {
  CONSECUTIVE_MISS_LIMIT,
  getActiveTeams,
  getGamePlayerIds,
  recomputeGameState,
  teamDisplayName,
} from '../teams';
import type { AppData, Distance, Game, Outcome, ShotType, Team } from '../types';
import { DISTANCES, OUTCOMES, SHOT_TYPES } from '../types';
import { OptionGrid } from './OptionGrid';
import { ScorePicker } from './ScorePicker';
import { ScoringRules } from './ScoringRules';
import { TeamSetup } from './TeamSetup';

interface LogShotResult {
  shot: { id: string } | null;
  event: 'normal' | 'bust' | 'win' | 'miss_loss';
  newScore: number | null;
  missStreak: number;
}

interface GamePanelProps {
  data: AppData;
  onStartGame: (teams: Team[]) => void;
  onStartPractice: (playerId: string) => void;
  onEndGame: (gameId: string, winnerTeamId: string) => void;
  onEndPractice: (gameId: string) => void;
  onAbandonGame: (gameId: string) => void;
  onResetPracticeRound: (gameId: string) => void;
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
  const [practicePlayerId, setPracticePlayerId] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [shotType, setShotType] = useState<ShotType | null>(null);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [flash, setFlash] = useState('');
  const [flashKind, setFlashKind] = useState<'info' | 'bust' | 'win' | 'danger'>('info');
  const [practiceHit50, setPracticeHit50] = useState(false);
  const [practiceMissOut, setPracticeMissOut] = useState(false);
  const [completedGameId, setCompletedGameId] = useState<string | null>(null);

  const completedGame = completedGameId
    ? data.games.find((g) => g.id === completedGameId)
    : null;

  const sessionGame = activeGame ?? completedGame;

  useEffect(() => {
    if (activeGame) {
      const ids = getGamePlayerIds(activeGame);
      if (!activePlayerId || !ids.includes(activePlayerId)) {
        setActivePlayerId(ids[0] ?? null);
      }
    }
    if (!activeGame && !completedGameId) {
      setPracticeHit50(false);
      setPracticeMissOut(false);
    }
  }, [activeGame, activePlayerId, completedGameId]);

  const resetShotForm = () => {
    setShotType(null);
    setDistance(null);
    setScore(null);
    setOutcome(null);
  };

  const showFlash = (
    message: string,
    kind: 'info' | 'bust' | 'win' | 'danger' = 'info',
  ) => {
    setFlash(message);
    setFlashKind(kind);
    if (kind !== 'win') {
      setTimeout(() => setFlash(''), 4000);
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
    const team = activeGame.teams.find((t) => t.playerIds.includes(activePlayerId));
    const teamLabel = team
      ? teamDisplayName(team, data.players)
      : (player?.name ?? 'Team');

    const { event, newScore, missStreak } = onLogShot({
      gameId: activeGame.id,
      playerId: activePlayerId,
      shotType,
      distance,
      score,
      outcome,
    });

    let message = scoreEventMessage(event, teamLabel, score);
    if (event === 'normal' && outcome === 'Miss') {
      message = `${teamLabel}: miss (${missStreak}/${CONSECUTIVE_MISS_LIMIT} in a row)`;
    } else if (event === 'normal' && newScore !== null && score > 0) {
      message = `${teamLabel}: ${message} (now ${newScore}/${FINSKA_TARGET})`;
    }

    const kind =
      event === 'win'
        ? 'win'
        : event === 'miss_loss'
          ? 'danger'
          : event === 'bust'
            ? 'bust'
            : 'info';
    showFlash(message, kind);
    resetShotForm();

    if (activeGame.mode === 'game' && (event === 'win' || event === 'miss_loss')) {
      setCompletedGameId(activeGame.id);
    }
    if (activeGame.mode === 'practice' && event === 'win') {
      setPracticeHit50(true);
    }
    if (activeGame.mode === 'practice' && event === 'miss_loss') {
      setPracticeMissOut(true);
    }
  };

  if (completedGame?.winnerTeamId && completedGame.endedAt) {
    const winnerTeam = completedGame.teams.find(
      (t) => t.id === completedGame.winnerTeamId,
    );
    const winnerName = winnerTeam
      ? teamDisplayName(winnerTeam, data.players)
      : 'Team';
    const eliminated = completedGame.teams.find((t) =>
      completedGame.eliminatedTeamIds.includes(t.id),
    );
    const byMisses =
      eliminated &&
      completedGame.winnerTeamId !== eliminated.id;

    return (
      <div className="panel">
        <section className="end-game game-finished">
          <p className="flash-win">
            {byMisses
              ? `${teamDisplayName(eliminated, data.players)} — 3 misses. ${winnerName} wins!`
              : `${winnerName} hit ${FINSKA_TARGET} and wins!`}
          </p>
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
            Set up teams for competitive play, or practice solo. Stats log either way.
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
              {data.players.length < 2 ? (
                <>
                  <h3 className="field-label">Competitive game</h3>
                  <p className="empty-state">Add at least two players for team games.</p>
                </>
              ) : (
                <TeamSetup players={data.players} onStart={onStartGame} />
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  const isPractice = sessionGame.mode === 'practice';
  const liveShots = data.shots.filter((s) => s.gameId === sessionGame.id);
  const liveState = recomputeGameState(sessionGame, liveShots);
  const throwTeams = isPractice ? sessionGame.teams : getActiveTeams(sessionGame);

  return (
    <div className="panel game-panel">
      <div className="session-badge-row">
        <span className={`session-badge ${isPractice ? 'practice' : 'game'}`}>
          {isPractice ? 'Practice' : 'Game'}
        </span>
        <ScoringRules compact />
      </div>

      <GameScoreboard
        game={sessionGame}
        players={data.players}
        missStreaks={liveState.missStreaks}
      />

      <section className="field-section">
        <h3 className="field-label">Who threw?</h3>
        {throwTeams.map((team) => {
          const pts = sessionGame.scores[team.id] ?? 0;
          const streak = liveState.missStreaks[team.id] ?? 0;
          return (
            <div key={team.id} className="team-throw-group">
              <div className="team-throw-header">
                <span className="team-throw-name">{teamDisplayName(team, data.players)}</span>
                <span className="team-throw-score">
                  {pts}
                  <span className="score-target">/{FINSKA_TARGET}</span>
                </span>
                {streak > 0 && (
                  <span className={`miss-streak ${streak >= 2 ? 'miss-streak-hot' : ''}`}>
                    {streak} miss{streak > 1 ? 'es' : ''}
                  </span>
                )}
              </div>
              <div className="player-chips">
                {team.playerIds.map((id) => {
                  const p = data.players.find((pl) => pl.id === id);
                  if (!p) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`chip ${activePlayerId === id ? 'selected' : ''} ${pts >= FINSKA_TARGET - 6 && pts < FINSKA_TARGET ? 'near-win' : ''}`}
                      onClick={() => setActivePlayerId(id)}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
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

      {flash && (
        <p className={`flash-msg flash-${flashKind}`} role="status">
          {flash}
        </p>
      )}

      {practiceHit50 && isPractice && activeGame && (
        <section className="practice-win-banner">
          <p>You hit {FINSKA_TARGET} in practice!</p>
          <div className="action-row">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onResetPracticeRound(activeGame.id);
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

      {practiceMissOut && isPractice && activeGame && (
        <section className="practice-win-banner practice-miss-banner">
          <p>3 misses in a row — practice round over.</p>
          <div className="action-row">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onResetPracticeRound(activeGame.id);
                setPracticeMissOut(false);
                setFlash('');
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                onEndPractice(activeGame.id);
                setPracticeMissOut(false);
              }}
            >
              End practice
            </button>
          </div>
        </section>
      )}

      {activeGame && !practiceHit50 && !practiceMissOut && (
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
  missStreaks,
}: {
  game: Game;
  players: AppData['players'];
  missStreaks: Record<string, number>;
}) {
  const teamsToShow = game.mode === 'practice' ? game.teams : getActiveTeams(game);
  const sorted = teamsToShow.sort(
    (a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0),
  );

  return (
    <header className="scoreboard">
      <h2>{game.mode === 'practice' ? 'Practice score' : 'Team scores'}</h2>
      <ul className="scoreboard-list">
        {sorted.map((team) => {
          const pts = game.scores[team.id] ?? 0;
          const streak = missStreaks[team.id] ?? 0;
          return (
            <li key={team.id} className={pts === FINSKA_TARGET ? 'at-target' : ''}>
              <span>
                {teamDisplayName(team, players)}
                {streak > 0 && (
                  <span className="scoreboard-miss"> · {streak} miss streak</span>
                )}
              </span>
              <strong>
                {pts}
                <span className="score-target"> / {FINSKA_TARGET}</span>
              </strong>
            </li>
          );
        })}
      </ul>
      {game.eliminatedTeamIds.length > 0 && (
        <p className="eliminated-note">
          Out:{' '}
          {game.eliminatedTeamIds
            .map((id) => {
              const t = game.teams.find((tm) => tm.id === id);
              return t ? teamDisplayName(t, players) : '';
            })
            .filter(Boolean)
            .join(', ')}
        </p>
      )}
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
  onEnd: (gameId: string, winnerTeamId: string) => void;
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
      <h3>Game over — which team won?</h3>
      <div className="player-chips">
        {getActiveTeams(game).map((team) => (
          <button
            key={team.id}
            type="button"
            className="chip selected-outline"
            onClick={() => {
              onEnd(game.id, team.id);
              setShowEnd(false);
            }}
          >
            {teamDisplayName(team, players)} won
          </button>
        ))}
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
