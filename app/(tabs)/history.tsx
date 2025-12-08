import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { DateTime } from "luxon";

const API_URL = Constants.expoConfig.extra.apiUrl;

const METRICS = [
  { key: "weight", label: "Weight", type: "absolute", premium: false },
  { key: "bmi", label: "BMI", type: "absolute", premium: false },
  { key: "fat_percent", label: "Fat %", type: "percent", premium: false },
  { key: "fat_mass", label: "Fat Ibs", type: "absolute", premium: true },
  { key: "skeletal_muscle_percent", label: "Muscle %", type: "percent", premium: true },
  { key: "skeletal_muscle_pounds", label: "Muscle lbs", type: "absolute", premium: true },
];

export default function MetricsHistory() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const router = useRouter();

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const saved = await AsyncStorage.getItem("user");
      if (!saved) return;

      const parsed = JSON.parse(saved);
      setUserId(parsed.id.toString());
      setIsPremium(parsed.is_premium || false);

      const res = await fetch(`${API_URL}/metrics/${parsed.id}`);
      const data = await res.json();

      if (res.ok) {
        const sorted = data.metrics?.sort(
          (a: any, b: any) =>
            new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
        );
        setMetrics(sorted);
      } else {
        console.error("❌ Failed to fetch metrics:", data.detail);
      }
    } catch (err) {
      console.error("❌ Error fetching metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMetrics();
    }, [])
  );

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Metric?",
      "This action cannot be undone. Do you want to delete this record?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/metrics/${id}`, {
                method: "DELETE",
              });

              if (res.ok) {
                setMetrics((prev) => prev.filter((m) => m.id !== id));
              } else {
                Alert.alert("Error", "Could not delete this metric.");
              }
            } catch (err) {
              console.error("❌ Delete error:", err);
              Alert.alert("Error", "Failed to delete metric.");
            }
          },
        },
      ]
    );
  };


  const formatLocalDate = (isoString: string) => {
    return DateTime.fromISO(isoString, { zone: "utc" })
      .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#22d3ee" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>📊 Your Progress History</Text>

        {metrics.length === 0 && (
          <Text style={styles.emptyText}>No metrics recorded yet.</Text>
        )}

        {metrics.map((m) => (
          <View key={m.id} style={styles.card}>
            <Text style={styles.date}>{formatLocalDate(m.taken_at)}</Text>

            <View style={styles.metricsGrid}>
              {METRICS.map((metric) => {
                const value = m[metric.key];
                if (value == null) return null;

                const isLocked = metric.premium && !isPremium;

                return (
                  <View key={metric.key} style={styles.metricTile}>
                    <Text style={styles.metricTileLabel}>{metric.label}</Text>
                    {isLocked ? (
                      <View style={{ position: "relative", alignItems: "center", justifyContent: "center", height: 28, marginTop: 4 }}>
                        {[...Array(6)].map((_, i) => (
                          <View
                            key={i}
                            style={{
                              position: "absolute",
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: "rgba(0,0,0,0.5)",
                              blurRadius: 10,
                              transform: [
                                { translateX: (Math.random() - 0.5) * 12 },
                                { translateY: (Math.random() - 0.5) * 12 },
                              ],
                            }}
                          />
                        ))}
                        <Text style={[styles.metricTileValue, { opacity: 0 }]}>
                          {metric.type === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.metricTileValue}>
                        {metric.type === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#dc2626" }]}
                onPress={() => handleDelete(m.id)}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#ffffffff" }]}
                onPress={() =>
                  router.push({
                    pathname: "/editmetric",
                    params: { metric: JSON.stringify(m) },
                  })
                }
              >
                <Text style={styles.buttonEditText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1f1f1f" },
  container: { padding: 16, backgroundColor: "#1f1f1f", flexGrow: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1f1f1f" },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  emptyText: { color: "#9ca3af", textAlign: "center", marginTop: 40 },
  card: { backgroundColor: "#2c2c2c", borderRadius: 12, padding: 16, marginBottom: 16 },
  date: { color: "#d1d5db", fontWeight: "600", marginBottom: 12, fontSize: 14, textAlign: "center" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  metricTile: { width: "48%", backgroundColor: "#2c2c2c", paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, marginBottom: 12, position: "relative" },
  metricTileLabel: { color: "#9ca3af", fontSize: 13, fontWeight: "500", marginBottom: 6, textAlign: "center" },
  metricTileValue: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  button: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", flex: 1, marginHorizontal: 4 },
  buttonText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  buttonEditText: { fontWeight: "600", fontSize: 14, color: "#060000ff" },
});
