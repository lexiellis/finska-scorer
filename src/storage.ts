import type { AppData } from './types';

const STORAGE_KEY = 'finska-scorer-data';

const emptyData = (): AppData => ({
  players: [],
  games: [],
  shots: [],
});

function migrate(data: AppData): AppData {
  return {
    ...data,
    games: data.games.map((g) => ({
      ...g,
      mode: g.mode ?? 'game',
    })),
    shots: data.shots.map((s) => ({
      ...s,
      scoreBefore: s.scoreBefore ?? 0,
      scoreAfter: s.scoreAfter ?? s.score,
    })),
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return migrate({ ...emptyData(), ...JSON.parse(raw) } as AppData);
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createId(): string {
  return crypto.randomUUID();
}
