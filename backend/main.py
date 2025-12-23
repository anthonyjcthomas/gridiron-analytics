from pathlib import Path
from typing import Dict, List

import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "team_tendencies_2024.json"

app = FastAPI(title="Gridiron Analytics API")

# Allow your Expo app (web + native) to call this during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load JSON data once at startup
if DATA_PATH.exists():
    with DATA_PATH.open() as f:
        TEAM_TENDENCIES: Dict[str, List[dict]] = json.load(f)
else:
    TEAM_TENDENCIES = {}


@app.get("/teams")
def get_teams():
    """
    Return list of team codes that have data.
    """
    return sorted(TEAM_TENDENCIES.keys())


@app.get("/teams/{team}/tendencies")
def get_team_tendencies(team: str):
    """
    Return down-by-down run/pass rates for a given team (e.g. 'JAX').
    """
    team = team.upper()
    if team not in TEAM_TENDENCIES:
        raise HTTPException(status_code=404, detail="Team not found")
    return {
        "team": team,
        "tendencies": TEAM_TENDENCIES[team],
    }
