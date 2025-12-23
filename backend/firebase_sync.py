from typing import Dict, List

import pandas as pd
from google.cloud import firestore

# Uses GOOGLE_APPLICATION_CREDENTIALS env var for auth
db = firestore.Client()


def sync_team_tendencies(team_tendencies_df: pd.DataFrame) -> None:
    """
    Write team_tendencies_2024 into Firestore.

    Collection: team_tendencies_2024
    Doc ID: team code (e.g. "JAX")
    Fields:
      - team: str
      - tendencies: list of { down, rush_rate, pass_rate }
    """
    col = db.collection("team_tendencies_2024")
    batch = db.batch()

    for team, group in team_tendencies_df.groupby("team"):
        doc_ref = col.document(team)

        tendencies = []
        for _, row in group.iterrows():
            tendencies.append(
                {
                    "down": int(row["down"]),
                    "rush_rate": float(row["rush_rate"]),
                    "pass_rate": float(row["pass_rate"]),
                }
            )

        batch.set(
            doc_ref,
            {
                "team": team,
                "tendencies": tendencies,
            },
        )

    batch.commit()
    print(f"[Firestore] Wrote team_tendencies_2024 for {len(team_tendencies_df['team'].unique())} teams")


def sync_fourth_down_aggression(records: List[Dict]) -> None:
    """
    Write fourth_down_2024 into Firestore.

    Collection: fourth_down_2024
    Doc ID: team code
    Fields: attempts, go_for_it, go_rate, league_go_rate, aggression_index
    """
    col = db.collection("fourth_down_2024")
    batch = db.batch()

    for row in records:
        team = row["team"]
        doc_ref = col.document(team)
        payload = {
            "team": team,
            "attempts": int(row.get("attempts", 0)),
            "go_for_it": int(row.get("go_for_it", 0)),
            "go_rate": float(row.get("go_rate", 0.0)),
            "league_go_rate": float(row.get("league_go_rate", 0.0)),
            "aggression_index": float(row.get("aggression_index", 0.0)),
        }
        batch.set(doc_ref, payload)

    batch.commit()
    print(f"[Firestore] Wrote fourth_down_2024 for {len(records)} teams")


def sync_early_down_pass_rate(records: List[Dict]) -> None:
    """
    Write early_down_pass_2024 into Firestore.

    Collection: early_down_pass_2024
    Doc ID: team code
    Fields: plays, pass_plays, pass_rate, league_pass_rate, pass_rate_over_avg
    """
    col = db.collection("early_down_pass_2024")
    batch = db.batch()

    for row in records:
        team = row["team"]
        doc_ref = col.document(team)
        payload = {
            "team": team,
            "plays": int(row.get("plays", 0)),
            "pass_plays": int(row.get("pass_plays", 0)),
            "pass_rate": float(row.get("pass_rate", 0.0)),
            "league_pass_rate": float(row.get("league_pass_rate", 0.0)),
            "pass_rate_over_avg": float(row.get("pass_rate_over_avg", 0.0)),
        }
        batch.set(doc_ref, payload)

    batch.commit()
    print(f"[Firestore] Wrote early_down_pass_2024 for {len(records)} teams")


def sync_team_summaries(summaries: Dict[str, str]) -> None:
    """
    Write GPT-generated team summaries into Firestore.

    Collection: team_summaries_2024
    Doc ID: team code
    Fields:
      - team: str
      - summary: str
    """
    col = db.collection("team_summaries_2024")
    batch = db.batch()

    for team, summary in summaries.items():
        doc_ref = col.document(team)
        batch.set(
            doc_ref,
            {
                "team": team,
                "summary": summary,
            },
        )

    batch.commit()
    print(f"[Firestore] Wrote team_summaries_2024 for {len(summaries)} teams")
