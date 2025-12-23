// app/(tabs)/index.tsx
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
  getDocs,
  QueryDocumentSnapshot,
} from "firebase/firestore";

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
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const [fourthData, setFourthData] = useState<FourthDownAggression[]>([]);
  const [earlyData, setEarlyData] = useState<NeutralEarlyDownPassRate[]>([]);
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load league metrics + teams from Firestore
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setError(null);
        setLoadingLeague(true);
        setLoadingTeams(true);

        // 4th-down aggression
        const fourthSnap = await getDocs(collection(db, "fourth_down_2024"));
        const fourth: FourthDownAggression[] = fourthSnap.docs.map(
          (d: QueryDocumentSnapshot) =>
            ({ team: d.id, ...d.data() } as FourthDownAggression)
        );
        fourth.sort(
          (a, b) => (b.aggression_index ?? 0) - (a.aggression_index ?? 0)
        );
        setFourthData(fourth);

        // neutral early-down pass rate
        const earlySnap = await getDocs(collection(db, "early_down_pass_2024"));
        const early: NeutralEarlyDownPassRate[] = earlySnap.docs.map(
          (d: QueryDocumentSnapshot) =>
            ({ team: d.id, ...d.data() } as NeutralEarlyDownPassRate)
        );
        early.sort(
          (a, b) => (b.pass_rate_over_avg ?? 0) - (a.pass_rate_over_avg ?? 0)
        );
        setEarlyData(early);

        // teams list
        const teamsSnap = await getDocs(collection(db, "team_tendencies_2024"));
        const teamIds = teamsSnap.docs.map((d) => d.id).sort();
        setTeams(teamIds);
        if (teamIds.length > 0) setSelectedTeam(teamIds[0]);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Error loading data");
      } finally {
        setLoadingLeague(false);
        setLoadingTeams(false);
      }
    };

    fetchInitial();
  }, []);

  const topAggressive = fourthData[0];
  const topPassHeavy = earlyData[0];

  const leagueGoRate =
    fourthData.length > 0 ? fourthData[0].league_go_rate : null;
  const leaguePassRate =
    earlyData.length > 0 ? earlyData[0].league_pass_rate : null;

  const handleTeamPress = (code: string) => {
    setSelectedTeam(code);
    router.push(`/team/${code}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text style={styles.appName}>Gridiron Analytics</Text>
        <Text style={styles.appSubtitle}>2024 NFL Season Snapshot</Text>

        {/* Team carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.teamScroll}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {loadingTeams && teams.length === 0 ? (
            <ActivityIndicator style={{ marginVertical: 8 }} />
          ) : (
            teams.map((code) => {
              const active = code === selectedTeam;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => handleTeamPress(code)}
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
            })
          )}
        </ScrollView>

        {/* KPI cards */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Most aggressive on 4th"
            value={
              topAggressive
                ? `${topAggressive.team} · ${(topAggressive.go_rate * 100).toFixed(
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
            label="Pass-heaviest (Neutral 1st/2nd)"
            value={
              topPassHeavy
                ? `${topPassHeavy.team} · ${(topPassHeavy.pass_rate * 100).toFixed(
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

        <View style={styles.sectionDivider} />

        {/* League overview summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>League Overview</Text>
          <Text style={styles.sectionSubtitle}>
            High-level read on how offenses approached 2024.
          </Text>

          <View style={styles.bulletGroup}>
            <Text style={styles.bulletHeading}>4th-Down Aggression</Text>
            <Text style={styles.bulletText}>
              {topAggressive
                ? `${topAggressive.team} led the league in 4th-and-short aggression, going for it on about ${(topAggressive.go_rate * 100).toFixed(
                    1
                  )}% of eligible plays compared to the league baseline near ${
                    leagueGoRate ? (leagueGoRate * 100).toFixed(1) : "52.5"
                  }%.`
                : "Top teams pushed the envelope on 4th-and-short, well above the league baseline go rate."}
            </Text>
          </View>

          <View style={styles.bulletGroup}>
            <Text style={styles.bulletHeading}>
              Neutral Early-Down Pass Rate
            </Text>
            <Text style={styles.bulletText}>
              {topPassHeavy
                ? `${topPassHeavy.team} skewed the most pass-heavy on 1st and 2nd down in neutral situations, throwing on roughly ${(topPassHeavy.pass_rate * 100).toFixed(
                    1
                  )}% of snaps versus a league average near ${
                    leaguePassRate ? (leaguePassRate * 100).toFixed(1) : "52"
                  }%.`
                : "Several offenses leaned into early-down passing, separating themselves from league-average pass rates."}
            </Text>
          </View>

          <View style={styles.bulletGroup}>
            <Text style={styles.bulletHeading}>How to Use This Site</Text>
            <Text style={styles.bulletText}>
              Use the team chips above to jump into a specific offense, or head
              to the Explore tab to dive into league-wide tables and
              down-by-down visuals.
            </Text>
          </View>
        </View>

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
  teamScroll: {
    marginBottom: 12,
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
  metricsRow: {
    flexDirection: "row",
    gap: 12,
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
  sectionDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 20,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
  bulletGroup: {
    marginBottom: 12,
  },
  bulletHeading: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  bulletText: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 19,
  },
  errorText: {
    color: "#b91c1c",
    marginTop: 8,
  },
});
