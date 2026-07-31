import { useEffect, useState } from 'react';
import {
  defaultPlayerOrder,
  defaultTeamOrder,
  getMatchGames,
  getStartingTeamForGame,
} from '../match';
import { scoreEventMessage } from '../scoring';
import { getActiveGame } from '../stats';
import {
  CONSECUTIVE_MISS_LIMIT,
  getActivePlayerIds,
  getActiveTeams,
  getFirstThrowPlayer,
  getGameShots,
  getNextThrowPlayer,
  isStatsSession,
  teamDisplayName,
} from '../teams';
import type { AppData, Distance, Game, Outcome, SelectableShotType, Team } from '../types';
import { MatchSummary } from './MatchSummary';
import { OrderSetup } from './OrderSetup';
import { SessionSetup } from './SessionSetup';
import { ShotLogForm } from './ShotLogForm';

interface LogShotResult {
  shot: { id: string } | null;
  event: 'normal' | 'bust' | 'win' | 'miss_loss';
  newScore: number | null;
  missStreak: number;
  nextPlayerId: string | null;
}

interface OrderSetupState {
  teams: Team[];
  teamOrder: string[];
  playerOrder: Record<string, string[]>;
  gameNumber: number;
  matchId: string | null;
  startingTeamId: string;
  startingTeamHint?: string;
  mode: 'game' | 'practice';
}

interface GamePanelProps {
  data: AppData;
  onStartMatchGame: (params: {
    teams: Team[];
    teamOrder: string[];
    playerOrder: Record<string, string[]>;
    startingTeamId: string;
    matchId?: string;
    gameNumber: number;
    mode?: 'game' | 'practice';
  }) => Game | null;
  onEndGame: (gameId: string, winnerTeamId: string) => void;
  onEndMatch: (matchId: string) => void;
  onAbandonGame: (gameId: string) => void;
  onLogShot: (params: {
    gameId: string;
    playerId: string;
    shotType: SelectableShotType;
    distance: Distance;
    score: number;
    outcome: Outcome;
  }) => LogShotResult;
  onUndo: (gameId: string) => void;
  onUpdateShot: (
    shotId: string,
    patch: { shotType: SelectableShotType; distance: Distance; score: number; outcome: Outcome },
  ) => void;
}

