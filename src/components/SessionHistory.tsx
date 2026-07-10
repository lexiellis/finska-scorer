import { useEffect, useState } from 'react';
import {
  formatSessionDate,
  formatSessionLabel,
  getEndedSessions,
  getGameShots,
} from '../stats';
import { isStatsSession } from '../teams';
import type { AppData, Distance, Game, Outcome, ShotType } from '../types';
import { ScoreBoard } from './ScoreBoard';

interface SessionHistoryProps {
  data: AppData;
  onDetailOpenChange?: (open: boolean) => void;
  onUpdateShot?: (
    shotId: string,
    patch: { shotType: ShotType; distance: Distance; score: number; outcome: Outcome },
  ) => void;
}

export function SessionHistory({ data, onDetailOpenChange, onUpdateShot }: SessionHistoryProps) {
  const sessions = getEndedSessions(data).filter(
    (g) => getGameShots(data, g.id).length > 0,
  );
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    onDetailOpenChange?.(openId !== null);
  }, [openId, onDetailOpenChange]);

  if (sessions.length === 0) return null;

  const openSession = openId ? data.games.find((g) => g.id === openId) : null;

  if (openSession) {
    const shots = getGameShots(data, openSession.id);
    return (
      <section className="session-history session-history--detail">
        <div className="session-history-detail-head">
          <button
            type="button"
            className="btn ghost session-history-back"
            onClick={() => setOpenId(null)}
          >
            ← Sessions
          </button>
          <div className="session-history-detail-meta">
            <h3>{formatSessionLabel(openSession, data.players)}</h3>
            <p className="session-history-date">
              {formatSessionDate(openSession.endedAt ?? openSession.startedAt)}
              {' · '}
              {shots.length} throws
              {isStatsSession(openSession) ? ' · stats' : ' · game'}
            </p>
          </div>
        </div>
        <div className="session-history-board">
          <ScoreBoard
            game={openSession}
            players={data.players}
            shots={shots}
            activePlayerId={null}
            mode="expanded"
            onUpdateShot={onUpdateShot}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="session-history">
      <h3 className="field-label">Past sessions</h3>
      <ul className="session-history-list">
        {sessions.map((game: Game) => {
          const throwCount = getGameShots(data, game.id).length;
          return (
            <li key={game.id}>
              <button
                type="button"
                className="session-history-item"
                onClick={() => setOpenId(game.id)}
              >
                <span className="session-history-item-title">
                  {formatSessionLabel(game, data.players)}
                </span>
                <span className="session-history-item-meta">
                  {formatSessionDate(game.endedAt ?? game.startedAt)}
                  {' · '}
                  {throwCount} throws
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
