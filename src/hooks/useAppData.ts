import { useCallback, useEffect, useState } from 'react';
import { applyFinskaScore } from '../scoring';
import { createId, loadData, saveData } from '../storage';
import {
  getTeamForPlayer,
  recomputeGameState,
} from '../teams';
import type { AppData, Distance, Game, Outcome, Player, Shot, ShotType, Team } from '../types';

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

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

  const startPractice = useCallback((playerId: string) => {
    const team: Team = {
      id: createId(),
      name: '',
      playerIds: [playerId],
    };
    const game: Game = {
      id: createId(),
      mode: 'practice',
      teams: [team],
      scores: { [team.id]: 0 },
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

  const endPractice = useCallback((gameId: string) => {
    update((prev) => ({
      ...prev,
      games: prev.games.map((g) =>
        g.id === gameId ? { ...g, endedAt: new Date().toISOString() } : g,
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

  const resetPracticeRound = useCallback((gameId: string) => {
    update((prev) => {
      const game = prev.games.find((g) => g.id === gameId);
      if (!game || game.mode !== 'practice') return prev;
      const teamId = game.teams[0]?.id;
      if (!teamId) return prev;
      const remainingShots = prev.shots.filter((s) => s.gameId !== gameId);
      const clearedGame: Game = {
        ...game,
        scores: { [teamId]: 0 },
        eliminatedTeamIds: [],
        winnerTeamId: null,
        endedAt: null,
      };
      return {
        ...prev,
        shots: remainingShots,
        games: prev.games.map((g) => (g.id === gameId ? clearedGame : g)),
      };
    });
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
        const isMiss = params.outcome === 'Miss';

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

  return {
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
  };
}
