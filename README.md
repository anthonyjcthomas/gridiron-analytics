# Gridiron Analytics 🏈📊

Gridiron Analytics is a full-stack NFL analytics project that pulls **2024 play‑by‑play data**, builds team‑level tendencies, and serves them through a **FastAPI backend** and a **React Native (Expo) app** that runs on web, iOS, and Android.

Current focus: **offensive run vs pass tendencies by down** and **league‑wide 1st‑down pass rate**.

---

## Stack

**Backend / Data**
- Python 3.12
- [nflreadpy](https://github.com/nflverse/nflreadpy) for 2024 NFL play‑by‑play data
- Polars & pandas for ETL
- FastAPI for the HTTP API
- Uvicorn as ASGI server

**Frontend**
- React Native + TypeScript
- Expo + Expo Router (tabs navigation)
- Custom bar visualizations (no heavy chart lib required)
- Runs on web, iOS, and Android

---

## Project Structure

```text
gridiron-analytics/
├── app/                    # Expo React Native app (frontend)
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx # Tab navigator layout
│   │   │   ├── index.tsx   # Home tab – team tendencies screen
│   │   │   └── explore.tsx # Explore tab – league overview
│   │   └── _layout.tsx
│   └── ...                 # assets, components, config, etc.
├── backend/                # FastAPI backend + ETL
│   ├── data/
│   │   └── team_tendencies_2024.json  # generated ETL output
│   ├── etl/
│   │   └── build_team_tendencies.py   # ETL script (nflreadpy → JSON)
│   ├── main.py             # FastAPI app + API routes
│   └── requirements.txt    # backend Python deps
└── venv/                   # Python virtual environment (local only, not committed)
```

---

## Features

### 1. ETL: Build Team Tendencies

The ETL pipeline:

1. Uses **nflreadpy** to download 2024 NFL play‑by‑play data.
2. Filters to offensive plays only.
3. Groups by team and down (1–4).
4. Computes:
   - `rush_rate`: fraction of plays that are runs
   - `pass_rate`: fraction of plays that are passes
5. Writes a JSON file per season:

```jsonc
{
  "JAX": [
    { "down": 1, "rush_rate": 0.54, "pass_rate": 0.46 },
    { "down": 2, "rush_rate": 0.34, "pass_rate": 0.66 },
    { "down": 3, "rush_rate": 0.26, "pass_rate": 0.74 },
    { "down": 4, "rush_rate": 0.50, "pass_rate": 0.50 }
  ],
  "GB": [ ... ],
  "KC": [ ... ],
  ...
}
```

### 2. FastAPI Backend

Backend endpoints (all under `http://127.0.0.1:8000` in dev):

- `GET /teams`  
  Returns a list of team abbreviations present in the dataset.

  ```json
  ["ARI","ATL","BAL","BUF","CAR", "..."]
  ```

- `GET /teams/{team}/tendencies`  
  Returns down‑by‑down run/pass split for a specific team.

  ```json
  {
    "team": "JAX",
    "tendencies": [
      { "down": 1, "rush_rate": 0.54, "pass_rate": 0.46 },
      { "down": 2, "rush_rate": 0.34, "pass_rate": 0.66 },
      { "down": 3, "rush_rate": 0.26, "pass_rate": 0.74 },
      { "down": 4, "rush_rate": 0.50, "pass_rate": 0.50 }
    ]
  }
  ```

- `GET /league/first_down_pass_rate`  
  Returns each team’s **1st‑down rush/pass rate**, sorted by descending pass rate (most aggressive passing teams first).

  ```json
  [
    { "team": "KC", "rush_rate": 0.38, "pass_rate": 0.62 },
    { "team": "BUF", "rush_rate": 0.40, "pass_rate": 0.60 },
    ...
  ]
  ```

CORS is enabled so the Expo app can hit the API during development.

### 3. Expo App

Tabs:

- **Home**  
  - Team picker (uses `GET /teams`).
  - Down‑by‑down table of rush/pass tendencies per team (uses `/teams/{team}/tendencies`).
  - Custom stacked horizontal bar visualization that shows rush vs pass % for each down.

- **Explore**  
  - League‑wide table of first‑down pass rate ranking (uses `/league/first_down_pass_rate`).
  - Highlights pass rate (orange) and rush rate (blue) per team.

The app shares the same API base URL and can be run on web, iOS, or Android.

---

## Getting Started

### Prerequisites

- **Python** 3.11+ (project uses 3.12 locally)
- **Node.js** 20+ (Expo CLI recommends latest LTS)
- **npm** or **yarn**
- (Optional) iOS Simulator / Android Emulator or Expo Go on a device

---

## Backend Setup

From the project root:

```bash
cd gridiron-analytics

# 1. Create and activate virtualenv (if not already created)
python -m venv venv
source venv/bin/activate        # macOS / Linux
# .\venv\Scripts\activate       # Windows PowerShell

# 2. Install Python dependencies
pip install -r backend/requirements.txt
```

### Run the ETL

This downloads 2024 play‑by‑play data and builds the `team_tendencies_2024.json` file.

```bash
cd backend
python etl/build_team_tendencies.py
```

You should see logs like:

```text
Loading 2024 play-by-play data...
Loaded 50,000+ plays
Wrote team_tendencies_2024.json
```

### Start the API

From the `backend` directory:

```bash
uvicorn main:app --reload --port 8000
```

API should now be live at `http://127.0.0.1:8000`.

---

## Frontend Setup (Expo App)

From the project root:

```bash
cd app

# Install JS dependencies (first time)
npm install
# or
yarn install
```

### Configure API Base URL

Right now, the app uses:

```ts
const API_BASE_URL = "http://127.0.0.1:8000";
```

in the screens. This works for **web** and **simulators** on the same machine.

If you run the app on a **physical device**, change this to your machine’s LAN IP (e.g.):

```ts
const API_BASE_URL = "http://192.168.1.23:8000";
```

Later, this can be moved into a config or `.env` file.

### Run the Expo app

```bash
npx expo start
```

Then:

- Press **`w`** for web (quickest for dev).
- Press **`i`** for iOS simulator.
- Press **`a`** for Android emulator.
- Or scan the QR code with Expo Go on your phone.

---

## Usage

1. **Start the backend** (`uvicorn main:app --reload --port 8000`).
2. **Start the Expo app** (`npx expo start`).
3. On the **Home** tab:
   - Use the picker to select a team (e.g., GB, KC, JAX).
   - See the down‑by‑down run/pass breakdown table.
   - View the stacked bar visualization of run vs pass by down.

4. On the **Explore** tab:
   - See a league‑wide ranking of teams by **1st‑down pass rate**.
   - Quickly identify the most pass‑heavy vs run‑heavy teams on early downs.

---

## Roadmap / Ideas

Planned or aspirational features:

- **Down & distance buckets**
  - 3rd & short / medium / long tendency profiles.
  - 2nd & long vs 2nd & short aggression.

- **4th‑down aggression model**
  - Compare team decisions vs a baseline “optimal” model.
  - Compute a “Coach Aggression Index” leaderboard.

- **Game‑level dashboards**
  - Tendencies for specific matchups.
  - In‑game charts (e.g., early‑down pass rate by quarter).

- **Betting / strategy layer**
  - Win probability added by play type.
  - Simple portfolio strategy ideas (no real betting infra).

- **Persistence & auth**
  - Move from JSON to a real DB (e.g. Postgres / Supabase).
  - User accounts & saved dashboards.

---

## Scripts / Commands Reference

From project root:

```bash
# Activate Python venv
source venv/bin/activate

# Run ETL
cd backend
python etl/build_team_tendencies.py

# Start backend API
uvicorn main:app --reload --port 8000

# Start Expo app (from a separate terminal)
cd ../app
npx expo start
```

---

## License

This is a personal / portfolio project. Feel free to read and learn from the code; please ask before reusing it directly as-is in a commercial setting.
