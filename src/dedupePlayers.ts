import type { AppData, Game, Match, Player, Shot, Team } from './types';

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

function shotCountForPlayer(playerId: string, shots: Shot[]): number {
  return shots.filter((s) => s.playerId === playerId).length;
}

function resolveId(id: string, remap: Map<string, string>): string {
  let current = id;
  const seen = new Set<string>();
  while (remap.has(current) && !seen.has(current)) {
    seen.add(current);
    current = remap.get(current)!;
  }
  return current;
}

function pickCanonicalPlayer(players: Player[], shots: Shot[]): Player {
  return players.reduce((best, player) => {
    const bestShots = shotCountForPlayer(best.id, shots);
    const playerShots = shotCountForPlayer(player.id, shots);
    if (playerShots > bestShots) return player;
    if (playerShots < bestShots) return best;
    return player.createdAt < best.createdAt ? player : best;
  });
}

function remapTeams(teams: Team[], remap: Map<string, string>): Team[] {
  const remapped: Team[] = [];

  for (const team of teams) {
    const playerIds = [...new Set(team.playerIds.map((id) => resolveId(id, remap)))];
    const teamId = resolveId(team.id, remap);

    const existing = remapped.find((t) => t.id === teamId);
    if (existing) {
      existing.playerIds = [...new Set([...existing.playerIds, ...playerIds])];
      if (!existing.name && team.name) existing.name = team.name;
      continue;
    }

    remapped.push({
      ...team,
      id: teamId,
      playerIds,
    });
  }

  return remapped;
}

function remapScores(
  scores: Record<string, number>,
  remap: Map<string, string>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(scores)) {
    const resolved = resolveId(key, remap);
    next[resolved] = (next[resolved] ?? 0) + value;
  }
  return next;
}

function remapPlayerOrder(
  playerOrder: Record<string, string[]>,
  remap: Map<string, string>,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [teamId, order] of Object.entries(playerOrder)) {
    const resolvedTeamId = resolveId(teamId, remap);
    const resolvedOrder = [...new Set(order.map((id) => resolveId(id, remap)))];
    next[resolvedTeamId] = [...new Set([...(next[resolvedTeamId] ?? []), ...resolvedOrder])];
  }
  return next;
}

function remapGame(game: Game, remap: Map<string, string>): Game {
  const teams = remapTeams(game.teams, remap);
  const throwOrder = game.throwOrder
    ? [...new Set(game.throwOrder.map((id) => resolveId(id, remap)))]
    : undefined;

  return {
    ...game,
    teams,
    throwOrder,
    scores: remapScores(game.scores, remap),
    eliminatedTeamIds: [...new Set(game.eliminatedTeamIds.map((id) => resolveId(id, remap)))],
    winnerTeamId: game.winnerTeamId ? resolveId(game.winnerTeamId, remap) : null,
  };
}

function remapMatch(match: Match, remap: Map<string, string>): Match {
  return {
    ...match,
    teams: remapTeams(match.teams, remap),
    teamOrder: [...new Set(match.teamOrder.map((id) => resolveId(id, remap)))],
    playerOrder: remapPlayerOrder(match.playerOrder, remap),
  };
}

/** Merge players that share the same name (case-insensitive) into one canonical id. */
export function dedupePlayersByName(data: AppData): {
  data: AppData;
  droppedPlayerIds: string[];
} {
  const byName = new Map<string, Player[]>();
  for (const player of data.players) {
    const key = normalizePlayerName(player.name);
    if (!key) continue;
    const group = byName.get(key) ?? [];
    group.push(player);
    byName.set(key, group);
  }

  const remap = new Map<string, string>();
  const keepIds = new Set<string>();

  for (const group of byName.values()) {
    if (group.length === 1) {
      keepIds.add(group[0]!.id);
      continue;
    }
    const canonical = pickCanonicalPlayer(group, data.shots);
    keepIds.add(canonical.id);
    for (const player of group) {
      if (player.id !== canonical.id) {
        remap.set(player.id, canonical.id);
      }
    }
  }

  if (remap.size === 0) {
    return { data, droppedPlayerIds: [] };
  }

  const players = data.players.filter((p) => keepIds.has(p.id));
  const shots = data.shots.map((shot) => ({
    ...shot,
    playerId: resolveId(shot.playerId, remap),
    teamId: resolveId(shot.teamId, remap),
  }));
  const games = data.games.map((game) => remapGame(game, remap));
  const matches = data.matches.map((match) => remapMatch(match, remap));

  return {
    data: { players, matches, games, shots },
    droppedPlayerIds: [...remap.keys()],
  };
}
