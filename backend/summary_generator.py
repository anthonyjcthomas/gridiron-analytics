import os
from typing import Dict, List, Any

from openai import OpenAI

# Read API key from env var ONLY (do NOT hard-code keys)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

SYSTEM_PROMPT = """
You are an NFL analytics assistant writing concise scouting reports
for coaches and analysts. Your tone should be clear, neutral, and
tactically focused. Avoid fluff. Max 2–3 short paragraphs.
"""

def build_team_prompt(
    team: str,
    tendencies: List[Dict[str, Any]],
    fourth_row: Dict[str, Any] | None,
    early_row: Dict[str, Any] | None,
) -> str:
    """
    Create a compact text summary of the numeric inputs to send to the model.
    """

    lines: List[str] = []
    lines.append(f"Team: {team}")
    lines.append("Down-by-down run vs pass tendencies (rush/pass %):")

    for row in sorted(tendencies, key=lambda r: r["down"]):
        rush_pct = round(row["rush_rate"] * 100, 1)
        pass_pct = round(row["pass_rate"] * 100, 1)
        lines.append(f"  Down {row['down']}: Rush {rush_pct}%, Pass {pass_pct}%")

    if fourth_row:
        lines.append("")
        lines.append("4th-down aggression (short, between the 20s):")
        lines.append(
            f"  Go rate: {round(fourth_row['go_rate'] * 100, 1)}% "
            f"(league avg {round(fourth_row['league_go_rate'] * 100, 1)}%), "
            f"index vs avg: {round(fourth_row['aggression_index'] * 100, 1)}%"
        )

    if early_row:
        lines.append("")
        lines.append("Neutral early-down pass rate (1st/2nd & 7–10, neutral score):")
        lines.append(
            f"  Pass rate: {round(early_row['pass_rate'] * 100, 1)}% "
            f"(league avg {round(early_row['league_pass_rate'] * 100, 1)}%), "
            f"over/under avg: {round(early_row['pass_rate_over_avg'] * 100, 1)}%"
        )

    lines.append("")
    lines.append(
        "Write a short scouting summary describing this offense’s overall "
        "identity (run vs pass, early-down philosophy, and 4th-down behavior). "
        "Highlight what makes them different from league average."
    )

    return "\n".join(lines)


def generate_summary_for_team(
    team: str,
    tendencies: List[Dict[str, Any]],
    fourth_row: Dict[str, Any] | None,
    early_row: Dict[str, Any] | None,
) -> str:
    """
    Call OpenAI once for a single team and return the text summary.
    """

    prompt = build_team_prompt(team, tendencies, fourth_row, early_row)

    resp = client.responses.create(
        model="gpt-5.1-mini",  # cheap + good; change if you want
        temperature=0.4,
        max_output_tokens=400,
        system=SYSTEM_PROMPT,
        input=prompt,
    )

    # The text is in the first output message
    content = resp.output[0].content[0].text
    return content


def generate_summaries_for_league(
    tendencies_by_team: Dict[str, List[Dict[str, Any]]],
    fourth_by_team: Dict[str, Dict[str, Any]],
    early_by_team: Dict[str, Dict[str, Any]],
) -> Dict[str, str]:
    """
    Loop over all teams and produce {team_code: summary_text}.
    """

    summaries: Dict[str, str] = {}

    for team, tendencies in tendencies_by_team.items():
        fourth = fourth_by_team.get(team)
        early = early_by_team.get(team)

        print(f"Generating summary for {team}...")
        try:
            summary = generate_summary_for_team(team, tendencies, fourth, early)
            summaries[team] = summary
        except Exception as e:
            print(f"  ❌ Failed to generate summary for {team}: {e}")

    return summaries
