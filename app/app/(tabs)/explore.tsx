import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
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

type TendencyRow = {
  down: number;
  rush_rate: number;
  pass_rate: number;
};

type TeamTendenciesResponse = {
  team: string;
  tendencies: TendencyRow[];
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

export default function ExploreScreen() {
  const router = useRouter();

  // League-level data
  const [fourthData, setFourthData] = useState<FourthDownAggression[]>([]);
  const [earlyData, setEarlyData] = useState<NeutralEarlyDownPassRate[]>([]);
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [leagueError, setLeagueError] = useState<string | null>(null);
  const [showAllFourth, setShowAllFourth] = useState(false);
  const [showAllEarly, setShowAllEarly] = useState(false);

  // Team tendencies data
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [tendencies, setTendencies] = useState<TendencyRow[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingTendencies, setLoadingTendencies] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setLoadingLeague(true);
        setLoadingTeams(true);
        setLeagueError(null);
        setTeamError(null);

        const [teamRes, fourthRes, earlyRes] = await Promise.all([
          fetch(`${API_BASE_URL}/teams`),
          fetch(`${API_BASE_URL}/league/fourth_down_aggression`),
          fetch(`${API_BASE_URL}/league/neutral_early_down_pass_rate`),
        ]);

        if (!teamRes.ok) {
          throw new Error(`Failed to fetch teams: ${teamRes.status}`);
        }
        const teamJson = (await teamRes.json()) as string[];
        setTeams(teamJson);
        if (teamJson.length > 0) setSelectedTeam(teamJson[0]);

        if (!fourthRes.ok) {
          throw new Error(
            `Failed to fetch 4th-down aggression: ${fourthRes.status}`
          );
        }
        const fourthJson = (await fourthRes.json()) as FourthDownAggression[];
        setFourthData(fourthJson);

        if (!earlyRes.ok) {
          throw new Error(
            `Failed to fetch early-down pass rates: ${earlyRes.status}`
          );
        }
        const earlyJson = (await earlyRes.json()) as NeutralEarlyDownPassRate[];
        setEarlyData(earlyJson);
      } catch (err: any) {
        console.error(err);
        setLeagueError(err.message ?? "Error loading league data");
      } finally {
        setLoadingLeague(false);
        setLoadingTeams(false);
      }
    };

    fetchInitial();
  }, []);

  // Fetch tendencies when selectedTeam changes
  useEffect(() => {
    const fetchTendencies = async () => {
      if (!selectedTeam) return;
      try {
        setLoadingTendencies(true);
        setTeamError(null);
        const res = await fetch(
          `${API_BASE_URL}/teams/${selectedTeam}/tendencies`
        );
        if (!res.ok) {
          throw new Error(
            `Failed to fetch tendencies for ${selectedTeam}: ${res.status}`
          );
        }
        const json = (await res.json()) as TeamTendenciesResponse;
        setTendencies(json.tendencies);
      } catch (err: any) {
        console.error(err);
        setTeamError(err.message ?? "Error loading team tendencies");
        setTendencies(null);
      } finally {
        setLoadingTendencies(false);
      }
    };

    fetchTendencies();
  }, [selectedTeam]);

  const leagueGoRate =
    fourthData.length > 0 ? fourthData[0].league_go_rate : null;
  const leaguePassRate =
    earlyData.length > 0 ? earlyData[0].league_pass_rate : null;

  const mostAggressive = fourthData[0];
  const mostPassHeavy = earlyData[0];

  const displayedFourth = showAllFourth
    ? fourthData
    : fourthData.slice(0, 5);
  const displayedEarly = showAllEarly ? earlyData : earlyData.slice(0, 5);

  const handleRowPress = (team: string) => {
    router.push(`/team/${team}`);
  };

  const handleViewTeamPage = () => {
    if (selectedTeam) {
      router.push(`/team/${selectedTeam}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.appName}>Gridiron Analytics</Text>
        <Text style={styles.appSubtitle}>Explore 2024 league tendencies</Text>

        {/* KPIs */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Most aggressive on 4th"
            value={
              mostAggressive && leagueGoRate != null
                ? `${mostAggressive.team} · ${(mostAggressive.go_rate * 100).toFixed(
                    1
                  )}%`
                : loadingLeague
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
                : loadingLeague
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

        {loadingLeague && <ActivityIndicator style={styles.loader} />}

        {leagueError && <Text style={styles.errorText}>{leagueError}</Text>}

        {/* 4th-down Aggression */}
        {!leagueError && fourthData.length > 0 && (
          <>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>4th-Down Aggression</Text>
            <Text style={styles.sectionSubtitle}>
              4th &amp; short (1–3 yds) between the 20s. Tap a row to open that
              team’s page.
            </Text>

            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerText, { flex: 1 }]}>#</Text>
                <Text style={[styles.headerText, { flex: 2 }]}>Team</Text>
                <Text style={[styles.headerText, { flex: 2, textAlign: "right" }]}>
                  Go Rate
                </Text>
                <Text style={[styles.headerText, { flex: 2, textAlign: "right" }]}>
                  League
                </Text>
                <Text style={[styles.headerText, { flex: 2, textAlign: "right" }]}>
                  +/- Avg
                </Text>
                <Text style={[styles.headerText, { flex: 2, textAlign: "right" }]}>
                  Attempts
                </Text>
              </View>

              <FlatList
                scrollEnabled={false}
                data={displayedFourth}
                keyExtractor={(item) => item.team}
                renderItem={({ item, index }) => {
                  const goPct = (item.go_rate * 100).toFixed(1);
                  const leaguePct = (item.league_go_rate * 100).toFixed(1);
                  const diffPct = (item.aggression_index * 100).toFixed(1);
                  const diffPositive = item.aggression_index >= 0;
                  const diffColor = diffPositive ? "#16a34a" : "#ea580c";

                  return (
                    <Pressable
                      onPress={() => handleRowPress(item.team)}
                      style={styles.row}
                    >
                      <Text style={[styles.cellText, { flex: 1 }]}>
                        {index + 1}
                      </Text>
                      <Text style={[styles.cellText, { flex: 2 }]}>
                        {item.team}
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          { flex: 2, textAlign: "right", fontWeight: "600" },
                        ]}
                      >
                        {goPct}%
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          { flex: 2, textAlign: "right", color: "#6b7280" },
                        ]}
                      >
                        {leaguePct}%
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          { flex: 2, textAlign: "right", color: diffColor },
                        ]}
                      >
                        {diffPositive ? "+" : ""}
                        {diffPct}%
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          { flex: 2, textAlign: "right", color: "#6b7280" },
                        ]}
                      >
                        {item.attempts}
                      </Text>
                    </Pressable>
                  );
                }}
              />

              <Pressable
                style={styles.showMoreButton}
                onPress={() => setShowAllFourth((prev) => !prev)}
              >
                <Text style={styles.showMoreText}>
                  {showAllFourth ? "Show top 5" : "Show all teams"}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Neutral Early-Down Pass Rate */}
        {!leagueError && earlyData.length > 0 && (
          <>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>Neutral Early-Down Pass Rate</Text>
            <Text style={styles.sectionSubtitle}>
              1st/2nd &amp; 7–10 yds, between the 20s, score within ±7. Tap a
              row to open that team’s page.
            </Text>

            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerText, { flex: 1 }]}>#</Text>
                <Text style={[styles.headerText, { flex: 2 }]}>Team</Text>
                <Text style={[styles.headerText, { flex: 2, textAlign: "right" }]}>
                  Pass %
                </Text>
                <Text style={[styles.headerText, { flex: 2, textAlign: "right" }]}>
                  League
                </Text>
                <Text style={[styles.headerText, { flex: 2, textAlign: "right" }]}>
                  +/- Avg
                </Text>
                <Text style={[styles.headerText, { flex: 2, textAlign: "right" }]}>
                  Plays
                </Text>
              </View>

              <FlatList
                scrollEnabled={false}
                data={displayedEarly}
                keyExtractor={(item) => item.team}
                renderItem={({ item, index }) => {
                  const passPct = (item.pass_rate * 100).toFixed(1);
                  const leaguePct = (item.league_pass_rate * 100).toFixed(1);
                  const diffPct = (item.pass_rate_over_avg * 100).toFixed(1);
                  const diffPositive = item.pass_rate_over_avg >= 0;
                  const diffColor = diffPositive ? "#16a34a" : "#ea580c";

                  return (
                    <Pressable
                      onPress={() => handleRowPress(item.team)}
                      style={styles.row}
                    >
                      <Text style={[styles.cellText, { flex: 1 }]}>
                        {index + 1}
                      </Text>
                      <Text style={[styles.cellText, { flex: 2 }]}>
                        {item.team}
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          { flex: 2, textAlign: "right", fontWeight: "600" },
                        ]}
                      >
                        {passPct}%
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          { flex: 2, textAlign: "right", color: "#6b7280" },
                        ]}
                      >
                        {leaguePct}%
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          { flex: 2, textAlign: "right", color: diffColor },
                        ]}
                      >
                        {diffPositive ? "+" : ""}
                        {diffPct}%
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          { flex: 2, textAlign: "right", color: "#6b7280" },
                        ]}
                      >
                        {item.plays}
                      </Text>
                    </Pressable>
                  );
                }}
              />

              <Pressable
                style={styles.showMoreButton}
                onPress={() => setShowAllEarly((prev) => !prev)}
              >
                <Text style={styles.showMoreText}>
                  {showAllEarly ? "Show top 5" : "Show all teams"}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Team Tendencies section moved here */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>Team Tendencies</Text>
        <Text style={styles.sectionSubtitle}>
          Down-by-down run vs pass rates by offense.
        </Text>

        {loadingTeams ? (
          <ActivityIndicator style={styles.loader} />
        ) : teamError ? (
          <Text style={styles.errorText}>{teamError}</Text>
        ) : (
          <>
            <Text style={styles.label}>Select Team:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedTeam}
                onValueChange={(itemValue) => setSelectedTeam(itemValue)}
                style={styles.picker}
              >
                {teams.map((team) => (
                  <Picker.Item key={team} label={team} value={team} />
                ))}
              </Picker>
            </View>
          </>
        )}

        {loadingTendencies && <ActivityIndicator style={styles.loader} />}

        {tendencies && !loadingTendencies && selectedTeam && (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>
      {selectedTeam} – Visual Breakdown
    </Text>

    {tendencies.map((t) => {
      const rushPct = t.rush_rate;
      const passPct = t.pass_rate;

      return (
        <View key={t.down} style={{ marginBottom: 14 }}>
          <Text style={styles.rowDown}>Down {t.down}</Text>
          <View style={styles.barBackground}>
            <View
              style={[
                styles.barSegmentRush,
                { flex: rushPct, flexGrow: rushPct },
              ]}
            />
            <View
              style={[
                styles.barSegmentPass,
                { flex: passPct, flexGrow: passPct },
              ]}
            />
          </View>
          <View style={styles.barLabelsRow}>
            <Text style={styles.barLabelText}>
              Rush {(rushPct * 100).toFixed(1)}%
            </Text>
            <Text style={styles.barLabelText}>
              Pass {(passPct * 100).toFixed(1)}%
            </Text>
          </View>
        </View>
      );
    })}

    <View style={styles.legendRow}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: "#d4d4d8" }]} />
        <Text style={styles.legendText}>Rush</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: "#4b5563" }]} />
        <Text style={styles.legendText}>Pass</Text>
      </View>
    </View>

    <Pressable style={styles.viewTeamButton} onPress={handleViewTeamPage}>
      <Text style={styles.viewTeamButtonText}>
        View full {selectedTeam} team page →
      </Text>
    </Pressable>
  </View>
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
    marginBottom: 16,
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
    marginTop: 12,
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
  card: {
    marginTop: 4,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  headerRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  cellText: {
    fontSize: 13,
    color: "#111827",
  },
  showMoreButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  showMoreText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#2563eb",
  },
  label: {
    fontSize: 13,
    color: "#111827",
    marginBottom: 4,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    backgroundColor: "#f9fafb",
  },
  picker: {
    height: 44,
    color: "#111827",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableCellText: {
    fontSize: 13,
    color: "#111827",
  },
  viewTeamButton: {
    marginTop: 12,
  },
  viewTeamButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2563eb",
  },
  errorText: {
    color: "#b91c1c",
    marginTop: 8,
  },
  rowDown: {
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
    fontSize: 13,
  },
  barBackground: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "#e5e7eb", // light grey track
  },
  barSegmentRush: {
    backgroundColor: "#d4d4d8", // light grey
  },
  barSegmentPass: {
    backgroundColor: "#4b5563", // darker grey
  },
  barLabelsRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barLabelText: {
    fontSize: 11,
    color: "#4b5563",
  },
  legendRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 11,
    color: "#4b5563",
  },
});
