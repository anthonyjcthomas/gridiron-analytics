from pathlib import Path
from typing import Dict, List, Optional
import json
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from openai import OpenAI


logger = logging.getLogger("gridiron")
# ---------- Data models ----------

class FourthDownAggression(BaseModel):
    team: str
    attempts: int
    go_for_it: int
    go_rate: float
    league_go_rate: float
    aggression_index: float


class NeutralEarlyDownPassRate(BaseModel):
    team: str
    plays: int
    pass_plays: int
    pass_rate: float
    league_pass_rate: float
    pass_rate_over_avg: float


# ---------- Paths & data loading ----------

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

TEAM_TENDENCIES_PATH = DATA_DIR / "team_tendencies_2024.json"
FOURTH_DOWN_PATH = DATA_DIR / "fourth_down_aggression_2024.json"
EARLY_DOWN_PATH = DATA_DIR / "neutral_early_down_pass_rate_2024.json"

app = FastAPI(title="Gridiron Analytics API")

# CORS for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI client (expects OPENAI_API_KEY in env)
client = OpenAI()

# Load JSON once at startup
if TEAM_TENDENCIES_PATH.exists():
    with TEAM_TENDENCIES_PATH.open() as f:
        TEAM_TENDENCIES: Dict[str, List[dict]] = json.load(f)
else:
    TEAM_TENDENCIES = {}

if FOURTH_DOWN_PATH.exists():
    with FOURTH_DOWN_PATH.open() as f:
        FOURTH_DOWN_AGGRESSION: List[dict] = json.load(f)
else:
    FOURTH_DOWN_AGGRESSION = []

if EARLY_DOWN_PATH.exists():
    with EARLY_DOWN_PATH.open() as f:
        EARLY_DOWN_PASS: List[dict] = json.load(f)
else:
    EARLY_DOWN_PASS = []


def find_fourth_row(team: str) -> Optional[dict]:
    return next((r for r in FOURTH_DOWN_AGGRESSION if r.get("team") == team), None)


def find_early_row(team: str) -> Optional[dict]:
    return next((r for r in EARLY_DOWN_PASS if r.get("team") == team), None)


# ---------- Routes ----------

@app.get("/teams")
def get_teams():
    """Return sorted list of team codes."""
    return sorted(TEAM_TENDENCIES.keys())


@app.get("/teams/{team}/tendencies")
def get_team_tendencies(team: str):
    """Return down-by-down run/pass rates for a given team (e.g. 'JAX')."""
    team = team.upper()
    if team not in TEAM_TENDENCIES:
        raise HTTPException(status_code=404, detail="Team not found")
    return {
        "team": team,
        "tendencies": TEAM_TENDENCIES[team],
    }


@app.get("/league/fourth_down_aggression", response_model=List[FourthDownAggression])
def get_fourth_down_aggression():
    """Return league-wide 4th-down aggression metrics."""
    data = sorted(
        FOURTH_DOWN_AGGRESSION,
        key=lambda r: r.get("aggression_index", 0),
        reverse=True,
    )
    return data


@app.get(
    "/league/neutral_early_down_pass_rate",
    response_model=List[NeutralEarlyDownPassRate],
)
def get_neutral_early_down_pass_rate():
    """Return neutral 1st/2nd-down pass rate metrics by team."""
    data = sorted(
        EARLY_DOWN_PASS,
        key=lambda r: r.get("pass_rate_over_avg", 0),
        reverse=True,
    )
    return data


