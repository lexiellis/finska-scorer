import { useState } from 'react';
import { createId } from '../storage';
import type { Player, Team } from '../types';

interface TeamDraft {
  id: string;
  playerIds: string[];
}

interface TeamSetupProps {
  players: Player[];
  onTeamsReady: (teams: Team[]) => void;
}

function defaultTeams(): TeamDraft[] {
  return [
    { id: createId(), playerIds: [] },
    { id: createId(), playerIds: [] },
  ];
}

export function TeamSetup({ players, onTeamsReady }: TeamSetupProps) {
  const [teams, setTeams] = useState<TeamDraft[]>(defaultTeams);

  const assignedIds = new Set(teams.flatMap((t) => t.playerIds));

  const addTeam = () => {
    setTeams((prev) => [...prev, { id: createId(), playerIds: [] }]);
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
        <h3 className="field-label">Game</h3>
        <button type="button" className="btn ghost" onClick={addTeam}>
          + Team
        </button>
      </div>

      {teams.map((team, index) => (
        <div key={team.id} className="team-card">
          <div className="team-card-header">
            <span className="field-label">Team {index + 1}</span>
            {teams.length > 2 && (
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => removeTeam(team.id)}
              >
                ×
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
        </div>
      ))}

      <button
        type="button"
        className="btn primary large"
        disabled={!canStart}
        onClick={() =>
          onTeamsReady(
            teams.map((t) => ({
              id: t.id,
              name: '',
              playerIds: t.playerIds,
            })),
          )
        }
      >
        Next — set throw order
      </button>
    </section>
  );
}
