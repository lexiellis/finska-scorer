import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  computeAllPlayersStats,
  computePlayerStats,
  computeSessionPlayerStats,
  computeSessionStats,
  formatSessionLabel,
  getActiveGame,
  getGameShots,
  getPlayerThrowCount,
} from '../stats';
import { getGamePlayerIds } from '../teams';
import type { HeatmapCell } from '../stats';
import type { AppData, ShotType } from '../types';
import { OUTCOMES, ALL_SHOT_TYPES } from '../types';
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

type RateView = 'success' | 'soso';

type RateChartRow = {
  label?: string;
  name?: string;
  throws?: number;
  attempts?: number;
  successRate: number;
  sosoOnlyRate: number;
};

function RateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: RateChartRow }>;
  label?: string;
}): ReactNode {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const count = row.attempts ?? row.throws ?? 0;
  const heading = label ?? row.label ?? row.name ?? '';

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{heading}</p>
      <p className="chart-tooltip-throws">{count} throws</p>
      {payload.map((entry) => (
        <p key={String(entry.name)} className="chart-tooltip-rate">
          {entry.name}: {Math.round(Number(entry.value ?? 0))}%
        </p>
      ))}
    </div>
  );
}

function heatmapCellRate(cell: HeatmapCell, rateView: RateView): number | null {
  return rateView === 'success' ? cell.successRate : cell.sosoPlusRate;
}

function RateViewToggle({
  rateView,
  onChange,
}: {
  rateView: RateView;
  onChange: (view: RateView) => void;
}) {
  return (
    <div className="player-chips rate-view-chips rate-view-chips--inline">
      <button
        type="button"
        className={`chip ${rateView === 'success' ? 'selected' : ''}`}
        onClick={() => onChange('success')}
      >
        Success
      </button>
      <button
        type="button"
        className={`chip ${rateView === 'soso' ? 'selected' : ''}`}
        onClick={() => onChange('soso')}
      >
        Soso+
      </button>
    </div>
  );
}

function CountPctTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { count?: number; pct?: number } }>;
  label?: string;
}): ReactNode {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const count = row?.count ?? Number(payload[0]?.value ?? 0);
  const pct = row?.pct ?? 0;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-throws">
        {count} throws ({Math.round(pct)}%)
      </p>
    </div>
  );
}

function OutcomeRateBars({
  rateView,
  stackId = 'rates',
}: {
  rateView: RateView;
  stackId?: string;
}) {
  if (rateView === 'success') {
    return (
      <Bar
        dataKey="successRate"
        name="Intended"
        fill={CHART.secondary}
        radius={[4, 4, 0, 0]}
      />
    );
  }

  return (
    <>
      <Bar stackId={stackId} dataKey="sosoOnlyRate" name="So-so" fill={CHART.tertiary} />
      <Bar
        stackId={stackId}
        dataKey="successRate"
        name="Intended"
        fill={CHART.secondary}
        radius={[4, 4, 0, 0]}
      />
    </>
  );
}

function toRateRow(point: {
  label?: string;
  name?: string;
  attempts?: number;
  throws?: number;
  successRate: number | null;
  sosoOnlyRate: number | null;
}): RateChartRow {
  return {
    label: point.label,
    name: point.name,
    attempts: point.attempts,
    throws: point.throws,
    successRate: point.successRate ?? 0,
    sosoOnlyRate: point.sosoOnlyRate ?? 0,
  };
}