@app.get("/teams/{team}/summary")
def get_team_summary(team: str):
    """
    GPT-generated natural language summary for one team's offensive tendencies.

    It looks at:
    - down-by-down run/pass rates
    - 4th-down aggression
    - neutral early-down pass rate

    If OpenAI fails for any reason, we fall back to a basic text summary.
    """
    team = team.upper()

    if team not in TEAM_TENDENCIES:
        raise HTTPException(status_code=404, detail="Team not found")

    tendencies = TEAM_TENDENCIES[team]
    fourth = find_fourth_row(team) or {}
    early = find_early_row(team) or {}

    prompt_payload = {
        "team": team,
        "tendencies_by_down": tendencies,
        "fourth_down_aggression": fourth,
        "neutral_early_down_pass_rate": early,
    }

    prompt = (
        "You are an NFL analytics writer. "
        "Given JSON data about a team's 2024 offensive tendencies, "
        "write a concise 3–4 sentence scouting summary in plain English. "
        "Focus on:\n"
        "- how they mix run vs pass on different downs,\n"
        "- how aggressive they are on 4th and short,\n"
        "- how pass-heavy they are on neutral 1st/2nd downs.\n"
        "Target smart fans, not coaches. No bullets, just one short paragraph.\n\n"
        f"DATA:\n{json.dumps(prompt_payload)}"
    )

    # --- Try GPT, but DO NOT crash if it fails ---
    summary_text: str | None = None

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
        )

        # New Responses API helper:
        try:
            summary_text = response.output_text.strip()
        except Exception:
            # Fallback if output_text isn't available for some reason
            # (paranoid but safe)
            if (
                hasattr(response, "output")
                and len(response.output) > 0
                and hasattr(response.output[0], "content")
                and len(response.output[0].content) > 0
            ):
                part = response.output[0].content[0]
                if hasattr(part, "text") and hasattr(part.text, "value"):
                    summary_text = str(part.text.value).strip()

    except Exception as e:
        # Log the real error but DON'T throw 500
        logger.exception("OpenAI summary generation failed for %s: %s", team, e)

    # If GPT failed, build a simple fallback summary from the raw stats
    if not summary_text:
        # basic heuristics to say *something* decent
        by_down_desc: list[str] = []
        for row in tendencies:
            d = row.get("down")
            rush = row.get("rush_rate", 0.0)
            pass_ = row.get("pass_rate", 0.0)
            if d in [1, 2, 3, 4]:
                if pass_ > rush:
                    by_down_desc.append(f"on 4th down they lean pass-heavy")
                else:
                    by_down_desc.append(f"on 4th down they lean run-heavy")
        by_down_text = ""
        if tendencies:
            first = tendencies[0]
            last = tendencies[-1]
            by_down_text = (
                f"On early downs they call roughly "
                f"{round(first.get('rush_rate', 0.0) * 100)}% runs, "
                f"while by later downs that shifts toward "
                f"{round(last.get('pass_rate', 0.0) * 100)}% passes."
            )

        fourth_piece = ""
        if fourth:
            go_rate = round(fourth.get("go_rate", 0.0) * 100, 1)
            league_go = round(fourth.get("league_go_rate", 0.0) * 100, 1)
            diff = go_rate - league_go
            tendency_word = "more aggressive" if diff > 0 else "more conservative"
            fourth_piece = (
                f" On 4th-and-short they go for it about {go_rate}% of the time "
                f"({tendency_word} than the league average of {league_go}%)."
            )

        early_piece = ""
        if early:
            pr = round(early.get("pass_rate", 0.0) * 100, 1)
            league_pr = round(early.get("league_pass_rate", 0.0) * 100, 1)
            diff = pr - league_pr
            if diff > 0:
                lean = "pass-heavy"
            elif diff < 0:
                lean = "run-leaning"
            else:
                lean = "balanced"
            early_piece = (
                f" In neutral early-down situations they throw on about {pr}% of plays, "
                f"which is {abs(round(diff, 1))}% {('above' if diff > 0 else 'below') if diff != 0 else 'in line with'} "
                f"the league average of {league_pr}%, making them relatively {lean}."
            )

        summary_text = (
            f"{team} show a clear offensive identity in 2024. "
            f"{by_down_text}{fourth_piece}{early_piece}"
        )

    return {"team": team, "summary": summary_text}