import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { FINSKA_TARGET } from '../scoring';
import { getOutcomeIcon, OUTCOME_BUTTON_LABELS } from '../outcomeDisplay';
import { isHitShot } from '../stats';
import { getGameShots, isStatsSession, teamDisplayName } from '../teams';
import type { AppData, Distance, Game, Outcome, Shot, ShotType } from '../types';
import { DISTANCES, OUTCOMES, SHOT_TYPES } from '../types';

interface ScoreBoardProps {
  game: Game;
  players: AppData['players'];
  shots: Shot[];
  activePlayerId: string | null;
  mode: 'compact' | 'expanded';
  scoreTravel?: number;
  onUpdateShot?: (
    shotId: string,
    patch: { shotType: ShotType; distance: Distance; score: number; outcome: Outcome },
  ) => void;
}

function getUpcomingPlayerForTeam(teamShots: Shot[], team: { playerIds: string[] }): string | null {
  const playerIndex = teamShots.length % team.playerIds.length;
  return team.playerIds[playerIndex] ?? null;
}

function formatPins(score: number | null): string {
  if (score === null) return '—';
  if (score === 0) return '·';
  return String(score);
}

function teamBubbleClass(isActive: boolean, eliminated: boolean, total: number): string {
  return [
    'score-bubble',
    isActive ? 'active' : '',
    eliminated ? 'out' : '',
    total === FINSKA_TARGET ? 'at-target' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function ShotInfoCell({
  shot,
  isMiss,
  isBust,
}: {
  shot: { shotType: string; distance: Distance; outcome: Outcome };
  isMiss: boolean;
  isBust: boolean;
}) {
  return (
    <div className="history-symbol-cell">
      <div className="history-line">
        <span className="history-ico">🎯</span>
        <span className="history-val">{shot.shotType}</span>
      </div>
      <div className="history-line">
        <span className="history-ico">📏</span>
        <span className="history-val">
          {typeof shot.distance === 'string' ? shot.distance : `${shot.distance}m`}
        </span>
      </div>
      <div className="history-line">
        <span className="history-ico outcome-icon" aria-hidden>
          {getOutcomeIcon(shot.outcome)}
        </span>
        <span
          className={['history-val', isMiss ? 'miss' : '', isBust ? 'bust' : ''].filter(Boolean).join(' ')}
        >
          {shot.outcome}
        </span>
      </div>
    </div>
  );
}

function ShotEditForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: { shotType: ShotType; distance: Distance; score: number; outcome: Outcome };
  setDraft: Dispatch<
    SetStateAction<{
      shotType: ShotType;
      distance: Distance;
      score: number;
      outcome: Outcome;
    } | null>
  >;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isDistanceLocked = draft.shotType === '12 Break';

  return (
    <div className="history-edit-grid" onClick={(e) => e.stopPropagation()}>
      <select
        className="history-input"
        value={draft.shotType}
        onChange={(e) =>
          setDraft((prev) =>
            prev
              ? {
                  ...prev,
                  shotType: e.target.value as ShotType,
                  distance: e.target.value === '12 Break' ? 3 : prev.distance,
                }
              : prev,
          )
        }
      >
        {SHOT_TYPES.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <select
        className="history-input"
        value={String(draft.distance)}
        disabled={isDistanceLocked}
        onChange={(e) =>
          setDraft((prev) => {
            if (!prev) return prev;
            const next = e.target.value.endsWith('+')
              ? (e.target.value as Distance)
              : (Number(e.target.value) as Distance);
            return { ...prev, distance: next };
          })
        }
      >
        {DISTANCES.map((v) => (
          <option key={String(v)} value={String(v)}>
            {typeof v === 'string' ? v : `${v}m`}
          </option>
        ))}
      </select>
      <input
        className="history-input history-input-score"
        type="number"
        min={0}
        max={12}
        value={draft.score}
        onChange={(e) =>
          setDraft((prev) =>
            prev
              ? {
                  ...prev,
                  score: Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value),
                }
              : prev,
          )
        }
      />
      <select
        className="history-input"
        value={draft.outcome}
        onChange={(e) =>
          setDraft((prev) => (prev ? { ...prev, outcome: e.target.value as Outcome } : prev))
        }
      >
        {OUTCOMES.map((v) => (
          <option key={v} value={v}>
            {OUTCOME_BUTTON_LABELS[v]}
          </option>
        ))}
      </select>
      <div className="history-actions">
        <button type="button" className="history-btn" onClick={onSave}>
          Save
        </button>
        <button type="button" className="history-btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ScoreBoard({
  game,
  players,
  shots,
  activePlayerId,
  mode,
  onUpdateShot,
}: ScoreBoardProps) {
  const throws = useMemo(() => getGameShots(game, shots), [game, shots]);

  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    shotType: ShotType;
    distance: Distance;
    score: number;
    outcome: Outcome;
  } | null>(null);

  const teamShots = useMemo(
    () => game.teams.map((team) => throws.filter((s) => s.teamId === team.id)),
    [game.teams, throws],
  );
  const rowCount = Math.max(0, ...teamShots.map((rows) => rows.length));

  const isStats = isStatsSession(game);

  const teamMeta = game.teams.map((team, teamIndex) => {
    const total = game.scores[team.id] ?? 0;
    const eliminated = game.eliminatedTeamIds.includes(team.id);
    const teamThrowList = teamShots[teamIndex] ?? [];
    const throwCount = teamThrowList.length;
    const upcomingId = eliminated ? null : getUpcomingPlayerForTeam(teamThrowList, team);
    const isActive = upcomingId !== null && activePlayerId === upcomingId;

    return {
      team,
      total,
      throwCount,
      eliminated,
      isActive,
      teamThrowList,
      name: teamDisplayName(team, players),
    };
  });

  if (mode === 'compact') {
    return (
      <div className="score-header">
        <div className="score-bubbles">
          {teamMeta.map(({ team, total, throwCount, eliminated, isActive, name }) => (
            <div
              key={team.id}
              className={teamBubbleClass(isActive, eliminated, isStats ? 0 : total)}
            >
              <span className="score-bubble-name">
                {isActive && (
                  <span className="score-bubble-status-icon" aria-hidden>
                    🎯
                  </span>
                )}
                {name}
              </span>
              <span className="score-bubble-total">
                {isStats ? throwCount : total}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (throws.length === 0) {
    return (
      <div className="score-board-expanded score-board-expanded--empty">
        <p className="empty-state">No shots logged yet.</p>
      </div>
    );
  }

  return (
    <div className="score-board-expanded">
      <div className="score-board-expanded-layout">
        <div className="score-board-row-gutter">
          <span className="score-board-gutter-head" aria-hidden />
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <span key={rowIndex} className="score-board-gutter-row">
              {rowIndex + 1}
            </span>
          ))}
          <span className="score-board-gutter-foot" aria-hidden />
        </div>

        <div className="score-bubbles score-bubbles--expanded">
          {teamMeta.map(({ team, total, eliminated, isActive, name, teamThrowList }) => (
            <div
              key={team.id}
              className={`${teamBubbleClass(isActive, eliminated, total)} score-bubble--column`}
            >
              <div className="score-bubble-column-head">
                <span className="score-bubble-name">
                  {isActive && (
                    <span className="score-bubble-status-icon" aria-hidden>
                      🎯
                    </span>
                  )}
                  {name}
                </span>
              </div>

              <div className="score-bubble-column-rows">
                {Array.from({ length: rowCount }, (_, rowIndex) => {
                  const shot = teamThrowList[rowIndex];
                  if (!shot) {
                    return (
                      <div key={rowIndex} className="score-bubble-row score-bubble-row--empty">
                        <span>—</span>
                        <span>—</span>
                        <span>—</span>
                      </div>
                    );
                  }

                  const isMiss = !isHitShot(shot);
                  const isBust =
                    !isStats &&
                    !isMiss &&
                    shot.score !== null &&
                    shot.scoreBefore + shot.score > FINSKA_TARGET;
                  const isEditing = editingShotId === shot.id && draft !== null;

                  const startEdit = () => {
                    if (!onUpdateShot || editingShotId === shot.id) return;
                    setEditingShotId(shot.id);
                    setDraft({
                      shotType: shot.shotType,
                      distance: shot.distance,
                      score: shot.score ?? 0,
                      outcome: shot.outcome,
                    });
                  };

                  const saveEdit = () => {
                    if (!draft || !onUpdateShot) return;
                    const score = Math.max(0, Math.min(12, Math.round(draft.score)));
                    onUpdateShot(shot.id, { ...draft, score });
                    setEditingShotId(null);
                    setDraft(null);
                  };

                  const cancelEdit = () => {
                    setEditingShotId(null);
                    setDraft(null);
                  };

                  if (isEditing && draft) {
                    return (
                      <div
                        key={shot.id}
                        className="score-bubble-row score-bubble-row--editing"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ShotEditForm
                          draft={draft}
                          setDraft={setDraft}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                        />
                      </div>
                    );
                  }

                  const scoreClass = [isMiss ? 'miss' : '', isBust ? 'bust' : '']
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div key={shot.id} className="score-bubble-row" onClick={startEdit}>
                      <div className={`score-bubble-row-total ${scoreClass}`}>
                        {isStats
                          ? shot.score === null
                            ? '—'
                            : shot.score
                          : shot.scoreAfter}
                      </div>
                      <div className={`score-bubble-row-throw ${scoreClass}`}>
                        {formatPins(shot.score)}
                      </div>
                      <div className="score-bubble-row-shot">
                        <ShotInfoCell shot={shot} isMiss={isMiss} isBust={isBust} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
