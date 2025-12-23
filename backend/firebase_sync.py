# backend/firebase_sync.py

from typing import Any, Dict

import pandas as pd
from google.cloud import firestore

db = firestore.Client()

TEAM_TENDENCIES_COLLECTION = "team_tendencies_2024"
FOURTH_DOWN_COLLECTION = "fourth_down_2024"
EARLY_DOWN_COLLECTION = "early_down_pass_2024"


def _commit_in_batches(batch, counter: int, chunk_size: int = 400):
    """Helper to commit Firestore writes every chunk_size docs."""
    if counter % chunk_size == 0:
        batch.commit()
        return db.batch()
    return batch


def sync_team_tendencies(df: pd.DataFrame):
    """
    Write team tendencies into Firestore:
    Collection: team_tendencies_2024
    Doc ID: team code (e.g. "GB")
    Fields: { team: "GB", tendencies: [ {down, rush_rate, pass_rate}, ... ] }
    """
    col = db.collection(TEAM_TENDENCIES_COLLECTION)
    batch = db.batch()
    count = 0

    for team, group in df.groupby("team"):
        tendencies = [
            {
                "down": int(row["down"]),
                "rush_rate": float(row["rush_rate"]),
                "pass_rate": float(row["pass_rate"]),
            }
            for _, row in group.iterrows()
        ]

        doc_ref = col.document(str(team))
        batch.set(
            doc_ref,
            {
                "team": str(team),
                "tendencies": tendencies,
            },
        )
        count += 1
        batch = _commit_in_batches(batch, count)

    batch.commit()
    print(f"Synced {count} team tendency docs to Firestore.")


def sync_fourth_down(df: pd.DataFrame):
    """
    Write 4th-down aggression into Firestore:
    Collection: fourth_down_2024
    Doc ID: team code
    """
    col = db.collection(FOURTH_DOWN_COLLECTION)
    batch = db.batch()
    count = 0

    for _, row in df.iterrows():
        team = str(row["team"])
        doc_ref = col.document(team)
        payload: Dict[str, Any] = {
            "team": team,
            "attempts": int(row["attempts"]),
            "go_for_it": int(row["go_for_it"]),
            "go_rate": float(row["go_rate"]),
            "league_go_rate": float(row["league_go_rate"]),
            "aggression_index": float(row["aggression_index"]),
        }
        batch.set(doc_ref, payload)
        count += 1
        batch = _commit_in_batches(batch, count)

    batch.commit()
    print(f"Synced {count} fourth-down docs to Firestore.")


def sync_early_down(df: pd.DataFrame):
    """
    Write neutral early-down pass rate into Firestore:
    Collection: early_down_pass_2024
    Doc ID: team code
    """
    col = db.collection(EARLY_DOWN_COLLECTION)
    batch = db.batch()
    count = 0

    for _, row in df.iterrows():
        team = str(row["team"])
        doc_ref = col.document(team)
        payload: Dict[str, Any] = {
            "team": team,
            "plays": int(row["plays"]),
            "pass_plays": int(row["pass_plays"]),
            "pass_rate": float(row["pass_rate"]),
            "league_pass_rate": float(row["league_pass_rate"]),
            "pass_rate_over_avg": float(row["pass_rate_over_avg"]),
        }
        batch.set(doc_ref, payload)
        count += 1
        batch = _commit_in_batches(batch, count)

    batch.commit()
    print(f"Synced {count} early-down pass docs to Firestore.")