export function GamePanel({
  data,
  onStartMatchGame,
  onEndGame,
  onEndMatch,
  onAbandonGame,
  onLogShot,
  onUndo,
  onUpdateShot,
}: GamePanelProps) {
  const activeGame = getActiveGame(data);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [shotType, setShotType] = useState<SelectableShotType | null>(null);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [flash, setFlash] = useState('');
  const [flashKind, setFlashKind] = useState<'info' | 'bust' | 'win' | 'danger'>('info');
  const [completedGameId, setCompletedGameId] = useState<string | null>(null);
  const [showEndMenu, setShowEndMenu] = useState(false);
  const [orderSetup, setOrderSetup] = useState<OrderSetupState | null>(null);

  const completedGame = completedGameId
    ? data.games.find((g) => g.id === completedGameId)
    : null;
  const completedMatch =
    completedGame?.matchId != null
      ? data.matches.find((m) => m.id === completedGame.matchId)
      : null;

  useEffect(() => {
    if (!activeGame) {
      if (!completedGameId) setActivePlayerId(null);
      return;
    }

    const gameShots = getGameShots(activeGame, data.shots);
    const activeIds = getActivePlayerIds(activeGame);

    if (gameShots.length === 0) {
      setActivePlayerId(getFirstThrowPlayer(activeGame));
      return;
    }

    if (!activePlayerId || !activeIds.includes(activePlayerId)) {
      const lastShot = gameShots[gameShots.length - 1];
      setActivePlayerId(
        lastShot
          ? getNextThrowPlayer(activeGame, data.shots, lastShot.playerId)
          : getFirstThrowPlayer(activeGame),
      );
    }
  }, [activeGame, activePlayerId, completedGameId, data.shots]);

  const openOrderSetupForNewMatch = (teams: Team[], mode: 'game' | 'practice' = 'game') => {
    const teamOrder = defaultTeamOrder(teams);
    const playerOrder = defaultPlayerOrder(teams);
    setOrderSetup({
      teams,
      teamOrder,
      playerOrder,
      gameNumber: 1,
      matchId: null,
      startingTeamId: teamOrder[0]!,
      mode,
    });
  };

  const openOrderSetupForNextGame = (matchId: string) => {
    const match = data.matches.find((m) => m.id === matchId);
    if (!match) return;
    const played = getMatchGames(data, matchId);
    const nextGameNumber = played.length + 1;
    const startingTeamId = getStartingTeamForGame(data, match, nextGameNumber);
    const starterName = teamDisplayName(
      match.teams.find((t) => t.id === startingTeamId)!,
      data.players,
    );
    const hint =
      [3, 5, 7, 9].includes(nextGameNumber)
        ? ` ${starterName} throws first (most small points).`
        : undefined;
    const previousMode = played[played.length - 1]?.mode === 'practice' ? 'practice' : 'game';

    setOrderSetup({
      teams: match.teams,
      teamOrder: [...match.teamOrder],
      playerOrder: { ...match.playerOrder },
      gameNumber: nextGameNumber,
      matchId,
      startingTeamId,
      startingTeamHint: hint,
      mode: previousMode,
    });
    setCompletedGameId(null);
  };

  const handleOrderConfirm = (teamOrder: string[], playerOrder: Record<string, string[]>) => {
    if (!orderSetup) return;
    const startingTeamId =
      orderSetup.gameNumber === 1 && !orderSetup.startingTeamHint
        ? teamOrder[0]!
        : orderSetup.startingTeamId;
    onStartMatchGame({
      teams: orderSetup.teams,
      teamOrder,
      playerOrder,
      startingTeamId,
      matchId: orderSetup.matchId ?? undefined,
      gameNumber: orderSetup.gameNumber,
      mode: orderSetup.mode,
    });
    setOrderSetup(null);
  };

  const handleOutcome = (value: Outcome) => {
    setOutcome(value);
  };

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
    if (!activeGame || !activePlayerId || score === null) {
      showFlash('Complete all fields');
      return;
    }

    const scoreOnly = isStatsSession(activeGame);
    const resolvedShotType = scoreOnly ? 'Standard' : shotType;
    const resolvedDistance = scoreOnly ? 4 : distance;
    const resolvedOutcome = scoreOnly ? (score === 0 ? 'Unintended' : 'Intended') : outcome;

    if (resolvedShotType === null || resolvedDistance === null || resolvedOutcome === null) {
      showFlash('Complete all fields');
      return;
    }

    const team = activeGame.teams.find((t) => t.playerIds.includes(activePlayerId));
    const teamLabel = team ? teamDisplayName(team, data.players) : 'Team';

    const { event, newScore, missStreak, nextPlayerId } = onLogShot({
      gameId: activeGame.id,
      playerId: activePlayerId,
      shotType: resolvedShotType,
      distance: resolvedDistance,
      score,
      outcome: resolvedOutcome,
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
    } else if (nextPlayerId) {
      setActivePlayerId(nextPlayerId);
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

  if (orderSetup) {
    return (
      <div className="panel">
        <OrderSetup
          teams={orderSetup.teams}
          players={data.players}
          gameNumber={orderSetup.gameNumber}
          initialTeamOrder={orderSetup.teamOrder}
          initialPlayerOrder={orderSetup.playerOrder}
          startingTeamId={orderSetup.startingTeamId}
          startingTeamHint={orderSetup.startingTeamHint}
          onConfirm={handleOrderConfirm}
          onCancel={() => setOrderSetup(null)}
        />
      </div>
    );
  }

  if (completedGame?.endedAt && completedMatch) {
    return (
      <MatchSummary
        data={data}
        match={completedMatch}
        completedGame={completedGame}
        onPlayAgain={() => openOrderSetupForNextGame(completedMatch.id)}
        onEndMatch={() => {
          onEndMatch(completedMatch.id);
          setCompletedGameId(null);
        }}
      />
    );
  }

  if (completedGame?.endedAt && completedGame.winnerTeamId) {
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
        ) : (
          <SessionSetup players={data.players} onTeamsReady={openOrderSetupForNewMatch} />
        )}
      </div>
    );
  }

  const liveShots = data.shots.filter((s) => s.gameId === activeGame.id);
  const scoreOnly = isStatsSession(activeGame);

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
        scoreOnly={scoreOnly}
        onShotType={setShotType}
        onDistance={setDistance}
        onScore={setScore}
        onOutcome={handleOutcome}
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
          onEndGame={(gameId, winnerTeamId) => {
            onEndGame(gameId, winnerTeamId);
            setCompletedGameId(gameId);
            setShowEndMenu(false);
          }}
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
  const isPractice = isStatsSession(game);

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
              {isPractice ? 'End practice' : 'End game'}
            </button>
            <button
              type="button"
              className="menu-item danger"
              onClick={() => {
                if (confirm(isPractice ? 'Discard practice?' : 'Discard game?')) {
                  onAbandon(game.id);
                }
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
