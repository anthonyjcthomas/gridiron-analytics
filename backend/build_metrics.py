import json
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd
import nflreadpy as nfl

# store data files inside backend/data
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

FOURTH_DOWN_PATH = DATA_DIR / "fourth_down_aggression_2024.json"
EARLY_DOWN_PATH = DATA_DIR / "neutral_early_down_pass_rate_2024.json"
TEAM_TENDENCIES_PATH = DATA_DIR / "team_tendencies_2024.json"


def load_pbp_2024() -> pd.DataFrame:
    """
    Load 2024 play-by-play data from nflverse via nflreadpy.
    """
    print("Loading 2024 play-by-play data...")
    pbp_polars = nfl.load_pbp([2024])  # 2024 season
    pbp = pbp_polars.to_pandas()
    print(f"Loaded {len(pbp):,} plays")
    return pbp


def build_team_tendencies(pbp: pd.DataFrame) -> pd.DataFrame:
    """
    Build run/pass rate by down for each team.
    """
    plays = pbp[
        (pbp["pass_attempt"] == 1) | (pbp["rush_attempt"] == 1)
    ].copy()

    def get_play_type(row):
        if row["pass_attempt"] == 1:
            return "pass"
        if row["rush_attempt"] == 1:
            return "rush"
        return "other"

    plays["play_type"] = plays.apply(get_play_type, axis=1)

    grouped = (
        plays.groupby(["posteam", "down", "play_type"])
        .size()
        .reset_index(name="play_count")
    )

    totals = (
        grouped.groupby(["posteam", "down"])["play_count"]
        .sum()
        .reset_index(name="total_plays")
    )

    merged = grouped.merge(totals, on=["posteam", "down"], how="left")
    merged["rate"] = merged["play_count"] / merged["total_plays"]

    pivot = merged.pivot_table(
        index=["posteam", "down"],
        columns="play_type",
        values="rate",
        fill_value=0.0,
    ).reset_index()

    pivot = pivot.rename(
        columns={
            "posteam": "team",
            "rush": "rush_rate",
            "pass": "pass_rate",
        }
    )

    pivot["down"] = pivot["down"].astype("Int64")

    return pivot.sort_values(["team", "down"])


def save_tendencies_json(df: pd.DataFrame, path: Path):
    """
    Save the team tendencies DataFrame as a JSON file, grouped by team.
    """
    result: Dict[str, List[dict]] = {}
    for team, group in df.groupby("team"):
        result[team] = []
        for _, row in group.iterrows():
            result[team].append(
                {
                    "down": int(row["down"]),
                    "rush_rate": float(row["rush_rate"]),
                    "pass_rate": float(row["pass_rate"]),
                }
            )

    with path.open("w") as f:
        json.dump(result, f, indent=2)

    print(f"Saved team tendencies JSON to {path}")


def build_fourth_down_aggression(pbp: pd.DataFrame) -> pd.DataFrame:
    """
    Compute a simple 4th-down aggression metric by team.

    4th & short (1–3 yds), between the 20s, non-penalty. Go = run/pass, Not-go = punt/FG.
    """
    df = pbp.copy()

    mask = (
        (df["down"] == 4)
        & (df["ydstogo"].between(1, 3))
        & (df["yardline_100"].between(20, 80))
        & (df["penalty"] == 0)
    )

    df = df.loc[mask]

    go_mask = df["play_type"].isin(["run", "pass"])
    not_go_mask = df["play_type"].isin(["punt", "field_goal"])

    df = df.loc[go_mask | not_go_mask].copy()
    if df.empty:
        return pd.DataFrame(
            columns=[
                "team",
                "attempts",
                "go_for_it",
                "go_rate",
                "league_go_rate",
                "aggression_index",
            ]
        )

    df["is_go_for_it"] = go_mask.loc[df.index]

    league_attempts = len(df)
    league_go = int(df["is_go_for_it"].sum())
    league_go_rate = league_go / league_attempts if league_attempts > 0 else np.nan

    grouped = (
        df.groupby("posteam", dropna=False)["is_go_for_it"]
        .agg(["count", "sum"])
        .reset_index()
    )

    grouped.rename(
        columns={
            "posteam": "team",
            "count": "attempts",
            "sum": "go_for_it",
        },
        inplace=True,
    )

    grouped["go_rate"] = grouped["go_for_it"] / grouped["attempts"]
    grouped["league_go_rate"] = league_go_rate
    grouped["aggression_index"] = grouped["go_rate"] - league_go_rate

    grouped.sort_values("aggression_index", ascending=False, inplace=True)
    return grouped


def build_neutral_early_down_pass_rate(pbp: pd.DataFrame) -> pd.DataFrame:
    """
    Neutral early-down pass rate by team.

    Down 1 or 2, 7–10 yds to go, between the 20s, score diff in [-7, 7],
    non-penalty, run/pass plays only.
    """
    df = pbp.copy()

    mask = (
        df["down"].isin([1, 2])
        & df["ydstogo"].between(7, 10)
        & df["yardline_100"].between(20, 80)
        & df["score_differential"].between(-7, 7)
        & (df["penalty"] == 0)
    )

    df = df.loc[mask]

    play_mask = df["play_type"].isin(["run", "pass"])
    df = df.loc[play_mask].copy()
    if df.empty:
        return pd.DataFrame(
            columns=[
                "team",
                "plays",
                "pass_plays",
                "pass_rate",
                "league_pass_rate",
                "pass_rate_over_avg",
            ]
        )

    df["is_pass"] = df["play_type"] == "pass"

    league_plays = len(df)
    league_passes = int(df["is_pass"].sum())
    league_pass_rate = league_passes / league_plays if league_plays > 0 else np.nan

    grouped = (
        df.groupby("posteam", dropna=False)["is_pass"]
        .agg(["count", "sum"])
        .reset_index()
    )

    grouped.rename(
        columns={
            "posteam": "team",
            "count": "plays",
            "sum": "pass_plays",
        },
        inplace=True,
    )

    grouped["pass_rate"] = grouped["pass_plays"] / grouped["plays"]
    grouped["league_pass_rate"] = league_pass_rate
    grouped["pass_rate_over_avg"] = grouped["pass_rate"] - league_pass_rate

    grouped.sort_values("pass_rate_over_avg", ascending=False, inplace=True)
    return grouped
