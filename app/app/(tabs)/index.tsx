import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  FlatList,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";

type TendencyRow = {
  down: number;
  rush_rate: number; // 0–1
  pass_rate: number; // 0–1
};

type TeamTendenciesResponse = {
  team: string;
  tendencies: TendencyRow[];
};

// For Expo web on the same machine, this is fine.
// For a real device, change this to your Mac's LAN IP, e.g. "http://192.168.1.23:8000"
const API_BASE_URL = "http://127.0.0.1:8000";

export default function App() {
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [tendencies, setTendencies] = useState<TendencyRow[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingTendencies, setLoadingTendencies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch list of teams on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoadingTeams(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/teams`);
        if (!res.ok) {
          throw new Error(`Failed to fetch teams: ${res.status}`);
        }
        const data = (await res.json()) as string[];
        setTeams(data);
        if (data.length > 0) {
          setSelectedTeam(data[0]); // default to first team
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Error fetching teams");
      } finally {
        setLoadingTeams(false);
      }
    };

    fetchTeams();
  }, []);

  // Fetch tendencies whenever selectedTeam changes
  useEffect(() => {
    const fetchTendencies = async () => {
      if (!selectedTeam) return;
      try {
        setLoadingTendencies(true);
        setError(null);
        const res = await fetch(
          `${API_BASE_URL}/teams/${selectedTeam}/tendencies`
        );
        if (!res.ok) {
          throw new Error(
            `Failed to fetch tendencies for ${selectedTeam}: ${res.status}`
          );
        }
        const data = (await res.json()) as TeamTendenciesResponse;
        setTendencies(data.tendencies);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Error fetching tendencies");
        setTendencies(null);
      } finally {
        setLoadingTendencies(false);
      }
    };

    fetchTendencies();
  }, [selectedTeam]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Gridiron Analytics</Text>
      <Text style={styles.subtitle}>2024 NFL Run vs Pass by Down</Text>

      {loadingTeams ? (
        <ActivityIndicator style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
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

      {tendencies && !loadingTendencies && (
        <>
          {/* Table view */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {selectedTeam} – Down-by-Down Tendencies
            </Text>
            <FlatList
              data={tendencies}
              keyExtractor={(item) => item.down.toString()}
              renderItem={({ item }) => {
                const rushPct = (item.rush_rate * 100).toFixed(1);
                const passPct = (item.pass_rate * 100).toFixed(1);
                return (
                  <View style={styles.row}>
                    <Text style={styles.rowDown}>Down {item.down}</Text>
                    <Text style={styles.rowText}>Rush: {rushPct}%</Text>
                    <Text style={styles.rowText}>Pass: {passPct}%</Text>
                  </View>
                );
              }}
            />
          </View>

          {/* Simple custom bar chart */}
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Visual Breakdown</Text>
            {tendencies.map((row) => {
              const rushPct = row.rush_rate * 100;
              const passPct = row.pass_rate * 100;
              return (
                <View key={row.down} style={styles.chartRow}>
                  <Text style={styles.chartDown}>Down {row.down}</Text>
                  <View style={styles.chartBars}>
                    <View
                      style={[
                        styles.chartBarRush,
                        { flex: row.rush_rate || 0.001 },
                      ]}
                    />
                    <View
                      style={[
                        styles.chartBarPass,
                        { flex: row.pass_rate || 0.001 },
                      ]}
                    />
                  </View>
                  <View style={styles.chartLabels}>
                    <Text style={styles.chartLabelText}>
                      Rush {rushPct.toFixed(1)}%
                    </Text>
                    <Text style={styles.chartLabelText}>
                      Pass {passPct.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              );
            })}

            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={styles.legendSwatchRush} />
                <Text style={styles.legendText}>Rush</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.legendSwatchPass} />
                <Text style={styles.legendText}>Pass</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    backgroundColor: "#050816",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 16,
  },
  loader: {
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    color: "#e5e7eb",
    marginBottom: 4,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: "#111827",
  },
  picker: {
    height: 44,
    color: "#e5e7eb",
  },
  card: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f9fafb",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  rowDown: {
    fontWeight: "600",
    color: "#e5e7eb",
    width: 80,
  },
  rowText: {
    color: "#9ca3af",
  },
  errorText: {
    color: "#f87171",
    marginTop: 8,
  },
  chartCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  chartRow: {
    marginBottom: 12,
  },
  chartDown: {
    color: "#e5e7eb",
    marginBottom: 4,
    fontWeight: "600",
  },
  chartBars: {
    flexDirection: "row",
    height: 12,
    borderRadius: 9999,
    overflow: "hidden",
    backgroundColor: "#1f2937",
  },
  chartBarRush: {
    backgroundColor: "#60a5fa", // blue
  },
  chartBarPass: {
    backgroundColor: "#f97316", // orange
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  chartLabelText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  chartLegend: {
    flexDirection: "row",
    marginTop: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendSwatchRush: {
    width: 12,
    height: 12,
    borderRadius: 9999,
    backgroundColor: "#60a5fa",
    marginRight: 6,
  },
  legendSwatchPass: {
    width: 12,
    height: 12,
    borderRadius: 9999,
    backgroundColor: "#f97316",
    marginRight: 6,
  },
  legendText: {
    color: "#e5e7eb",
    fontSize: 12,
  },
});
