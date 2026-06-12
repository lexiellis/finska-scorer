import { useEffect, useState } from 'react';
import { scoreEventMessage } from '../scoring';
import { getActiveGame } from '../stats';
import {
  CONSECUTIVE_MISS_LIMIT,
  getActivePlayerIds,
  getActiveTeams,
  getFirstThrowPlayer,
  getGameShots,
  getNextThrowPlayer,
  teamDisplayName,
} from '../teams';
import type { AppData, Distance, Game, Outcome, ShotType, Team } from '../types';
import { ShotLogForm } from './ShotLogForm';
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
  onEndGame: (gameId: string, winnerTeamId: string) => void;
  onAbandonGame: (gameId: string) => void;
  onLogShot: (params: {
    gameId: string;
    playerId: string;
    shotType: ShotType;
    distance: Distance;
    score: number;
    outcome: Outcome;
  }) => LogShotResult;
  onUndo: (gameId: string) => void;
  onUpdateShot: (
    shotId: string,
    patch: { shotType: ShotType; distance: Distance; score: number; outcome: Outcome },
  ) => void;
}

export function GamePanel({
  data,
  onStartGame,
  onEndGame,
  onAbandonGame,
  onLogShot,
  onUndo,
  onUpdateShot,
}: GamePanelProps) {
  const activeGame = getActiveGame(data);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [shotType, setShotType] = useState<ShotType | null>(null);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [flash, setFlash] = useState('');
  const [flashKind, setFlashKind] = useState<'info' | 'bust' | 'win' | 'danger'>('info');
  const [completedGameId, setCompletedGameId] = useState<string | null>(null);
  const [showEndMenu, setShowEndMenu] = useState(false);

  const completedGame = completedGameId
    ? data.games.find((g) => g.id === completedGameId)
    : null;

  useEffect(() => {
    if (activeGame) {
      const activeIds = getActivePlayerIds(activeGame);
      if (!activePlayerId || !activeIds.includes(activePlayerId)) {
        const gameShots = getGameShots(activeGame, data.shots);
        const lastShot = gameShots[gameShots.length - 1];
        setActivePlayerId(
          lastShot
            ? getNextThrowPlayer(activeGame, data.shots, lastShot.playerId)
            : getFirstThrowPlayer(activeGame),
        );
      }
    }
    if (!activeGame && !completedGameId) {
      setShowEndMenu(false);
    }
  }, [activeGame, activePlayerId, completedGameId, data.shots]);

  useEffect(() => {
    if (shotType === '12 Break' && distance !== 4) {
      setDistance(4);
    }
  }, [distance, shotType]);

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
    setTimeout(() => setFlash(''), kind === 'win' ? 5000 : 2200);
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
      showFlash('Complete all fields');
      return;
    }

    const team = activeGame.teams.find((t) => t.playerIds.includes(activePlayerId));
    const teamLabel = team
      ? teamDisplayName(team, data.players)
      : 'Team';

    const { event, newScore, missStreak } = onLogShot({
      gameId: activeGame.id,
      playerId: activePlayerId,
      shotType,
      distance,
      score,
      outcome,
    });

    let message = scoreEventMessage(event, teamLabel, score);
    if (event === 'normal' && score === 0) {
      message = `${teamLabel} miss ${missStreak}/${CONSECUTIVE_MISS_LIMIT}`;
    } else if (event === 'normal' && newScore !== null && score > 0) {
      message = `${teamLabel} → ${newScore}`;
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

    if (event === 'win' || event === 'miss_loss') {
      setCompletedGameId(activeGame.id);
    } else {
      setActivePlayerId(getNextThrowPlayer(activeGame, data.shots, activePlayerId));
    }
  };

  const handleUndo = () => {
    if (!activeGame) return;
    const gameShots = getGameShots(activeGame, data.shots);
    const lastShot = gameShots[gameShots.length - 1];
    onUndo(activeGame.id);
    if (lastShot) {
      setActivePlayerId(lastShot.playerId);
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
      eliminated && completedGame.winnerTeamId !== eliminated.id;

    return (
      <div className="panel panel-done">
        <p className="flash-win">
          {byMisses
            ? `${teamDisplayName(eliminated, data.players)} out · ${winnerName} wins`
            : `${winnerName} wins`}
        </p>
        <button
          type="button"
          className="btn primary large"
          onClick={() => {
            setCompletedGameId(null);
            setFlash('');
          }}
        >
          Done
        </button>
      </div>
    );
  }

  if (!activeGame) {
    return (
      <div className="panel">
        {data.players.length === 0 ? (
          <p className="empty-state">Add players first.</p>
        ) : data.players.length < 2 ? (
          <p className="empty-state">Need 2+ players for a game.</p>
        ) : (
          <TeamSetup players={data.players} onStart={onStartGame} />
        )}
      </div>
    );
  }

  const liveShots = data.shots.filter((s) => s.gameId === activeGame.id);

  return (
    <>
      <ShotLogForm
        game={activeGame}
        players={data.players}
        shots={liveShots}
        activePlayerId={activePlayerId}
        shotType={shotType}
        distance={distance}
        score={score}
        outcome={outcome}
        onShotType={setShotType}
        onDistance={setDistance}
        onScore={setScore}
        onOutcome={setOutcome}
        onLog={handleLogShot}
        onUndo={handleUndo}
        onUpdateShot={onUpdateShot}
        onEnd={() => setShowEndMenu(true)}
        flash={flash}
        flashKind={flashKind}
      />

      {showEndMenu && (
        <EndMenu
          game={activeGame}
          players={data.players}
          onClose={() => setShowEndMenu(false)}
          onEndGame={onEndGame}
          onAbandon={onAbandonGame}
        />
      )}
    </>
  );
}

function EndMenu({
  game,
  players,
  onClose,
  onEndGame,
  onAbandon,
}: {
  game: Game;
  players: AppData['players'];
  onClose: () => void;
  onEndGame: (gameId: string, winnerTeamId: string) => void;
  onAbandon: (gameId: string) => void;
}) {
  const [pickWinner, setPickWinner] = useState(false);

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu-sheet" onClick={(e) => e.stopPropagation()}>
        {pickWinner ? (
          <>
            <p className="menu-title">Winner</p>
            {getActiveTeams(game).map((team) => (
              <button
                key={team.id}
                type="button"
                className="menu-item"
                onClick={() => onEndGame(game.id, team.id)}
              >
                {teamDisplayName(team, players)}
              </button>
            ))}
            <button type="button" className="menu-item ghost" onClick={() => setPickWinner(false)}>
              Back
            </button>
          </>
        ) : (
          <>
            <button type="button" className="menu-item" onClick={() => setPickWinner(true)}>
              End game
            </button>
            <button
              type="button"
              className="menu-item danger"
              onClick={() => {
                if (confirm('Discard game?')) onAbandon(game.id);
              }}
            >
              Discard
            </button>
          </>
        )}
        <button type="button" className="menu-item ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
