# Finska Scorer

A touch-friendly web app for logging Finska throws on iPad (or any device). Track every shot per player, live game scores, win rates, and stats charts.

## Features

- **Shot logging**: shot type, distance (3–12+ m), score (0–12), outcome
- **Live scores** during a game
- **Player management** with persistent local storage
- **Stats & graphs**: win %, score distribution, distance, shot types, outcomes

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Use on iPad

1. Run the dev server on your PC, or build and host the app (`npm run build` then serve `dist/`).
2. On iPad Safari, open the app URL.
3. Tap **Share → Add to Home Screen** for a full-screen app-like experience.

Data is stored in the browser on that device (no account or server required).

## Shot fields

| Field | Options |
|-------|---------|
| Shot type | Standard, Retro, Elephant, Kick, Puikula, Bunch, Tuck, Crowd |
| Distance | 3–12 m, 12+ |
| Score | 0–12 (tap a circle) |
| Outcome | Intended, So-so, Unintended, Miss, Wrong pin, Collateral |
