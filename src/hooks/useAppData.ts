import { useCallback, useEffect, useState } from 'react';
import { IMPORT_DATA_VERSION, importBundledMolkkyLog, importLogCsv } from '../importLogCsv';
import { applyFinskaScore } from '../scoring';
import {
  clearLocalAppData,
  createId,
  dedupeLocalAppData,
  getDeviceId,
  initialSyncStatus,
  isRemoteStorageConfigured,
  loadData,
  loadRemoteData,
  saveData,
  setImportDataVersion,
  getImportDataVersion,
  type SyncStatus,
} from '../storage';
import {
  defaultPlayerOrder,
  defaultTeamOrder,
  teamsWithPlayerOrder,
} from '../match';
import {
  buildThrowOrder,
  getNextThrowPlayer,
  getTeamForPlayer,
  isMissOutcome,
  recomputeGameState,
  rotateTeamsStartingFirst,
} from '../teams';
import { replaceGameShots } from '../breakShot';
import type { AppData, Distance, Game, Match, Outcome, Player, Shot, SelectableShotType, Team } from '../types';

function recalculateShotScores(game: Game, shots: Shot[]): Shot[] {
  const ordered = [...shots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const scores = Object.fromEntries(game.teams.map((t) => [t.id, 0]));

  return ordered.map((shot) => {
    const scoreBefore = scores[shot.teamId] ?? 0;
    let scoreAfter = scoreBefore;

    if (!isMissOutcome(shot.outcome, shot.score) && shot.score !== null) {
      const applied = applyFinskaScore(scoreBefore, shot.score);
      scoreAfter = applied.newScore;
    }

    scores[shot.teamId] = scoreAfter;
    return { ...shot, scoreBefore, scoreAfter };
  });
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(initialSyncStatus);

  useEffect(() => {
    let isCancelled = false;

    async function hydrate() {
      const needsFreshImport = getImportDataVersion() !== IMPORT_DATA_VERSION;
      let loaded: AppData = { players: [], matches: [], games: [], shots: [] };
      let nextSync = initialSyncStatus();

      if (!needsFreshImport) {
        loaded = loadData();
        if (isRemoteStorageConfigured()) {
          const remote = await loadRemoteData(loaded);
          if (remote.status === 'ok') {
            loaded = remote.data;
            nextSync = {
              ...nextSync,
              remoteRowFound: remote.remoteFound,
              sharedStats: remote.sharedStats,
            };
          } else if (remote.status === 'empty') {
            nextSync = { ...nextSync, remoteRowFound: false, sharedStats: true };
          } else if (remote.status === 'error') {
            nextSync = { ...nextSync, error: remote.message };
          }
        }
      } else {
        clearLocalAppData();
        if (isRemoteStorageConfigured()) {
          nextSync = { ...nextSync, remoteRowFound: false };
        }
      }

      const imported = await importBundledMolkkyLog(loaded, {
        freshImport: needsFreshImport,
      });
      if (isCancelled) return;

      if (imported.imported > 0 || needsFreshImport) {
        setImportDataVersion(IMPORT_DATA_VERSION);
      }

      setSyncStatus({ ...nextSync, deviceId: nextSync.deviceId });
      setData(dedupeLocalAppData(imported.data));
      setIsHydrated(true);
    }

    void hydrate();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void saveData(data).then((result) => {
      if ('skipped' in result && result.skipped) return;
      setSyncStatus((prev) => ({
        ...prev,
        lastSaveOk: result.ok,
        error: result.ok ? prev.error : result.message,
        remoteRowFound: result.ok ? true : prev.remoteRowFound,
        sharedStats: result.ok ? true : prev.sharedStats,
      }));
    });
  }, [data, isHydrated]);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData((prev) => dedupeLocalAppData(fn(prev)));
  }, []);

  const addPlayer = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const player: Player = {
      id: createId(),
      name: trimmed,
      createdAt: new Date().toISOString(),
    };
    update((prev) => ({ ...prev, players: [...prev.players, player] }));
    return player;
  }, [update]);

  const removePlayer = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== id),
    }));
  }, [update]);

  const startMatchGame = useCallback(
    (params: {
      teams: Team[];
      teamOrder: string[];
      playerOrder: Record<string, string[]>;
      startingTeamId: string;
      matchId?: string;
      gameNumber: number;
    }) => {
      const { teams, teamOrder, playerOrder, startingTeamId, matchId, gameNumber } = params;
      if (teams.length < 2) return null;

      const orderedTeams = rotateTeamsStartingFirst(
        teamsWithPlayerOrder(teams, playerOrder),
        startingTeamId,
      );
      const scores = Object.fromEntries(orderedTeams.map((t) => [t.id, 0]));
      const throwOrder = buildThrowOrder(
        orderedTeams,
        teamOrder,
        playerOrder,
        startingTeamId,
      );

      const game: Game = {
        id: createId(),
        mode: 'game',
        teams: orderedTeams,
        throwOrder,
        scores,
        eliminatedTeamIds: [],
        winnerTeamId: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        matchId,
        gameNumber,
        scribeDeviceId: getDeviceId(),
      };

      update((prev) => {
        let matches = prev.matches;
        let resolvedMatchId = matchId;

        if (!resolvedMatchId) {
          const match: Match = {
            id: createId(),
            teams: orderedTeams,
            teamOrder: [...teamOrder],
            playerOrder: { ...playerOrder },
            startedAt: new Date().toISOString(),
            endedAt: null,
          };
          matches = [...matches, match];
          resolvedMatchId = match.id;
          game.matchId = resolvedMatchId;
        } else {
          matches = matches.map((m) =>
            m.id === resolvedMatchId
              ? {
                  ...m,
                  teams: orderedTeams,
                  teamOrder: [...teamOrder],
                  playerOrder: { ...playerOrder },
                }
              : m,
          );
        }

        return {
          ...prev,
          matches,
          games: [...prev.games, { ...game, matchId: resolvedMatchId }],
        };
      });

      return game;
    },
    [update],
  );

  const endMatch = useCallback((matchId: string) => {
    update((prev) => ({
      ...prev,
      matches: prev.matches.map((m) =>
        m.id === matchId ? { ...m, endedAt: new Date().toISOString() } : m,
      ),
    }));
  }, [update]);

  /** @deprecated Use startMatchGame via order setup */
  const startGame = useCallback(
    (teams: Team[]) => {
      const teamOrder = defaultTeamOrder(teams);
      const playerOrder = defaultPlayerOrder(teams);
      return startMatchGame({
        teams,
        teamOrder,
        playerOrder,
        startingTeamId: teamOrder[0]!,
        gameNumber: 1,
      });
    },
    [startMatchGame],
  );

  const startStatsSession = useCallback((playerIds: string[]) => {
    if (playerIds.length < 1) return null;
    const teams: Team[] = playerIds.map((pid) => ({
      id: pid,
      name: '',
      playerIds: [pid],
    }));
    const scores = Object.fromEntries(teams.map((t) => [t.id, 0]));
    const game: Game = {
      id: createId(),
      mode: 'stats',
      teams,
      throwOrder: [...playerIds],
      scores,
      eliminatedTeamIds: [],
      winnerTeamId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      scribeDeviceId: getDeviceId(),
    };
    update((prev) => ({ ...prev, games: [...prev.games, game] }));
    return game;
  }, [update]);

  const endStatsSession = useCallback((gameId: string) => {
    update((prev) => ({
      ...prev,
      games: prev.games.map((g) =>
        g.id === gameId ? { ...g, endedAt: new Date().toISOString() } : g,
      ),
    }));
  }, [update]);

  const endGame = useCallback((gameId: string, winnerTeamId: string) => {
    update((prev) => ({
      ...prev,
      games: prev.games.map((g) =>
        g.id === gameId
          ? { ...g, winnerTeamId, endedAt: new Date().toISOString() }
          : g,
      ),
    }));
  }, [update]);

  const abandonGame = useCallback((gameId: string) => {
    update((prev) => {
      const game = prev.games.find((g) => g.id === gameId);
      const matchId = game?.matchId;
      return {
        ...prev,
        games: prev.games.filter((g) => g.id !== gameId),
        shots: prev.shots.filter((s) => s.gameId !== gameId),
        matches:
          matchId && !prev.games.some((g) => g.matchId === matchId && g.id !== gameId)
            ? prev.matches.map((m) =>
                m.id === matchId ? { ...m, endedAt: new Date().toISOString() } : m,
              )
            : prev.matches,
      };
    });
  }, [update]);

  const logShot = useCallback(
    (params: {
      gameId: string;
      playerId: string;
      shotType: SelectableShotType;
      distance: Distance;
      score: number;
      outcome: Outcome;
    }) => {
      let resultShot: Shot | null = null;
      let scoreEvent: ReturnType<typeof applyFinskaScore>['event'] | 'miss_loss' = 'normal';
      let newScore: number | null = null;
      let missStreak = 0;
      let nextPlayerId: string | null = null;

      update((prev) => {
        const game = prev.games.find((g) => g.id === params.gameId);
        if (!game || game.endedAt) return prev;

        const team = getTeamForPlayer(game, params.playerId);
        if (!team) return prev;

        const isStats = game.mode === 'stats';
        const scoreBefore = isStats ? 0 : (game.scores[team.id] ?? 0);
        const isMiss = isMissOutcome(params.outcome, params.score);

        const shot: Shot = {
          id: createId(),
          gameId: params.gameId,
          teamId: team.id,
          playerId: params.playerId,
          shotType: params.shotType,
          distance: params.distance,
          score: params.score,
          outcome: params.outcome,
          recordedAt: new Date().toISOString(),
          scoreBefore,
          scoreAfter: scoreBefore,
        };

        const gameShots = [...prev.shots.filter((s) => s.gameId === params.gameId), shot];
        const allShots = replaceGameShots(prev.shots, params.gameId, gameShots);
        nextPlayerId = getNextThrowPlayer(game, allShots, params.playerId);

        if (isStats) {
          resultShot = allShots.find((s) => s.id === shot.id) ?? shot;
          return {
            ...prev,
            shots: allShots,
          };
        }

        if (!isMiss) {
          const applied = applyFinskaScore(scoreBefore, params.score);
          shot.scoreAfter = applied.newScore;
          scoreEvent = applied.event;
          newScore = applied.newScore;
        } else {
          scoreEvent = 'normal';
          newScore = scoreBefore;
        }

        resultShot = allShots.find((s) => s.id === shot.id) ?? shot;
        const state = recomputeGameState(game, allShots);

        if (state.endReason === 'three_misses') {
          scoreEvent = 'miss_loss';
        } else if (state.endReason === 'win_50') {
          scoreEvent = 'win';
        } else if (!isMiss) {
          const applied = applyFinskaScore(scoreBefore, params.score);
          if (applied.event === 'bust') scoreEvent = 'bust';
        }

        missStreak = state.missStreaks[team.id] ?? 0;

        const updatedGame: Game = {
          ...game,
          scores: state.scores,
          eliminatedTeamIds: state.eliminatedTeamIds,
          winnerTeamId: state.winnerTeamId,
          endedAt: state.isEnded ? new Date().toISOString() : null,
        };

        return {
          ...prev,
          shots: allShots,
          games: prev.games.map((g) => (g.id === params.gameId ? updatedGame : g)),
        };
      });

      return { shot: resultShot, event: scoreEvent, newScore, missStreak, nextPlayerId };
    },
    [update],
  );

  const undoLastShot = useCallback((gameId: string) => {
    update((prev) => {
      const game = prev.games.find((g) => g.id === gameId);
      if (!game) return prev;

      const gameShots = prev.shots
        .filter((s) => s.gameId === gameId)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      const last = gameShots[0];
      if (!last) return prev;

      const remainingShots = prev.shots.filter((s) => s.id !== last.id);

      if (game.mode === 'stats') {
        return {
          ...prev,
          shots: replaceGameShots(remainingShots, gameId, remainingShots.filter((s) => s.gameId === gameId)),
        };
      }

      const state = recomputeGameState(
        { ...game, eliminatedTeamIds: [], winnerTeamId: null, endedAt: null },
        remainingShots,
      );

      return {
        ...prev,
        shots: replaceGameShots(remainingShots, gameId, remainingShots.filter((s) => s.gameId === gameId)),
        games: prev.games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                scores: state.scores,
                eliminatedTeamIds: state.eliminatedTeamIds,
                winnerTeamId: state.winnerTeamId,
                endedAt: state.isEnded ? g.endedAt : null,
              }
            : g,
        ),
      };
    });
  }, [update]);

  const updateShot = useCallback(
    (
      shotId: string,
      patch: Pick<Shot, 'distance' | 'score' | 'outcome'> & { shotType: SelectableShotType },
    ) => {
      update((prev) => {
        const target = prev.shots.find((s) => s.id === shotId);
        if (!target) return prev;

        const game = prev.games.find((g) => g.id === target.gameId);
        if (!game || game.endedAt) return prev;

        const untouchedShots = prev.shots.filter((s) => s.gameId !== game.id);
        const gameShots = prev.shots.filter((s) => s.gameId === game.id);
        const patchedShots = gameShots.map((s) =>
          s.id === shotId ? { ...s, ...patch } : s,
        );

        if (game.mode === 'stats') {
          return {
            ...prev,
            shots: replaceGameShots(
              [...untouchedShots, ...patchedShots],
              game.id,
              patchedShots,
            ),
          };
        }

        const recalculatedShots = recalculateShotScores(game, patchedShots);
        const normalizedShots = replaceGameShots(
          [...untouchedShots, ...recalculatedShots],
          game.id,
          recalculatedShots,
        );
        const state = recomputeGameState(game, recalculatedShots);

        const updatedGame: Game = {
          ...game,
          scores: state.scores,
          eliminatedTeamIds: state.eliminatedTeamIds,
          winnerTeamId: state.winnerTeamId,
          endedAt: state.isEnded ? game.endedAt ?? new Date().toISOString() : null,
        };

        return {
          ...prev,
          shots: normalizedShots,
          games: prev.games.map((g) => (g.id === game.id ? updatedGame : g)),
        };
      });
    },
    [update],
  );

  const resetToImportedLog = useCallback(async () => {
    clearLocalAppData();
    const imported = await importBundledMolkkyLog(
      { players: [], matches: [], games: [], shots: [] },
      { freshImport: true },
    );
    setImportDataVersion(IMPORT_DATA_VERSION);
    setData(imported.data);
    return imported.message;
  }, []);

  const importCsvLog = useCallback((csvText: string) => {
    let resultMessage = '';
    update((prev) => {
      const result = importLogCsv(csvText, prev);
      resultMessage = result.message;
      return result.data;
    });
    return resultMessage;
  }, [update]);

  return {
    data,
    addPlayer,
    removePlayer,
    startGame,
    startMatchGame,
    endMatch,
    startStatsSession,
    endStatsSession,
    endGame,
    abandonGame,
    logShot,
    undoLastShot,
    updateShot,
    importCsvLog,
    resetToImportedLog,
    syncStatus,
  };
}
