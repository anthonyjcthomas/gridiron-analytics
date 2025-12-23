import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const API_BASE_URL = "http://127.0.0.1:8000";

type FourthDownAggression = {
  team: string;
  attempts: number;
  go_for_it: number;
  go_rate: number;
  league_go_rate: number;
  aggression_index: number;
};

type NeutralEarlyDownPassRate = {
  team: string;
  plays: number;
  pass_plays: number;
  pass_rate: number;
  league_pass_rate: number;
  pass_rate_over_avg: number;
};

function MetricCard(props: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  const { label, value, sublabel } = props;
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {sublabel ? <Text style={styles.metricSubLabel}>{sublabel}</Text> : null}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  const [teams, setTeams] = useState<string[]>([]);
  const [fourthData, setFourthData] = useState<FourthDownAggression[]>([]);
  const [earlyData, setEarlyData] = useState<NeutralEarlyDownPassRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        // Teams (for the pill nav)
        const teamRes = await fetch(`${API_BASE_URL}/teams`);
        if (!teamRes.ok) {
          throw new Error(`Failed to fetch teams: ${teamRes.status}`);
        }
        const teamJson = (await teamRes.json()) as string[];
        setTeams(teamJson);

        // 4th-down aggression
        const fourthRes = await fetch(
          `${API_BASE_URL}/league/fourth_down_aggression`
        );
        if (!fourthRes.ok) {
          throw new Error(
            `Failed to fetch 4th-down aggression: ${fourthRes.status}`
          );
        }
        const fourthJson = (await fourthRes.json()) as FourthDownAggression[];
        setFourthData(fourthJson);

        // Neutral early-down pass rate
        const earlyRes = await fetch(
          `${API_BASE_URL}/league/neutral_early_down_pass_rate`
        );
        if (!earlyRes.ok) {
          throw new Error(
            `Failed to fetch early-down pass rates: ${earlyRes.status}`
          );
        }
        const earlyJson = (await earlyRes.json()) as NeutralEarlyDownPassRate[];
        setEarlyData(earlyJson);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Error loading league data");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Derived league numbers for KPIs + summary
  const mostAggressive = fourthData[0];
  const mostConservative =
    fourthData.length > 0 ? fourthData[fourthData.length - 1] : undefined;

  const mostPassHeavy = earlyData[0];
  const mostRunHeavy =
    earlyData.length > 0 ? earlyData[earlyData.length - 1] : undefined;

  const leagueGoRate =
    fourthData.length > 0 ? fourthData[0].league_go_rate : null;
  const leaguePassRate =
    earlyData.length > 0 ? earlyData[0].league_pass_rate : null;

  const goTeam = (team: string) => {
    router.push(`/team/${team}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <Text style={styles.appName}>Gridiron Analytics</Text>
        <Text style={styles.appSubtitle}>2024 NFL Season Snapshot</Text>

        {/* Team pill nav */}
        {teams.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.teamPillScroll}
            contentContainerStyle={styles.teamPillRow}
          >
            {teams.map((team) => (
              <Pressable
                key={team}
                onPress={() => goTeam(team)}
                style={styles.teamPill}
              >
                <Text style={styles.teamPillText}>{team}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* KPIs */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Most aggressive on 4th"
            value={
              mostAggressive && leagueGoRate != null
                ? `${mostAggressive.team} · ${(mostAggressive.go_rate * 100).toFixed(
                    1
                  )}%`
                : loading
                ? "Loading..."
                : "--"
            }
            sublabel={
              leagueGoRate != null
                ? `League avg: ${(leagueGoRate * 100).toFixed(1)}%`
                : undefined
            }
          />
          <MetricCard
            label="Pass-heaviest (neutral 1st/2nd)"
            value={
              mostPassHeavy && leaguePassRate != null
                ? `${mostPassHeavy.team} · ${(mostPassHeavy.pass_rate * 100).toFixed(
                    1
                  )}%`
                : loading
                ? "Loading..."
                : "--"
            }
            sublabel={
              leaguePassRate != null
                ? `League avg: ${(leaguePassRate * 100).toFixed(1)}%`
                : undefined
            }
          />
        </View>

        {loading && <ActivityIndicator style={styles.loader} />}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* League summary content */}
        {!loading && !error && fourthData.length > 0 && earlyData.length > 0 && (
          <>
            <View style={styles.sectionDivider} />

            <Text style={styles.sectionTitle}>League Overview</Text>
            <Text style={styles.sectionSubtitle}>
              High-level context on 4th-down decision making and neutral
              early-down playcalling in 2024.
            </Text>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryHeading}>4th-Down Decisions</Text>
              <Text style={styles.summaryText}>
                Across the league, offenses go for it on{" "}
                <Text style={styles.summaryEmphasis}>
                  {(leagueGoRate! * 100).toFixed(1)}%
                </Text>{" "}
                of 4th-and-short situations (1–3 yards, between the 20s). The{" "}
                <Text style={styles.summaryEmphasis}>{mostAggressive?.team}</Text>{" "}
                offense sits at{" "}
                <Text style={styles.summaryEmphasis}>
                  {(mostAggressive!.go_rate * 100).toFixed(1)}%
                </Text>{" "}
                — well above league average — while{" "}
                <Text style={styles.summaryEmphasis}>
                  {mostConservative?.team}
                </Text>{" "}
                is the most conservative team in these spots.
              </Text>
              <Text style={styles.summaryText}>
                In general, aggressive teams trade small increases in failure
                rate for more first downs and longer drives. Conservative teams
                lean on field position instead, punting or kicking more often in
                what analytics would consider “go” situations.
              </Text>
            </View>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryHeading}>
                Neutral Early-Down Pass Rate
              </Text>
              <Text style={styles.summaryText}>
                In neutral game states (1st/2nd down, 7–10 yards to go, between
                the 20s, score within ±7), teams throw the ball on{" "}
                <Text style={styles.summaryEmphasis}>
                  {(leaguePassRate! * 100).toFixed(1)}%
                </Text>{" "}
                of plays on average.{" "}
                <Text style={styles.summaryEmphasis}>{mostPassHeavy?.team}</Text>{" "}
                leads the league, throwing on{" "}
                <Text style={styles.summaryEmphasis}>
                  {(mostPassHeavy!.pass_rate * 100).toFixed(1)}%
                </Text>{" "}
                of early-down snaps, while{" "}
                <Text style={styles.summaryEmphasis}>{mostRunHeavy?.team}</Text>{" "}
                sits at the run-heaviest end of the spectrum.
              </Text>
              <Text style={styles.summaryText}>
                Higher pass rates on early downs generally correlate with more
                efficient offenses — but they also expose quarterbacks to more
                pressure and variance. Run-heavy teams tend to play for shorter
                third downs, slower games, and lower total play volume.
              </Text>
            </View>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryHeading}>
                How to Use This Dashboard
              </Text>
              <Text style={styles.summaryText}>
                Use the{" "}
                <Text style={styles.summaryEmphasis}>team pills up top</Text> to
                jump into any team’s detail page for a deeper breakdown: a
                GPT-generated offensive summary, down-by-down tendencies, and
                key context around how they call games.
              </Text>
              <Text style={styles.summaryText}>
                The <Text style={styles.summaryEmphasis}>Explore</Text> tab
                gives a league-wide view with sortable tables for 4th-down
                aggression and neutral early-down pass rate. It’s built to help
                you compare philosophies at a glance — from ultra-aggressive
                offenses to old-school, field-position-first approaches.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  appSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    marginBottom: 12,
  },
  teamPillScroll: {
    marginTop: 4,
    marginBottom: 16,
  },
  teamPillRow: {
    paddingRight: 8,
    gap: 8,
  },
  teamPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#f4f4f5",
  },
  teamPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  metricLabel: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metricValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  metricSubLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
  loader: {
    marginTop: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
    marginBottom: 12,
  },
  summaryBlock: {
    marginTop: 12,
  },
  summaryHeading: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: "#111827",
    lineHeight: 20,
    marginBottom: 6,
  },
  summaryEmphasis: {
    fontWeight: "600",
    color: "#111827",
  },
  errorText: {
    marginTop: 8,
    color: "#b91c1c",
  },
});
