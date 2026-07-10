import { useState } from 'react';
import { teamDisplayName } from '../teams';
import type { Player, Team } from '../types';

interface OrderSetupProps {
  teams: Team[];
  players: Player[];
  gameNumber: number;
  initialTeamOrder: string[];
  initialPlayerOrder: Record<string, string[]>;
  startingTeamId: string;
  startingTeamHint?: string;
  onConfirm: (teamOrder: string[], playerOrder: Record<string, string[]>) => void;
  onCancel?: () => void;
}

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const next = [...list];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function OrderSetup({
  teams,
  players,
  gameNumber,
  initialTeamOrder,
  initialPlayerOrder,
  startingTeamId,
  startingTeamHint,
  onConfirm,
  onCancel,
}: OrderSetupProps) {
  const [teamOrder, setTeamOrder] = useState(initialTeamOrder);
  const [playerOrder, setPlayerOrder] = useState(initialPlayerOrder);

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const effectiveStarter =
    gameNumber === 1 && !startingTeamHint ? teamOrder[0]! : startingTeamId;
  const starterName = teamDisplayName(teamById[effectiveStarter]!, players);

  return (
    <section className="order-setup">
      <h3 className="field-label">Game {gameNumber} — throw order</h3>
      <p className="order-setup-hint">
        Teams alternate each throw; players alternate within each team.
        {startingTeamHint ?? ` ${starterName} throws first.`}
      </p>

      <ol className="order-setup-teams">
        {teamOrder.map((teamId, teamIndex) => {
          const team = teamById[teamId];
          if (!team) return null;
          const rotation = playerOrder[teamId] ?? team.playerIds;
          const throwsFirst = teamId === effectiveStarter;

          return (
            <li key={teamId} className="order-setup-team">
              <div className="order-setup-team-head">
                <span className="order-setup-team-name">
                  {throwsFirst && <span className="order-setup-first" aria-hidden>🫴 </span>}
                  {teamDisplayName(team, players)}
                </span>
                <span className="order-setup-team-actions">
                  <button
                    type="button"
                    className="btn-icon order-move-btn"
                    disabled={teamIndex === 0}
                    onClick={() => setTeamOrder((o) => moveItem(o, teamIndex, -1))}
                    aria-label="Move team up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-icon order-move-btn"
                    disabled={teamIndex === teamOrder.length - 1}
                    onClick={() => setTeamOrder((o) => moveItem(o, teamIndex, 1))}
                    aria-label="Move team down"
                  >
                    ↓
                  </button>
                </span>
              </div>
              <ul className="order-setup-players">
                {rotation.map((playerId, playerIndex) => {
                  const player = players.find((p) => p.id === playerId);
                  if (!player) return null;
                  return (
                    <li key={playerId} className="order-setup-player">
                      <span>{player.name}</span>
                      {rotation.length > 1 && (
                        <span className="order-setup-player-actions">
                          <button
                            type="button"
                            className="btn-icon order-move-btn order-move-btn--sm"
                            disabled={playerIndex === 0}
                            onClick={() =>
                              setPlayerOrder((po) => ({
                                ...po,
                                [teamId]: moveItem(po[teamId] ?? team.playerIds, playerIndex, -1),
                              }))
                            }
                            aria-label={`Move ${player.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn-icon order-move-btn order-move-btn--sm"
                            disabled={playerIndex === rotation.length - 1}
                            onClick={() =>
                              setPlayerOrder((po) => ({
                                ...po,
                                [teamId]: moveItem(po[teamId] ?? team.playerIds, playerIndex, 1),
                              }))
                            }
                            aria-label={`Move ${player.name} down`}
                          >
                            ↓
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="order-setup-actions">
        {onCancel && (
          <button type="button" className="btn secondary large" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn primary large"
          onClick={() => onConfirm(teamOrder, playerOrder)}
        >
          Start game {gameNumber}
        </button>
      </div>
    </section>
  );
}
