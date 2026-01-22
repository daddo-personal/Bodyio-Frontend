import React, { useState, useCallback, useRef } from "react";
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
import { Swipeable, RectButton } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

// inside MetricsHistory component

const API_URL = Constants.expoConfig.extra.apiUrl;

const METRICS = [
  { key: "weight", label: "Weight", type: "absolute", premium: false },
  { key: "bmi", label: "BMI", type: "absolute", premium: false },
  { key: "fat_percent", label: "Fat %", type: "percent", premium: false },
  // { key: "fat_mass", label: "Fat Ibs", type: "absolute", premium: true },
  { key: "skeletal_muscle_percent", label: "Muscle %", type: "percent", premium: false },
  // { key: "skeletal_muscle_pounds", label: "Muscle lbs", type: "absolute", premium: true },
];

export default function MetricsHistory() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");
  const router = useRouter();
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [showSwipeTipHistory, setShowSwipeTipHistory] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const saved = await AsyncStorage.getItem("user");
      if (!saved) return;

      const parsed = JSON.parse(saved);
      const dataRes = await fetch(`${API_URL}/users/${parsed.id}`);

      if (dataRes.ok) {
        const data = await dataRes.json();
        setIsPremium(data.is_premium || false);
      }

      setUserId(parsed.id.toString());
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
      let isActive = true;

      async function maybeShowHistorySwipeTip() {
        // only show when there is actual history to swipe
        if (metrics.length === 0) return;

        const seen = await AsyncStorage.getItem("seen_swipe_tip_history");
        if (!seen && isActive) setShowSwipeTipHistory(true);
      }

      maybeShowHistorySwipeTip();

      return () => {
        isActive = false;
      };
    }, [metrics.length])
  );

  useFocusEffect(
    useCallback(() => {
      async function loadUnit() {
        const saved = await AsyncStorage.getItem("weight_unit");
        if (saved === "kg" || saved === "lbs") {
          setWeightUnit(saved);
        }
      }
      loadUnit();
    }, [])
  );

  const formatWeight = (lbsValue: number) => {
    if (weightUnit === "kg") {
      return (lbsValue / 2.20462).toFixed(1) + " kg";
    }
    return lbsValue.toFixed(1) + " lbs";
  };

  useFocusEffect(
    useCallback(() => {
      fetchMetrics();
    }, [])
  );

  const goEdit = (metricObj: any) => {
    router.push({
      pathname: "/editmetric",
      params: { metric: JSON.stringify(metricObj) },
    });
  };

  const confirmDelete = (id: string) => {
    handleDelete(id); // your existing Alert + delete logic
  };

  const renderLeftActions = (item: any, height?: number) => {
    return (
      <View style={[styles.swipeActionLeftWrap, height ? { height } : null]}>
        <RectButton style={[styles.swipeActionButton, styles.swipeEdit]} onPress={() => goEdit(item)}>
          <Ionicons name="create" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Edit</Text>
        </RectButton>
      </View>
    );
  };

  const renderRightActions = (item: any, height?: number) => {
    return (
      <View style={[styles.swipeActionRightWrap, height ? { height } : null]}>
        <RectButton
          style={[styles.swipeActionButton, styles.swipeDelete]}
          onPress={() => confirmDelete(item.id)}
        >
          <Ionicons name="trash" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </RectButton>
      </View>
    );
  };


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

  // --------------------------
  // 🔐 PREMIUM LOCK SCREEN
  // --------------------------
  if (!loading && !isPremium) {
    return (
      <SafeAreaView style={styles.lockWrapper}>
        <View style={styles.lockContent}>
          <Text style={styles.lockTitle}>Unlock Your History</Text>

          <Text style={styles.lockSubtitle}>
            Upgrade to Premium to view and edit your full progress history.
          </Text>

          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push("/settings")}
          >
            <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

        {showSwipeTipHistory && metrics.length > 0 && (

          <View style={styles.swipeTip}>
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
            <Text style={styles.swipeTipText}>
              Tip: Swipe right to edit • Swipe left to delete
            </Text>

            <TouchableOpacity
              onPress={async () => {
                await AsyncStorage.setItem("seen_swipe_tip_history", "true");
                setShowSwipeTipHistory(false);
              }}
              style={styles.swipeTipBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.swipeTipBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        )}


        {metrics.length === 0 && (
          <Text style={styles.emptyText}>No metrics recorded yet.</Text>
        )}

        {metrics.map((m) => {
          const rowH = rowHeights[m.id];

          return (
            <View key={m.id} style={styles.rowWrap}>
              <Swipeable
                renderLeftActions={() => renderLeftActions(m, rowH)}
                renderRightActions={() => renderRightActions(m, rowH)}
                overshootLeft={false}
                overshootRight={false}
              >
                <View
                  style={styles.card}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    setRowHeights((prev) => (prev[m.id] === h ? prev : { ...prev, [m.id]: h }));
                  }}
                >
                  <Text style={styles.date}>{formatLocalDate(m.taken_at)}</Text>

                  <View style={styles.metricsGrid}>
                    {METRICS.map((metric) => {
                      const value = m[metric.key];
                      if (value == null) return null;

                      return (
                        <View key={metric.key} style={styles.metricTile}>
                          <Text style={styles.metricTileLabel}>{metric.label}</Text>
                          <Text style={styles.metricTileValue}>
                            {metric.key === "weight"
                              ? formatWeight(value)
                              : metric.type === "percent"
                                ? `${value.toFixed(1)}%`
                                : value.toFixed(1)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Swipeable>
            </View>
          );
        })}

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
  lockWrapper: {
    flex: 1,
    backgroundColor: "#1f1f1f",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockContent: {
    alignItems: "center",
  },
  lockTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },
  lockSubtitle: {
    color: "#9ca3af",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: "#ffffffff",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  upgradeButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
  swipeActionLeftWrap: {
    justifyContent: "center",
    alignItems: "flex-start",
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
  },

  swipeActionRightWrap: {
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
  },

  swipeActionButton: {
    width: 120,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 18, // better than height:"100%" for Android
  },

  swipeEdit: { backgroundColor: "#2563eb" },   // blue
  swipeDelete: { backgroundColor: "#dc2626" }, // red

  swipeActionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  rowWrap: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden", // 👈 makes swipe bg + card share same rounding
  },

  card: {
    backgroundColor: "#2c2c2c",
    borderRadius: 0,
    padding: 16,
    marginBottom: 0,
  },

  swipeTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 14,
  },

  swipeTipText: {
    flex: 1,
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
  },

  swipeTipBtn: {
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },

  swipeTipBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 12,
  },

});
