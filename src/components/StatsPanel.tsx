import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { computePlayerStats, getPlayerThrowCount } from '../stats';
import type { AppData } from '../types';
import { OUTCOMES, SHOT_TYPES } from '../types';
import { getOutcomeIcon } from '../outcomeDisplay';

interface StatsPanelProps {
  data: AppData;
}

function heatmapCellClass(rate: number | null): string {
  if (rate === null) return 'heatmap-cell heatmap-cell--empty';
  if (rate >= 80) return 'heatmap-cell heatmap-cell--high';
  if (rate >= 50) return 'heatmap-cell heatmap-cell--mid';
  return 'heatmap-cell heatmap-cell--low';
}

const CHART = {
  grid: '#ebe8e2',
  primary: '#3d5c4a',
  secondary: '#6d8f78',
  tertiary: '#9bb5a4',
} as const;

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${Math.round(rate)}%`;
}

export function StatsPanel({ data }: StatsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    data.players[0]?.id ?? null,
  );

  useEffect(() => {
    if (selectedId && !data.players.some((p) => p.id === selectedId)) {
      setSelectedId(data.players[0]?.id ?? null);
    }
  }, [data.players, selectedId]);

  if (data.players.length === 0) {
    return (
      <div className="panel">
        <p className="empty-state">Add players and log shots to see stats and graphs.</p>
      </div>
    );
  }

  const stats = selectedId ? computePlayerStats(data, selectedId) : null;

  const overview = data.players.map((p) => {
    const s = computePlayerStats(data, p.id)!;
    return {
      name: p.name,
      throws: s.totalShots,
      hitRate: Math.round(s.hitRate),
      avgScore: Number(s.avgScorePerShot.toFixed(1)),
    };
  });

  const shotTypeData = stats
    ? SHOT_TYPES.map((t) => ({ name: t, count: stats.shotTypeCounts[t] })).filter(
        (d) => d.count > 0,
      )
    : [];

  return (
    <div className="panel stats-panel">
      <header className="panel-header">
        <h2>Stats</h2>
      </header>

      <div className="player-chips">
        {data.players.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip ${selectedId === p.id ? 'selected' : ''}`}
            onClick={() => setSelectedId(p.id)}
          >
            {p.name}
            <span className="chip-score">{getPlayerThrowCount(data, p.id)}</span>
          </button>
        ))}
      </div>

      {overview.some((o) => o.throws > 0) && (
        <section className="chart-card">
          <h3>All players</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={overview} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="throws" name="Throws" fill={CHART.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="hitRate" name="Hit %" fill={CHART.secondary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {stats && stats.totalShots > 0 ? (
        <>
          <div className="stat-cards stat-cards--primary">
            <div className="stat-card">
              <span className="stat-value">{stats.totalShots}</span>
              <span className="stat-label">Throws</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.round(stats.hitRate)}%</span>
              <span className="stat-label">Hit rate</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.avgScorePerShot.toFixed(1)}</span>
              <span className="stat-label">Avg pins/throw</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.round(stats.twelveRate)}%</span>
              <span className="stat-label">12-pin rate</span>
            </div>
          </div>

          {stats.heatmapGrid.length > 0 && (
            <section className="chart-card">
              <h3>Hit rate by shot type &amp; distance</h3>
              <div className="heatmap-wrap">
                <table className="heatmap-table">
                  <thead>
                    <tr>
                      <th>Shot type</th>
                      {stats.heatmapGrid[0]?.cells.map((cell) => (
                        <th key={cell.distance}>
                          {cell.distance.endsWith('+') ? cell.distance : `${cell.distance}m`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.heatmapGrid.map((row) => (
                      <tr
                        key={row.shotType}
                        className={row.shotType === 'ALL SHOTS' ? 'heatmap-row--total' : ''}
                      >
                        <th scope="row">{row.shotType}</th>
                        {row.cells.map((cell) => (
                          <td key={cell.distance}>
                            <span
                              className={heatmapCellClass(cell.successRate)}
                              title={
                                cell.attempts > 0
                                  ? `${cell.attempts} throws`
                                  : 'No throws'
                              }
                            >
                              {formatRate(cell.successRate)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {stats.outcomeByShotType.length > 0 && (
            <section className="chart-card">
              <h3>Outcomes by shot type</h3>
              <div className="outcome-table-wrap">
                <table className="outcome-table">
                  <thead>
                    <tr>
                      <th>Shot type</th>
                      <th>Throws</th>
                      {OUTCOMES.map((o) => (
                        <th key={o}>
                          <span className="outcome-th">
                            {getOutcomeIcon(o)} {o}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.outcomeByShotType.map((row) => (
                      <tr key={row.shotType}>
                        <th scope="row">{row.shotType}</th>
                        <td>{row.throws}</td>
                        {OUTCOMES.map((o) => (
                          <td key={o}>
                            {row.throws > 0 && row.outcomeCounts[o] > 0
                              ? `${Math.round(row.outcomeRates[o] ?? 0)}%`
                              : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {shotTypeData.length > 0 && (
            <section className="chart-card">
              <h3>Shot types</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={shotTypeData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Throws" fill={CHART.tertiary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {stats.distanceBuckets.length > 0 && (
            <section className="chart-card">
              <h3>Distance</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.distanceBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Throws" fill={CHART.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {stats.gamesPlayed > 0 && (
            <section className="chart-card chart-card--secondary">
              <h3>Competitive games</h3>
              <div className="stat-cards stat-cards--compact">
                <div className="stat-card stat-card--muted">
                  <span className="stat-value">{stats.wins}</span>
                  <span className="stat-label">Wins</span>
                </div>
                <div className="stat-card stat-card--muted">
                  <span className="stat-value">{Math.round(stats.winRate)}%</span>
                  <span className="stat-label">Win rate</span>
                </div>
                <div className="stat-card stat-card--muted">
                  <span className="stat-value">{stats.gamesPlayed}</span>
                  <span className="stat-label">Games</span>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="empty-state">No shots logged for this player yet.</p>
      )}
    </div>
  );
}
