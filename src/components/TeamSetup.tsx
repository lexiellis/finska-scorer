import { useState } from 'react';
import { createId } from '../storage';
import type { Player, Team } from '../types';

export interface TeamDraft {
  id: string;
  name: string;
  playerIds: string[];
}

interface TeamSetupProps {
  players: Player[];
  onStart: (teams: Team[]) => void;
}

function defaultTeams(): TeamDraft[] {
  return [
    { id: createId(), name: 'Team 1', playerIds: [] },
    { id: createId(), name: 'Team 2', playerIds: [] },
  ];
}

export function TeamSetup({ players, onStart }: TeamSetupProps) {
  const [teams, setTeams] = useState<TeamDraft[]>(defaultTeams);

  const assignedIds = new Set(teams.flatMap((t) => t.playerIds));
  const unassigned = players.filter((p) => !assignedIds.has(p.id));

  const updateTeam = (id: string, patch: Partial<TeamDraft>) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addTeam = () => {
    setTeams((prev) => [
      ...prev,
      { id: createId(), name: `Team ${prev.length + 1}`, playerIds: [] },
    ]);
  };

  const removeTeam = (id: string) => {
    if (teams.length <= 2) return;
    setTeams((prev) => prev.filter((t) => t.id !== id));
  };

  const togglePlayerOnTeam = (teamId: string, playerId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          const has = t.playerIds.includes(playerId);
          return {
            ...t,
            playerIds: has
              ? t.playerIds.filter((p) => p !== playerId)
              : [...t.playerIds, playerId],
          };
        }
        return { ...t, playerIds: t.playerIds.filter((p) => p !== playerId) };
      }),
    );
  };

  const canStart =
    teams.length >= 2 &&
    teams.every((t) => t.playerIds.length >= 1) &&
    assignedIds.size >= 2;

  return (
    <section className="team-setup">
      <div className="team-setup-header">
        <h3 className="field-label">Teams</h3>
        <button type="button" className="btn ghost" onClick={addTeam}>
          + Add team
        </button>
      </div>
      <p className="section-hint">
        Assign each player to one team. Three team misses in a row eliminates that team.
      </p>

      {teams.map((team) => (
        <div key={team.id} className="team-card">
          <div className="team-card-header">
            <input
              type="text"
              className="text-input team-name-input"
              value={team.name}
              onChange={(e) => updateTeam(team.id, { name: e.target.value })}
              placeholder="Team name"
            />
            {teams.length > 2 && (
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => removeTeam(team.id)}
              >
                Remove
              </button>
            )}
          </div>
          <div className="player-chips">
            {players.map((p) => {
              const onThis = team.playerIds.includes(p.id);
              const onOther = !onThis && assignedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={onOther}
                  className={`chip ${onThis ? 'selected' : ''}`}
                  onClick={() => togglePlayerOnTeam(team.id, p.id)}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          {team.playerIds.length === 0 && (
            <p className="team-warning">Add at least one player to this team.</p>
          )}
        </div>
      ))}

      {unassigned.length > 0 && (
        <p className="section-hint unassigned-hint">
          Unassigned: {unassigned.map((p) => p.name).join(', ')}
        </p>
      )}

      <button
        type="button"
        className="btn primary large"
        disabled={!canStart}
        onClick={() =>
          onStart(
            teams.map((t) => ({
              id: t.id,
              name: t.name.trim() || `Team`,
              playerIds: t.playerIds,
            })),
          )
        }
      >
        Start game
      </button>
    </section>
  );
}