export function StatsPanel({ data }: StatsPanelProps) {
  const activeGame = getActiveGame(data);
  const sessionFilterId = activeGame ? `__session__:${activeGame.id}` : null;
  const [selectedId, setSelectedId] = useState<string | null>(sessionFilterId);
  const [selectedShotType, setSelectedShotType] = useState<ShotType | 'ALL'>('ALL');
  const [rateView, setRateView] = useState<RateView>('success');

  useEffect(() => {
    if (
      selectedId !== null &&
      !selectedId.startsWith('__session__:') &&
      !data.players.some((p) => p.id === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [data.players, selectedId]);

  const activeSessionShots = activeGame ? getGameShots(data, activeGame.id) : [];
  const sessionStats = useMemo(
    () => (activeGame ? computeSessionStats(data, activeGame.id) : null),
    [activeGame, data],
  );

  useEffect(() => {
    if (!activeGame && selectedId?.startsWith('__session__:')) {
      setSelectedId(null);
      return;
    }
    if (activeGame && selectedId?.startsWith('__session__:') && selectedId !== sessionFilterId) {
      setSelectedId(sessionFilterId);
    }
  }, [activeGame, selectedId, sessionFilterId]);

  const stats = useMemo(() => {
    if (data.players.length === 0) return null;
    if (selectedId?.startsWith('__session__:') && activeGame) {
      return computeSessionStats(data, activeGame.id);
    }
    return selectedId === null ? computeAllPlayersStats(data) : computePlayerStats(data, selectedId);
  }, [activeGame, data, selectedId]);

  const shotTypeFilters = stats?.distanceRatesByShotType ?? [];

  useEffect(() => {
    const filters = stats?.distanceRatesByShotType ?? [];
    if (!filters.some((s) => s.shotType === selectedShotType)) {
      setSelectedShotType(filters[0]?.shotType ?? 'ALL');
    }
  }, [stats, selectedShotType]);

  if (data.players.length === 0) {
    return (
      <div className="panel">
        <p className="empty-state">Add players and log shots to see stats and graphs.</p>
      </div>
    );
  }

  const distanceRateSeries =
    stats?.distanceRatesByShotType.find((s) => s.shotType === selectedShotType)?.points ?? [];

  const overview = data.players.map((p) => {
    const s = computePlayerStats(data, p.id)!;
    return toRateRow({
      name: p.name,
      throws: s.totalShots,
      successRate: s.successRate,
      sosoOnlyRate: s.sosoOnlyRate,
    });
  });

  const shotTypeData = stats
    ? ALL_SHOT_TYPES.map((t) => ({
        name: t,
        count: stats.shotTypeCounts[t],
        pct: stats.totalShots > 0 ? (stats.shotTypeCounts[t] / stats.totalShots) * 100 : 0,
      })).filter((d) => d.count > 0)
    : [];

  return (
    <div className="panel stats-panel">
      <header className="panel-header">
        <h2>Stats</h2>
      </header>

      {activeGame && sessionStats && sessionStats.totalShots > 0 && (
        <section className="chart-card chart-card--session">
          <h3>Current session</h3>
          <p className="session-stats-subtitle">
            {formatSessionLabel(activeGame, data.players)}
            {' · '}
            {activeSessionShots.length} throws logged
          </p>
          <div className="stat-cards stat-cards--primary">
            <div className="stat-card">
              <span className="stat-value">{sessionStats.totalShots}</span>
              <span className="stat-label">Throws</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.round(sessionStats.successRate)}%</span>
              <span className="stat-label">Success</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.round(sessionStats.sosoPlusRate)}%</span>
              <span className="stat-label">Soso+</span>
            </div>
          </div>
          <div className="player-chips session-player-chips">
            {getGamePlayerIds(activeGame).map((pid) => {
              const p = data.players.find((pl) => pl.id === pid);
              if (!p) return null;
              const ps = computeSessionPlayerStats(data, activeGame.id, pid);
              if (!ps || ps.totalShots === 0) return null;
              return (
                <span key={pid} className="chip session-chip-readonly">
                  {p.name}
                  <span className="chip-score">{ps.totalShots}</span>
                  <span className="chip-rate">{Math.round(ps.successRate)}%</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      <p className="stats-scope-label">
        {selectedId?.startsWith('__session__:') ? 'Current session' : 'All-time'}
      </p>

      <div className="player-chips">
        {activeGame && (
          <button
            type="button"
            className={`chip ${selectedId?.startsWith('__session__:') ? 'selected' : ''}`}
            onClick={() => setSelectedId(`__session__:${activeGame.id}`)}
          >
            Session
            <span className="chip-score">{activeSessionShots.length}</span>
          </button>
        )}
        <button
          type="button"
          className={`chip ${selectedId === null ? 'selected' : ''}`}
          onClick={() => setSelectedId(null)}
        >
          All
          <span className="chip-score">{data.shots.length}</span>
        </button>
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

      {selectedId === null && overview.some((o) => (o.throws ?? 0) > 0) && (
        <section className="chart-card">
          <div className="chart-card-head">
            <h3>All players</h3>
            <RateViewToggle rateView={rateView} onChange={setRateView} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={overview} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
              <Tooltip content={<RateTooltip />} />
              <OutcomeRateBars rateView={rateView} stackId="players" />
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
              <span className="stat-value">{Math.round(stats.successRate)}%</span>
              <span className="stat-label">Success rate</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.round(stats.sosoPlusRate)}%</span>
              <span className="stat-label">Soso+ rate</span>
            </div>
          </div>

          {shotTypeFilters.length > 0 && (
            <section className="chart-card">
              <div className="chart-card-head">
                <h3>Success by distance</h3>
                <RateViewToggle rateView={rateView} onChange={setRateView} />
              </div>
              <div className="player-chips shot-type-chips">
                {shotTypeFilters.map((entry) => (
                  <button
                    key={entry.shotType}
                    type="button"
                    className={`chip ${selectedShotType === entry.shotType ? 'selected' : ''}`}
                    onClick={() => setSelectedShotType(entry.shotType)}
                  >
                    {entry.shotType === 'ALL' ? 'All' : entry.shotType}
                    <span className="chip-score">
                      {entry.points.reduce((sum, p) => sum + p.attempts, 0)}
                    </span>
                  </button>
                ))}
              </div>
              {distanceRateSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={distanceRateSeries.map((point) =>
                      toRateRow({
                        label: point.label,
                        attempts: point.attempts,
                        successRate: point.successRate,
                        sosoOnlyRate: point.sosoOnlyRate,
                      }),
                    )}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip content={<RateTooltip />} />
                    <OutcomeRateBars rateView={rateView} stackId="distance" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-state">No throws for this shot type yet.</p>
              )}
            </section>
          )}

          {stats.heatmapGrid.length > 0 && (
            <section className="chart-card">
              <div className="chart-card-head">
                <h3>Success rate by shot type &amp; distance</h3>
                <RateViewToggle rateView={rateView} onChange={setRateView} />
              </div>
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
                        {row.cells.map((cell) => {
                          const rate = heatmapCellRate(cell, rateView);
                          return (
                            <td key={cell.distance}>
                              <span
                                className={heatmapCellClass(rate)}
                                title={
                                  cell.attempts > 0
                                    ? `${cell.attempts} throws`
                                    : 'No throws'
                                }
                              >
                                {formatRate(rate)}
                              </span>
                            </td>
                          );
                        })}
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
                <BarChart data={shotTypeData} layout="vertical" margin={{ left: 8, right: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip content={<CountPctTooltip />} />
                  <Bar dataKey="count" name="Throws" fill={CHART.tertiary} radius={[0, 4, 4, 0]}>
                    <LabelList
                      dataKey="pct"
                      position="right"
                      formatter={(value) => `${Math.round(Number(value ?? 0))}%`}
                      className="bar-pct-label"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {stats.distanceBuckets.length > 0 && (
            <section className="chart-card">
              <h3>
                Distance
                {stats.avgDistance !== null && (
                  <span className="chart-card-subtitle">
                    {' '}
                    · avg {stats.avgDistance.toFixed(1)}m
                  </span>
                )}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.distanceBuckets} margin={{ top: 16, right: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CountPctTooltip />} />
                  <Bar dataKey="count" name="Throws" fill={CHART.primary} radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="pct"
                      position="top"
                      formatter={(value) => `${Math.round(Number(value ?? 0))}%`}
                      className="bar-pct-label"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

        </>
      ) : (
        <p className="empty-state">No shots logged yet.</p>
      )}
    </div>
  );
}
