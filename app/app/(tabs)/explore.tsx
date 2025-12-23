// app/(tabs)/explore.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { db } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  QueryDocumentSnapshot,
} from "firebase/firestore";

type TendencyRow = {
  down: number;
  rush_rate: number;
  pass_rate: number;
};

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

export default function ExploreScreen() {
  const router = useRouter();

  const [fourthData, setFourthData] = useState<FourthDownAggression[]>([]);
  const [earlyData, setEarlyData] = useState<NeutralEarlyDownPassRate[]>([]);
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAllFourth, setShowAllFourth] = useState(false);
  const [showAllEarly, setShowAllEarly] = useState(false);

  // team tendencies
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [tendencies, setTendencies] = useState<TendencyRow[] | null>(null);
  const [loadingTendencies, setLoadingTendencies] = useState(false);

  useEffect(() => {
    const fetchLeague = async () => {
      try {
        setError(null);
        setLoadingLeague(true);

        const fourthSnap = await getDocs(collection(db, "fourth_down_2024"));
        const fourth: FourthDownAggression[] = fourthSnap.docs.map(
          (d: QueryDocumentSnapshot) =>
            ({ team: d.id, ...d.data() } as FourthDownAggression)
        );
        fourth.sort(
          (a, b) => (b.aggression_index ?? 0) - (a.aggression_index ?? 0)
        );
        setFourthData(fourth);

        const earlySnap = await getDocs(collection(db, "early_down_pass_2024"));
        const early: NeutralEarlyDownPassRate[] = earlySnap.docs.map(
          (d: QueryDocumentSnapshot) =>
            ({ team: d.id, ...d.data() } as NeutralEarlyDownPassRate)
        );
        early.sort(
          (a, b) => (b.pass_rate_over_avg ?? 0) - (a.pass_rate_over_avg ?? 0)
        );
        setEarlyData(early);

        const teamsSnap = await getDocs(collection(db, "team_tendencies_2024"));
        const ids = teamsSnap.docs.map((d) => d.id).sort();
        setTeams(ids);
        if (ids.length > 0) setSelectedTeam(ids[0]);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Error loading league data");
      } finally {
        setLoadingLeague(false);
      }
    };

    fetchLeague();
  }, []);

  useEffect(() => {
    const fetchTendencies = async () => {
      if (!selectedTeam) return;
      try {
        setLoadingTendencies(true);
        const snap = await getDoc(
          doc(db, "team_tendencies_2024", selectedTeam)
        );
        if (!snap.exists()) {
          setTendencies(null);
          return;
        }
        const data = snap.data() as { team: string; tendencies: TendencyRow[] };
        setTendencies(data.tendencies ?? []);
      } catch (err) {
        console.error(err);
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

  const visibleFourth = showAllFourth ? fourthData : fourthData.slice(0, 5);
  const visibleEarly = showAllEarly ? earlyData : earlyData.slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text style={styles.appName}>Gridiron Analytics</Text>
        <Text style={styles.appSubtitle}>2024 NFL Run vs Pass by Down</Text>

        {/* KPI row reused for context */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Most aggressive on 4th</Text>
            <Text style={styles.metricValue}>
              {fourthData[0]
                ? `${fourthData[0].team} · ${(fourthData[0].go_rate * 100).toFixed(
                    1
                  )}%`
                : loadingLeague
                ? "Loading..."
                : "--"}
            </Text>
            {leagueGoRate != null && (
              <Text style={styles.metricSubLabel}>
                League avg: {(leagueGoRate * 100).toFixed(1)}%
              </Text>
            )}
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>
              Pass-heaviest (Neutral 1st/2nd)
            </Text>
            <Text style={styles.metricValue}>
              {earlyData[0]
                ? `${earlyData[0].team} · ${(earlyData[0].pass_rate * 100).toFixed(
                    1
                  )}%`
                : loadingLeague
                ? "Loading..."
                : "--"}
            </Text>
            {leaguePassRate != null && (
              <Text style={styles.metricSubLabel}>
                League avg: {(leaguePassRate * 100).toFixed(1)}%
              </Text>
            )}
          </View>
        </View>

        {/* 4th-down table */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>4th-Down Aggression</Text>
          <TouchableOpacity
            onPress={() => setShowAllFourth((prev) => !prev)}
          >
            <Text style={styles.showMoreText}>
              {showAllFourth ? "Show top 5" : "Show all"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSubtitle}>
          4th &amp; short (1–3 yards) between the 20s.
        </Text>

        {loadingLeague && fourthData.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : (
          <View style={styles.card}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { flex: 0.6 }]}>#</Text>
              <Text style={[styles.headerCell, { flex: 1.2 }]}>Team</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>Go Rate</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>League</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>+/- Avg</Text>
              <Text style={[styles.headerCell, { flex: 0.8 }]}>Att</Text>
            </View>
            {visibleFourth.map((row, idx) => (
              <View style={styles.tableRow} key={row.team}>
                <Text style={[styles.cellText, { flex: 0.6 }]}>{idx + 1}</Text>
                <Text style={[styles.cellText, { flex: 1.2 }]}>{row.team}</Text>
                <Text style={[styles.cellText, { flex: 1 }]}>
                  {(row.go_rate * 100).toFixed(1)}%
                </Text>
                <Text style={[styles.cellText, { flex: 1 }]}>
                  {(row.league_go_rate * 100).toFixed(1)}%
                </Text>
                <Text
                  style={[
                    styles.cellText,
                    { flex: 1, color: row.aggression_index >= 0 ? "#15803d" : "#b91c1c" },
                  ]}
                >
                  {((row.aggression_index ?? 0) * 100).toFixed(1)}%
                </Text>
                <Text style={[styles.cellText, { flex: 0.8 }]}>
                  {row.attempts}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Early-down pass table */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Neutral Early-Down Pass Rate</Text>
          <TouchableOpacity onPress={() => setShowAllEarly((prev) => !prev)}>
            <Text style={styles.showMoreText}>
              {showAllEarly ? "Show top 5" : "Show all"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSubtitle}>
          1st/2nd &amp; 7–10 yards, between the 20s, score within ±7.
        </Text>

        {loadingLeague && earlyData.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : (
          <View style={styles.card}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { flex: 0.6 }]}>#</Text>
              <Text style={[styles.headerCell, { flex: 1.2 }]}>Team</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>Pass %</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>League</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>+/- Avg</Text>
              <Text style={[styles.headerCell, { flex: 0.8 }]}>Plays</Text>
            </View>
            {visibleEarly.map((row, idx) => (
              <View style={styles.tableRow} key={row.team}>
                <Text style={[styles.cellText, { flex: 0.6 }]}>{idx + 1}</Text>
                <Text style={[styles.cellText, { flex: 1.2 }]}>{row.team}</Text>
                <Text style={[styles.cellText, { flex: 1 }]}>
                  {(row.pass_rate * 100).toFixed(1)}%
                </Text>
                <Text style={[styles.cellText, { flex: 1 }]}>
                  {(row.league_pass_rate * 100).toFixed(1)}%
                </Text>
                <Text
                  style={[
                    styles.cellText,
                    { flex: 1, color: row.pass_rate_over_avg >= 0 ? "#15803d" : "#b91c1c" },
                  ]}
                >
                  {((row.pass_rate_over_avg ?? 0) * 100).toFixed(1)}%
                </Text>
                <Text style={[styles.cellText, { flex: 0.8 }]}>
                  {row.plays}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionDivider} />

        {/* Team tendencies + visual breakdown */}
        <Text style={styles.sectionTitle}>Team Tendencies</Text>
        <Text style={styles.sectionSubtitle}>
          Down-by-down run vs pass splits, plus league markers.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.teamScroll}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {teams.map((code) => {
            const active = code === selectedTeam;
            return (
              <TouchableOpacity
                key={code}
                onPress={() => setSelectedTeam(code)}
                style={[
                  styles.teamChip,
                  active && styles.teamChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.teamChipText,
                    active && styles.teamChipTextActive,
                  ]}
                >
                  {code}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loadingTendencies && <ActivityIndicator style={{ marginTop: 8 }} />}

        {tendencies && !loadingTendencies && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {selectedTeam} – Visual Breakdown
            </Text>
            {tendencies.map((t) => {
              const rushPct = t.rush_rate;
              const passPct = t.pass_rate;
              const leaguePass = leaguePassRate ?? 0.518;
              const leagueRush = 1 - leaguePass;
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
                    {/* league markers */}
                    <View
                      style={[
                        styles.leagueMarker,
                        { left: `${leagueRush * 100}%` },
                      ]}
                    />
                    <View
                      style={[
                        styles.leagueMarker,
                        { left: `${leaguePass * 100}%` },
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
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: "#e5e5e5" },
                  ]}
                />
                <Text style={styles.legendText}>Rush</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: "#4b5563" },
                  ]}
                />
                <Text style={styles.legendText}>Pass</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.leagueLegendLine,
                    { backgroundColor: "#111827" },
                  ]}
                />
                <Text style={styles.legendText}>League markers</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() =>
                selectedTeam && router.push(`/team/${selectedTeam}`)
              }
            >
              <Text style={styles.linkText}>
                View full {selectedTeam} team page →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
  },
  appSubtitle: {
    fontSize: 14,
    color: "#4b5563",
    marginTop: 4,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
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
    letterSpacing: 0.8,
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
    color: "#9ca3af",
  },
  sectionHeaderRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
    marginBottom: 8,
  },
  showMoreText: {
    fontSize: 13,
    color: "#2563eb",
  },
  card: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 4,
    marginBottom: 4,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: "600",
    color: "#111827",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  cellText: {
    fontSize: 12,
    color: "#111827",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 20,
  },
  teamScroll: {
    marginBottom: 8,
  },
  teamChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginRight: 8,
    backgroundColor: "#ffffff",
  },
  teamChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  teamChipText: {
    fontSize: 13,
    color: "#111827",
  },
  teamChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10,
  },
  rowDown: {
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  barBackground: {
    position: "relative",
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
  },
  barSegmentRush: {
    backgroundColor: "#e5e5e5",
  },
  barSegmentPass: {
    backgroundColor: "#4b5563",
  },
  leagueMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#111827",
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
    marginTop: 10,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
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
  leagueLegendLine: {
    width: 14,
    height: 2,
  },
  legendText: {
    fontSize: 11,
    color: "#4b5563",
  },
  linkRow: {
    marginTop: 12,
  },
  linkText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "500",
  },
  errorText: {
    color: "#b91c1c",
    marginTop: 8,
  },
});
