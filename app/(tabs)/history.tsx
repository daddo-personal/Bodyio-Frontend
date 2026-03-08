import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { DateTime } from "luxon";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

const API_URL = Constants.expoConfig?.extra?.apiUrl;

const METRICS = [
  { key: "weight", label: "Weight", type: "absolute" },
  { key: "bmi", label: "BMI", type: "absolute" },
  { key: "fat_percent", label: "Fat %", type: "percent" },
  { key: "skeletal_muscle_percent", label: "Muscle %", type: "percent" },
];

export default function MetricsHistory() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");
  const [showSwipeTipHistory, setShowSwipeTipHistory] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<any> | null>(null);

  const router = useRouter();
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glowAnims = useRef<Record<string, Animated.Value>>({});

  const getGlowAnim = (id: string) => {
    if (!glowAnims.current[id]) {
      glowAnims.current[id] = new Animated.Value(0);
    }
    return glowAnims.current[id];
  };

  const startGlow = (id: string) => {
    const anim = getGlowAnim(id);
    anim.setValue(0);
    setHighlightedId(id);

    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: 650,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(anim, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: 650,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start(() => {
      setHighlightedId((prev) => (prev === id ? null : prev));
    });
  };

  const showBanner = (message: string) => {
    setBanner(message);

    if (bannerTimer.current) {
      clearTimeout(bannerTimer.current);
    }

    bannerTimer.current = setTimeout(() => {
      setBanner(null);
      bannerTimer.current = null;
    }, 1800);
  };

  const maybeHighlightEditedMetric = async (loadedMetrics: any[]) => {
    try {
      const storedId = await AsyncStorage.getItem("highlight_metric_id");
      if (!storedId) return;

      const index = loadedMetrics.findIndex((m) => String(m.id) === storedId);
      await AsyncStorage.removeItem("highlight_metric_id");

      if (index === -1) return;

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.35,
        });

        setTimeout(() => {
          startGlow(storedId);
        }, 450);
      });
    } catch (err) {
      console.error("❌ Highlight scroll error:", err);
    }
  };

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const saved = await AsyncStorage.getItem("user");
      if (!saved) return;

      const parsed = JSON.parse(saved);

      const dataRes = await fetch(`${API_URL}/users/${parsed.id}`);
      if (dataRes.ok) {
        const data = await dataRes.json();
        setIsPremium(Boolean(data.is_premium));
      }

      const res = await fetch(`${API_URL}/metrics/${parsed.id}`);
      const data = await res.json();

      if (res.ok) {
        const sorted = (data.metrics || []).sort(
          (a: any, b: any) =>
            new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
        );

        setMetrics(sorted);
        await maybeHighlightEditedMetric(sorted);
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

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function maybeShowHistorySwipeTip() {
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

  const formatLocalDate = (isoString: string) => {
    return DateTime.fromISO(isoString, { zone: "utc" })
      .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
  };

  const goEdit = (metricObj: any) => {
    router.push({
      pathname: "/editmetric",
      params: { metric: JSON.stringify(metricObj) },
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Metric?",
      "This action cannot be undone. Do you want to delete this record?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => swipeRefs.current[id]?.close(),
        },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              swipeRefs.current[id]?.close();

              const res = await fetch(`${API_URL}/metrics/${id}`, {
                method: "DELETE",
              });

              if (res.ok) {
                setMetrics((prev) => prev.filter((m) => String(m.id) !== id));
                delete swipeRefs.current[id];
                showBanner("Metric deleted");
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

  const renderItem = ({ item }: { item: any }) => {
    const id = String(item.id);
    const glowAnim = getGlowAnim(id);
    const isGlowing = highlightedId === id;

    return (
      <Animated.View
        style={[
          styles.glowWrap,
          isGlowing && {
            shadowColor: "#16a34a",
            shadowOpacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.15, 0.8],
            }),
            shadowRadius: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [2, 18],
            }),
            shadowOffset: { width: 0, height: 0 },
            borderColor: "#16a34a",
            borderWidth: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 2],
            }),
          },
        ]}
      >
        <View style={styles.rowWrap}>
          <Swipeable
            ref={(ref) => {
              swipeRefs.current[id] = ref;
            }}
            renderLeftActions={() => (
              <View style={styles.swipeActionLeftWrap}>
                <RectButton
                  style={[styles.swipeActionButton, styles.swipeEdit]}
                  onPress={() => goEdit(item)}
                >
                  <Ionicons name="create" size={22} color="#fff" />
                  <Text style={styles.swipeActionText}>Edit</Text>
                </RectButton>
              </View>
            )}
            renderRightActions={() => (
              <View style={styles.swipeActionRightWrap}>
                <RectButton
                  style={[styles.swipeActionButton, styles.swipeDelete]}
                  onPress={() => handleDelete(id)}
                >
                  <Ionicons name="trash" size={22} color="#fff" />
                  <Text style={styles.swipeActionText}>Delete</Text>
                </RectButton>
              </View>
            )}
            overshootLeft={false}
            overshootRight={false}
          >
            <View style={styles.card}>
              <Text style={styles.date}>{formatLocalDate(item.taken_at)}</Text>

              <View style={styles.metricsGrid}>
                {METRICS.map((metric) => {
                  const value = item[metric.key];
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
      </Animated.View>
    );
  };

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
      {banner && (
        <View style={styles.banner}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={metrics}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.container}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewPosition: 0.35,
            });
          }, 350);
        }}
        ListHeaderComponent={
          <>
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
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No metrics recorded yet.</Text>
        }
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1f1f1f" },
  container: { padding: 16, backgroundColor: "#1f1f1f", flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1f1f1f",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    backgroundColor: "#16a34a",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginTop: 10,
    marginBottom: 4,
  },
  bannerText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  emptyText: { color: "#9ca3af", textAlign: "center", marginTop: 40 },

  glowWrap: {
    borderRadius: 14,
    marginBottom: 16,
  },

  rowWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },

  card: {
    backgroundColor: "#2c2c2c",
    padding: 16,
  },

  date: {
    color: "#d1d5db",
    fontWeight: "600",
    marginBottom: 12,
    fontSize: 14,
    textAlign: "center",
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  metricTile: {
    width: "48%",
    backgroundColor: "#2c2c2c",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
  },

  metricTileLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
    textAlign: "center",
  },

  metricTileValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  swipeActionLeftWrap: {
    justifyContent: "center",
    alignItems: "flex-start",
    borderRadius: 12,
    overflow: "hidden",
  },

  swipeActionRightWrap: {
    justifyContent: "center",
    alignItems: "flex-end",
    borderRadius: 12,
    overflow: "hidden",
  },

  swipeActionButton: {
    width: 120,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 18,
  },

  swipeEdit: { backgroundColor: "#2563eb" },
  swipeDelete: { backgroundColor: "#dc2626" },

  swipeActionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  lockWrapper: {
    flex: 1,
    backgroundColor: "#1f1f1f",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  lockContent: { alignItems: "center" },

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
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },

  upgradeButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
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