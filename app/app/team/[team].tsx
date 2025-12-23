// app/team/[team].tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

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

export default function TeamScreen() {
  const params = useLocalSearchParams<{ team?: string }>();
  const teamCode = (params.team || "").toUpperCase();

  const [tendencies, setTendencies] = useState<TendencyRow[] | null>(null);
  const [fourthRow, setFourthRow] = useState<FourthDownAggression | null>(null);
  const [earlyRow, setEarlyRow] =
    useState<NeutralEarlyDownPassRate | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // numeric metrics from Firestore
  useEffect(() => {
    if (!teamCode) return;

    const fetchMetrics = async () => {
      try {
        setLoadingMetrics(true);
        setError(null);

        const [tendSnap, fourthSnap, earlySnap] = await Promise.all([
          getDoc(doc(db, "team_tendencies_2024", teamCode)),
          getDoc(doc(db, "fourth_down_2024", teamCode)),
          getDoc(doc(db, "early_down_pass_2024", teamCode)),
        ]);

        if (tendSnap.exists()) {
          const data = tendSnap.data() as {
            team: string;
            tendencies: TendencyRow[];
          };
          setTendencies(data.tendencies ?? []);
        } else {
          setTendencies(null);
        }

        setFourthRow(
          fourthSnap.exists()
            ? ({ team: teamCode, ...fourthSnap.data() } as FourthDownAggression)
            : null
        );

        setEarlyRow(
          earlySnap.exists()
            ? ({ team: teamCode, ...earlySnap.data() } as NeutralEarlyDownPassRate)
            : null
        );
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Error loading team data");
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchMetrics();
  }, [teamCode]);

  // summary from Firestore (pre-generated & cached)
  useEffect(() => {
    if (!teamCode) return;

    const fetchSummary = async () => {
      try {
        setLoadingSummary(true);
        const snap = await getDoc(
          doc(db, "team_summaries_2024", teamCode)
        );
        if (snap.exists()) {
          const data = snap.data() as { team: string; summary: string };
          setSummary(data.summary ?? null);
        } else {
          setSummary(null);
        }
      } catch (err) {
        console.error(err);
        setSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [teamCode]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `${teamCode} · 2024 Offense` }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.pageTitle}>{teamCode} 2024 Offensive Snapshot</Text>

        {loadingSummary ? (
          <Text style={styles.summaryPlaceholder}>
            Loading scouting summary…
          </Text>
        ) : summary ? (
          <Text style={styles.summaryText}>{summary}</Text>
        ) : (
          <Text style={styles.summaryPlaceholder}>
            No summary available yet for this team.
          </Text>
        )}

        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>4th-Down Go Rate</Text>
            <Text style={styles.kpiValue}>
              {fourthRow ? `${(fourthRow.go_rate * 100).toFixed(1)}%` : "--"}
            </Text>
            {fourthRow && (
              <Text style={styles.kpiSubLabel}>
                League: {(fourthRow.league_go_rate * 100).toFixed(1)}% ·{" "}
                {((fourthRow.aggression_index ?? 0) * 100).toFixed(1)}% vs avg
              </Text>
            )}
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Neutral 1st/2nd Pass %</Text>
            <Text style={styles.kpiValue}>
              {earlyRow ? `${(earlyRow.pass_rate * 100).toFixed(1)}%` : "--"}
            </Text>
            {earlyRow && (
              <Text style={styles.kpiSubLabel}>
                League: {(earlyRow.league_pass_rate * 100).toFixed(1)}% ·{" "}
                {((earlyRow.pass_rate_over_avg ?? 0) * 100).toFixed(1)}% vs avg
              </Text>
            )}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <Text style={styles.sectionTitle}>Down-by-Down Tendencies</Text>
        <Text style={styles.sectionSubtitle}>
          Share of runs vs passes on each down.
        </Text>

        {loadingMetrics ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : tendencies && tendencies.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { flex: 1 }]}>Down</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>Rush %</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>Pass %</Text>
            </View>

            <FlatList
              data={tendencies}
              keyExtractor={(item) => item.down.toString()}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const rushPct = (item.rush_rate * 100).toFixed(1);
                const passPct = (item.pass_rate * 100).toFixed(1);
                return (
                  <View style={styles.tableRow}>
                    <Text style={[styles.cellText, { flex: 1 }]}>
                      {item.down}
                    </Text>
                    <Text style={[styles.cellText, { flex: 1 }]}>
                      {rushPct}%
                    </Text>
                    <Text style={[styles.cellText, { flex: 1 }]}>
                      {passPct}%
                    </Text>
                  </View>
                );
              }}
            />
          </View>
        ) : (
          <Text style={styles.summaryPlaceholder}>No play data found.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
    marginBottom: 16,
  },
  summaryPlaceholder: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
    marginBottom: 16,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kpiValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  kpiSubLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 20,
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
  card: {
    marginTop: 8,
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
    paddingBottom: 6,
    marginBottom: 4,
  },
  headerCell: {
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
  cellText: {
    fontSize: 13,
    color: "#111827",
  },
  errorText: {
    color: "#b91c1c",
    marginTop: 8,
  },
});
