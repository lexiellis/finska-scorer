import { useCallback, useEffect, useState } from 'react';
import { applyFinskaScore } from '../scoring';
import {
  createId,
  isRemoteStorageConfigured,
  loadData,
  loadRemoteData,
  saveData,
} from '../storage';
import {
  getTeamForPlayer,
  isMissOutcome,
  recomputeGameState,
} from '../teams';
import type { AppData, Distance, Game, Outcome, Player, Shot, ShotType, Team } from '../types';

function recalculateShotScores(game: Game, shots: Shot[]): Shot[] {
  const ordered = [...shots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const scores = Object.fromEntries(game.teams.map((t) => [t.id, 0]));

  return ordered.map((shot) => {
    const scoreBefore = scores[shot.teamId] ?? 0;
    let scoreAfter = scoreBefore;

    if (!isMissOutcome(shot.outcome, shot.score)) {
      const applied = applyFinskaScore(scoreBefore, shot.score);
      scoreAfter = applied.newScore;
    }

    scores[shot.teamId] = scoreAfter;
    return { ...shot, scoreBefore, scoreAfter };
  });
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData);
  const [isHydrated, setIsHydrated] = useState(() => !isRemoteStorageConfigured());

  useEffect(() => {
    let isCancelled = false;
    if (!isRemoteStorageConfigured()) return;

    async function hydrateFromSharedState() {
      const remoteData = await loadRemoteData();
      if (isCancelled) return;
      if (remoteData) {
        setData(remoteData);
      }
      setIsHydrated(true);
    }

    void hydrateFromSharedState();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void saveData(data);
  }, [data, isHydrated]);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData((prev) => fn(prev));
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

  const startGame = useCallback((teams: Team[]) => {
    if (teams.length < 2 || teams.some((t) => t.playerIds.length < 1)) return null;
    const scores = Object.fromEntries(teams.map((t) => [t.id, 0]));
    const game: Game = {
      id: createId(),
      mode: 'game',
      teams,
      scores,
      eliminatedTeamIds: [],
      winnerTeamId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    update((prev) => ({ ...prev, games: [...prev.games, game] }));
    return game;
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
    update((prev) => ({
      ...prev,
      games: prev.games.filter((g) => g.id !== gameId),
      shots: prev.shots.filter((s) => s.gameId !== gameId),
    }));
  }, [update]);

  const logShot = useCallback(
    (params: {
      gameId: string;
      playerId: string;
      shotType: ShotType;
      distance: Distance;
      score: number;
      outcome: Outcome;
    }) => {
      let resultShot: Shot | null = null;
      let scoreEvent: ReturnType<typeof applyFinskaScore>['event'] | 'miss_loss' = 'normal';
      let newScore: number | null = null;
      let missStreak = 0;

      update((prev) => {
        const game = prev.games.find((g) => g.id === params.gameId);
        if (!game || game.endedAt) return prev;

        const team = getTeamForPlayer(game, params.playerId);
        if (!team) return prev;

        const scoreBefore = game.scores[team.id] ?? 0;
        const isMiss = params.score === 0;

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
          scoreAfter: isMiss ? scoreBefore : scoreBefore,
        };

        if (!isMiss) {
          const applied = applyFinskaScore(scoreBefore, params.score);
          shot.scoreAfter = applied.newScore;
          scoreEvent = applied.event;
          newScore = applied.newScore;
        } else {
          scoreEvent = 'normal';
          newScore = scoreBefore;
        }

        resultShot = shot;
        const allShots = [...prev.shots, shot];
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

      return { shot: resultShot, event: scoreEvent, newScore, missStreak };
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
      const state = recomputeGameState(
        { ...game, eliminatedTeamIds: [], winnerTeamId: null, endedAt: null },
        remainingShots,
      );

      return {
        ...prev,
        shots: remainingShots,
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
      patch: Pick<Shot, 'shotType' | 'distance' | 'score' | 'outcome'>,
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
        const recalculatedShots = recalculateShotScores(game, patchedShots);
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
          shots: [...untouchedShots, ...recalculatedShots],
          games: prev.games.map((g) => (g.id === game.id ? updatedGame : g)),
        };
      });
    },
    [update],
  );

  return {
    data,
    addPlayer,
    removePlayer,
    startGame,
    endGame,
    abandonGame,
    logShot,
    undoLastShot,
    updateShot,
  };
}
