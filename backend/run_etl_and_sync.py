import json
from typing import Dict, List

from openai import OpenAI

from build_metrics import (
    load_pbp_2024,
    build_team_tendencies,
    save_tendencies_json,
    build_fourth_down_aggression,
    build_neutral_early_down_pass_rate,
    TEAM_TENDENCIES_PATH,
    FOURTH_DOWN_PATH,
    EARLY_DOWN_PATH,
)
from firebase_sync import (
    sync_team_tendencies,
    sync_fourth_down_aggression,
    sync_early_down_pass_rate,
    sync_team_summaries,
)

client = OpenAI()  # uses OPENAI_API_KEY from env


def generate_team_summary(
    team: str,
    tendencies: List[Dict],
    fourth: Dict | None,
    early: Dict | None,
) -> str:
    """
    Call OpenAI once for a team to generate a short offensive summary
    based on tendencies + 4th-down aggression + neutral early-down pass rate.
    """
    # Build a compact metrics description to feed the model
    tendency_lines = []
    for row in tendencies:
        tendency_lines.append(
            f"- Down {row['down']}: rush_rate={row['rush_rate']:.3f}, pass_rate={row['pass_rate']:.3f}"
        )
    tendency_block = "\n".join(tendency_lines)

    fourth_line = (
        f"4th-down go_rate={fourth['go_rate']:.3f}, "
        f"league_go_rate={fourth['league_go_rate']:.3f}, "
        f"aggression_index={fourth['aggression_index']:.3f}, "
        f"attempts={fourth['attempts']}"
        if fourth
        else "No 4th-down data."
    )

    early_line = (
        f"Neutral early-down pass_rate={early['pass_rate']:.3f}, "
        f"league_pass_rate={early['league_pass_rate']:.3f}, "
        f"pass_rate_over_avg={early['pass_rate_over_avg']:.3f}, "
        f"plays={early['plays']}"
        if early
        else "No neutral early-down pass data."
    )

    prompt = f"""
You are an NFL analytics writer for a site called Gridiron Analytics.

Write a concise scouting-style summary of the {team} 2024 OFFENSE using the data below.
Focus on:
- whether they lean run or pass on early vs late downs,
- how aggressive they are on 4th down,
- how pass-heavy they are in neutral situations (1st/2nd down, close score),
- what that might mean for their offensive identity and playcalling tendencies.

Keep it under 180 words. Use clear, analytic language, no fluff, no emojis.
Write in one or two short paragraphs, not bullet points.

DATA:
Down-by-down run/pass rates:
{tendency_block}

4th-down aggression:
{fourth_line}

Neutral early-down pass rate:
{early_line}
"""

    resp = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt.strip(),
        max_output_tokens=300,
    )

    # New SDK gives you the text directly like this:
    text = resp.output_text
    return text.strip()


def main():
    # 1) Build metrics from nflverse
    pbp_2024 = load_pbp_2024()

    team_tendencies_df = build_team_tendencies(pbp_2024)
    save_tendencies_json(team_tendencies_df, TEAM_TENDENCIES_PATH)

    fourth_df = build_fourth_down_aggression(pbp_2024)
    fourth_records = fourth_df.to_dict(orient="records")
    with FOURTH_DOWN_PATH.open("w") as f:
        json.dump(fourth_records, f, indent=2)

    early_df = build_neutral_early_down_pass_rate(pbp_2024)
    early_records = early_df.to_dict(orient="records")
    with EARLY_DOWN_PATH.open("w") as f:
        json.dump(early_records, f, indent=2)

    print(f"Wrote 4th-down aggression to {FOURTH_DOWN_PATH}")
    print(f"Wrote neutral early-down pass rates to {EARLY_DOWN_PATH}")

    # 2) Sync metrics to Firestore
    sync_team_tendencies(team_tendencies_df)
    sync_fourth_down_aggression(fourth_records)
    sync_early_down_pass_rate(early_records)

    # 3) Build summaries per team and sync those too

    # Load the per-team tendencies JSON we just wrote
    with TEAM_TENDENCIES_PATH.open() as f:
        tendencies_by_team: Dict[str, List[Dict]] = json.load(f)

    # Build lookup maps for 4th-down + early-down metrics
    fourth_by_team: Dict[str, Dict] = {row["team"]: row for row in fourth_records}
    early_by_team: Dict[str, Dict] = {row["team"]: row for row in early_records}

    summaries: Dict[str, str] = {}

    for team, tendencies in tendencies_by_team.items():
        print(f"Generating summary for {team}...")
        summary = generate_team_summary(
            team=team,
            tendencies=tendencies,
            fourth=fourth_by_team.get(team),
            early=early_by_team.get(team),
        )
        summaries[team] = summary

    # 4) Write summaries into Firestore
    sync_team_summaries(summaries)


if __name__ == "__main__":
    main()
