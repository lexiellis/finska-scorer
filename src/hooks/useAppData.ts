import { useCallback, useEffect, useState } from 'react';
import { createId, loadData, saveData } from '../storage';
import type { AppData, Distance, Game, Outcome, Player, Shot, ShotType } from '../types';

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

  const startGame = useCallback((playerIds: string[]) => {
    if (playerIds.length < 2) return null;
    const scores = Object.fromEntries(playerIds.map((id) => [id, 0]));
    const game: Game = {
      id: createId(),
      playerIds,
      scores,
      winnerId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    update((prev) => ({ ...prev, games: [...prev.games, game] }));
    return game;
  }, [update]);

  const endGame = useCallback((gameId: string, winnerId: string) => {
    update((prev) => ({
      ...prev,
      games: prev.games.map((g) =>
        g.id === gameId
          ? { ...g, winnerId, endedAt: new Date().toISOString() }
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
      const shot: Shot = {
        id: createId(),
        gameId: params.gameId,
        playerId: params.playerId,
        shotType: params.shotType,
        distance: params.distance,
        score: params.score,
        outcome: params.outcome,
        recordedAt: new Date().toISOString(),
      };
      update((prev) => {
        const game = prev.games.find((g) => g.id === params.gameId);
        if (!game || game.endedAt) return prev;
        const newScore = (game.scores[params.playerId] ?? 0) + params.score;
        return {
          ...prev,
          shots: [...prev.shots, shot],
          games: prev.games.map((g) =>
            g.id === params.gameId
              ? {
                  ...g,
                  scores: { ...g.scores, [params.playerId]: newScore },
                }
              : g,
          ),
        };
      });
      return shot;
    },
    [update],
  );

  const undoLastShot = useCallback((gameId: string) => {
    update((prev) => {
      const gameShots = prev.shots
        .filter((s) => s.gameId === gameId)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      const last = gameShots[0];
      if (!last) return prev;
      const game = prev.games.find((g) => g.id === gameId);
      if (!game) return prev;
      const newScore = Math.max(0, (game.scores[last.playerId] ?? 0) - last.score);
      return {
        ...prev,
        shots: prev.shots.filter((s) => s.id !== last.id),
        games: prev.games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                scores: { ...g.scores, [last.playerId]: newScore },
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
    endGame,
    abandonGame,
    logShot,
    undoLastShot,
  };
}
