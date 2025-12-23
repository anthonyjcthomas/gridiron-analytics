import json
from pathlib import Path

from build_metrics import (  
    load_pbp_2024,
    build_team_tendencies,
    build_fourth_down_aggression,
    build_neutral_early_down_pass_rate,
    save_tendencies_json,
    DATA_DIR,
    FOURTH_DOWN_PATH,
    EARLY_DOWN_PATH,
)
from firebase_sync import (
    sync_team_tendencies,
    sync_fourth_down,
    sync_early_down,
    sync_team_summaries,
)

SUMMARY_PATH = DATA_DIR / "team_summaries_2024.json"

def main():
    pbp_2024 = load_pbp_2024()

    # Team tendencies
    tendencies_df = build_team_tendencies(pbp_2024)
    output_path = DATA_DIR / "team_tendencies_2024.json"
    save_tendencies_json(tendencies_df, output_path)

    with output_path.open() as f:
        team_tendencies = json.load(f)
    sync_team_tendencies(team_tendencies)

    # 4th-down aggression
    fourth_df = build_fourth_down_aggression(pbp_2024)
    fourth_records = fourth_df.to_dict(orient="records")
    with FOURTH_DOWN_PATH.open("w") as f:
        json.dump(fourth_records, f, indent=2)
    sync_fourth_down(fourth_records)

    # Neutral early-down pass rate
    ed_df = build_neutral_early_down_pass_rate(pbp_2024)
    ed_records = ed_df.to_dict(orient="records")
    with EARLY_DOWN_PATH.open("w") as f:
        json.dump(ed_records, f, indent=2)
    sync_early_down(ed_records)

    # GPT summaries: you already fill SUMMARY_PATH via your /summary route,
    # or you could have an offline script that loops teams and calls the route.
    # For now we just sync whatever's already cached:
    if SUMMARY_PATH.exists():
        with SUMMARY_PATH.open() as f:
            summaries = json.load(f)
        sync_team_summaries(summaries)
    else:
        print("SUMMARY_PATH not found, skipping summary sync.")

    print("Synced all metrics to Firestore.")

if __name__ == "__main__":
    main()
