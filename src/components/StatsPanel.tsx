import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { computePlayerStats } from '../stats';
import type { AppData } from '../types';
import { OUTCOMES, SHOT_TYPES } from '../types';

const CHART_COLORS = [
  '#2d6a4f',
  '#40916c',
  '#52b788',
  '#74c69d',
  '#95d5b2',
  '#b7e4c7',
  '#d8f3dc',
  '#1b4332',
];

interface StatsPanelProps {
  data: AppData;
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
      winRate: Math.round(s.winRate),
      avgScore: Number(s.avgScorePerShot.toFixed(1)),
      shots: s.totalShots,
    };
  });

  const shotTypeData = stats
    ? SHOT_TYPES.map((t) => ({ name: t, count: stats.shotTypeCounts[t] })).filter(
        (d) => d.count > 0,
      )
    : [];

  const outcomeData = stats
    ? OUTCOMES.map((o) => ({ name: o, count: stats.outcomeCounts[o] })).filter(
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
          </button>
        ))}
      </div>

      {overview.some((o) => o.shots > 0) && (
        <section className="chart-card">
          <h3>All players overview</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={overview} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ede9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="winRate" name="Win %" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgScore" name="Avg score/shot" fill="#52b788" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {stats && stats.totalShots > 0 ? (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <span className="stat-value">{stats.wins}</span>
              <span className="stat-label">Wins</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.round(stats.winRate)}%</span>
              <span className="stat-label">Win rate</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.totalShots}</span>
              <span className="stat-label">Shots logged</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.avgScorePerShot.toFixed(1)}</span>
              <span className="stat-label">Avg pts/shot</span>
            </div>
          </div>

          <section className="chart-card">
            <h3>Score distribution (0–12)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ede9" />
                <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Shots" fill="#40916c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {stats.distanceBuckets.length > 0 && (
            <section className="chart-card">
              <h3>Distance</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.distanceBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ede9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Shots" fill="#1b4332" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {shotTypeData.length > 0 && (
            <section className="chart-card">
              <h3>Shot type</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={shotTypeData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {shotTypeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </section>
          )}

          {outcomeData.length > 0 && (
            <section className="chart-card">
              <h3>Outcome</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={outcomeData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ede9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Shots" fill="#52b788" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      ) : (
        <p className="empty-state">No shots logged for this player yet.</p>
      )}
    </div>
  );
}
