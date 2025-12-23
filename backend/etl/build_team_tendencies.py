import json
from pathlib import Path

import nflreadpy as nfl
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def load_pbp_2024() -> pd.DataFrame:
    """
    Load 2024 play-by-play data from nflverse via nflreadpy.
    This returns a Polars DataFrame, so we convert to pandas.
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
    # Keep only offensive plays
    plays = pbp[
        (pbp["pass_attempt"] == 1) | (pbp["rush_attempt"] == 1)
    ].copy()

    # Map play type
    def get_play_type(row):
        if row["pass_attempt"] == 1:
            return "pass"
        if row["rush_attempt"] == 1:
            return "rush"
        return "other"

    plays["play_type"] = plays.apply(get_play_type, axis=1)

    # Group: team (posteam) x down x play_type
    grouped = (
        plays.groupby(["posteam", "down", "play_type"])
        .size()
        .reset_index(name="play_count")
    )

    # Total plays per team+down
    totals = (
        grouped.groupby(["posteam", "down"])["play_count"]
        .sum()
        .reset_index(name="total_plays")
    )

    merged = grouped.merge(
        totals, on=["posteam", "down"], how="left"
    )
    merged["rate"] = merged["play_count"] / merged["total_plays"]

    # Pivot to have rush_rate and pass_rate columns
    pivot = merged.pivot_table(
        index=["posteam", "down"],
        columns="play_type",
        values="rate",
        fill_value=0.0,
    ).reset_index()

    # Ensure consistent column names
    pivot = pivot.rename(
        columns={
            "posteam": "team",
            "rush": "rush_rate",
            "pass": "pass_rate",
        }
    )

    # Down as int (1–4)
    pivot["down"] = pivot["down"].astype("Int64")

    return pivot.sort_values(["team", "down"])


def save_tendencies_json(df: pd.DataFrame, path: Path):
    """
    Save the team tendencies DataFrame as a JSON file, grouped by team.
    """
    result = {}
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


def main():
    pbp_2024 = load_pbp_2024()
    tendencies = build_team_tendencies(pbp_2024)
    output_path = DATA_DIR / "team_tendencies_2024.json"
    save_tendencies_json(tendencies, output_path)


if __name__ == "__main__":
    main()
