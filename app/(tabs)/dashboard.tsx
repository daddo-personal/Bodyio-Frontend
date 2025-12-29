// 📊 DashboardScreen.tsx (updated chart setup with daily averaging)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Purchases from "react-native-purchases";
import { Animated, Easing } from "react-native";

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

const API_URL = Constants.expoConfig.extra.apiUrl;
const MAX_FREE_SCANS = 5
// ----------------------
// Helpers
// ----------------------
const safe = (v: any) => (typeof v === "number" ? v.toFixed(2) : "—");
const LOCK_BLUR_OFFSETS = [
  { x: -8, y: -4 },
  { x: 4, y: -6 },
  { x: -6, y: 6 },
  { x: 6, y: 4 },
  { x: 2, y: -2 },
  { x: -2, y: 2 },
];

const METRICS = [
  { key: "weight", label: "Weight", type: "absolute", premium: false },
  { key: "bmi", label: "BMI", type: "absolute", premium: false },
  // { key: "fat_mass", label: "Fat Ibs", type: "absolute", premium: true },
  { key: "fat_percent", label: "Fat %", type: "percent", premium: true },
  { key: "skeletal_muscle_percent", label: "Muscle %", type: "percent", premium: true },
  // { key: "skeletal_muscle_pounds", label: "Muscle lbs", type: "absolute", premium: true },
];

export default function DashboardScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const formatLongDate = (isoString: string) => {
    return DateTime.fromISO(isoString).toFormat("LLLL d, yyyy");
  };
  // ----------------------
  // States
  // ----------------------
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [shouldGlow, setShouldGlow] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [isPremium, setIsPremium] = useState<boolean>(false);

  const [recent, setRecent] = useState<any | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [trend, setTrend] = useState<number>(0);
  const [metric, setMetric] = useState("weight");
  const [range, setRange] = useState("ytd");
  const [loading, setLoading] = useState(true);
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");

  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [goalProgress, setGoalProgress] = useState<any | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const startGlow = () => {
    Animated.sequence([
      // Pulse 1
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }),

      // Pulse 2
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Turn off glow after animation
      setShouldGlow(false);
    });
  };

  useFocusEffect(
    useCallback(() => {
      async function checkGlowFlag() {
        const flag = await AsyncStorage.getItem("highlight_recent");
        if (flag === "true") {
          setShouldGlow(true);
          startGlow();
          await AsyncStorage.removeItem("highlight_recent");
        }
      }
      checkGlowFlag();
    }, [recent])
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

  useEffect(() => {
    if (!userId) return;
    async function fetchUserData() {
      try {
        const res = await fetch(`${API_URL}/users/${userId}`);
        if (!res.ok) return;

        const json = await res.json();

        // Set fresh scan count
        setScanCount(json.scan_count ?? 0);
        // Optional: update stored user for consistency
        const saved = await AsyncStorage.getItem("user");
        if (!saved) return;
        const parsed = JSON.parse(saved);
        const dataRes = await fetch(`${API_URL}/users/${parsed.id}`);

        if (dataRes.ok) {
          const data = await dataRes.json();
          setIsPremium(data.is_premium || false);
          parsed.scan_count = data.scan_count;
          await AsyncStorage.setItem("user", JSON.stringify(parsed));
        }
      } catch (err) {
        console.log("Error fetching user scan count:", err);
      }
    }

    fetchUserData();
  }, [userId]);

  // ----------------------
  // Load user
  // ----------------------
  useFocusEffect(
    useCallback(() => {
      const loadUser = async () => {
        const saved = await AsyncStorage.getItem("user");
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
        }
        if (saved) {
          const parsed = JSON.parse(saved);
          setUserId(parsed.id.toString());
          setUserName(parsed.first_name || "User");
          setIsPremium(parsed.is_premium || false);

        } else {
          Alert.alert("Not logged in", "Please log in first.");
          router.replace("/auth");
        }
      };
      loadUser();
    }, [])
  );

  // ----------------------
  // NEW: Self-Healing Premium Verification (calls your new endpoint)
  // ----------------------
  useEffect(() => {
    async function verifyPremium() {
      if (!userId) return;
      try {
        const info = await Purchases.getCustomerInfo();
        const premium = !!info.entitlements.active["BodyIO Pro"];

        // Instantly update UI
        setIsPremium(premium);

        // Update local storage immediately
        const saved = await AsyncStorage.getItem("user");
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.is_premium = premium;
          await AsyncStorage.setItem("user", JSON.stringify(parsed));
        }

        // Background sync to backend
        fetch(`${API_URL}/users/${userId}/verify_premium`).catch(() => { });
      } catch (err) {
        console.log("Premium verify failed:", err);
      }
    };
    verifyPremium();
  }, [userId]);

  useEffect(() => {
    const selected = METRICS.find(m => m.key === metric);
    if (selected?.premium && !isPremium) {
      setMetric("weight");
    }
  }, [isPremium]);
  // ----------------------
  // Fetch chart & latest metrics
  // ----------------------
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      const fetchChartData = async () => {
        try {
          // Latest scan
          const latestRes = await fetch(`${API_URL}/metrics/latest?user_id=${userId}`);
          const latestJson = latestRes.ok ? await latestRes.json() : null;
          setRecent(latestJson);

          // Chart for selected metric
          const chartRes = await fetch(`${API_URL}/metrics?user_id=${userId}&metric=${metric}&metric_range=${range}`);
          const chartJson = chartRes.ok ? await chartRes.json() : { points: [], trend: 0 };

          const dataRes = await fetch(`${API_URL}/users/${userId}`);
          if (dataRes.ok) {
            const data = await dataRes.json();
            setIsPremium(data.is_premium || false);
          }
          const cleanedPoints = (chartJson.points || []).filter((p) => p.value != null);
          setData(cleanedPoints);
          setTrend(chartJson.trend || 0);
        } catch (err) {
          console.error("Failed to load chart/metrics", err);
          Alert.alert("Error", "Failed to load chart data.");
        } finally {
          setLoading(false);
        }
      };

      fetchChartData();
    }, [userId, metric, range])
  );

  // ----------------------
  // Fetch goals (independent of metric selection)
  // ----------------------
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      const fetchGoals = async () => {
        try {
          // Fetch user goals
          const goalsRes = await fetch(`${API_URL}/goals/${userId}`);
          const goalsJson = goalsRes.ok ? await goalsRes.json() : [];

          // Fetch metrics for each goal
          const metricsPromises = goalsJson.map(goal =>
            fetch(`${API_URL}/metrics?user_id=${userId}&metric=${goal.metric}&range=max`)
              .then(res => res.json())
              .then(data => ({ metric: goal.metric, ...data }))
          );
          const allMetrics = await Promise.all(metricsPromises);

          // Build historical data: array of points per metric
          const historicalData: Record<string, any[]> = {};
          allMetrics.forEach(metricData => {
            const points = (metricData.points || []).filter((p: any) => p.value != null);
            if (points.length > 0) historicalData[metricData.metric] = points;
          });

          // Calculate progress for each goal
          const goalsWithProgress = goalsJson.map(goal => {
            const points = historicalData[goal.metric];
            if (!points || points.length === 0) return { ...goal, progress: 0, on_track: false };

            // Sort points by date descending
            points.sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());

            const latestValue = Number(points[0].value); // most recent
            const firstValue = Number(points[points.length - 1].value); // oldest
            const targetValue = Number(goal.target_value);

            if (isNaN(firstValue) || isNaN(latestValue) || isNaN(targetValue)) {
              return { ...goal, progress: 0, on_track: false };
            }

            let progressPct = 0;
            if (firstValue === targetValue) progressPct = 100;
            else if (firstValue > targetValue) {
              // Goal is to decrease
              progressPct = ((firstValue - latestValue) / (firstValue - targetValue)) * 100;
            } else {
              // Goal is to increase
              progressPct = ((latestValue - firstValue) / (targetValue - firstValue)) * 100;
            }

            progressPct = Math.min(Math.max(progressPct, 0), 100);
            return { ...goal, progress: progressPct, on_track: goal.on_track ?? false };
          });

          setGoals(goalsWithProgress);
        } catch (err) {
          console.error("Failed fetching goals or metrics:", err);
        }
      };

      fetchGoals();
    }, [userId])
  );

  // ----------------------
  // Open goal modal
  // ----------------------
  const openGoalDetails = async (goal) => {
    setSelectedGoal(goal);
    setShowModal(true);
    setProgressLoading(true);

    try {
      const res = await fetch(`${API_URL}/goals/${userId}/progress/${goal.id}`);
      const json = await res.json();
      setGoalProgress(json);
    } catch (err) {
      console.error("Failed loading goal progress", err);
      Alert.alert("Error", "Failed to fetch goal details.");
    } finally {
      setProgressLoading(false);
    }
  };

  // ----------------------
  // Prepare chart data
  // ----------------------
  const latestByDay: Record<string, { taken_at: string; value: number }> = {};

  data.forEach((point) => {
    // dayKey in user's local timezone (so "day" matches what they expect)
    const dayKey = DateTime.fromISO(point.taken_at, { zone: "utc" })
      .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .toISODate();

    const prev = latestByDay[dayKey];
    const currTime = new Date(point.taken_at).getTime();

    if (!prev || currTime > new Date(prev.taken_at).getTime()) {
      latestByDay[dayKey] = { taken_at: point.taken_at, value: Number(point.value) };
    }
  });

  // Sort by day ascending
  const groupedData = Object.entries(latestByDay)
    .map(([day, v]) => ({ day, value: v.value }))
    .sort((a, b) => DateTime.fromISO(a.day).toMillis() - DateTime.fromISO(b.day).toMillis());

  // Labels and values for chart
  const values = groupedData.map((p) => {
    if (metric === "weight") {
      return weightUnit === "kg"
        ? Number((p.value / 2.20462).toFixed(1))
        : Number(p.value.toFixed(1));
    }
    return Number(p.value.toFixed(1));
  });

  let labels = groupedData.map((p) =>
    DateTime.fromISO(p.day).toLocaleString({ month: "short", day: "numeric" })
  );

  // Optional: limit labels for readability
  if (labels.length > 8) {
    const step = Math.ceil(labels.length / 8);
    labels = labels.map((l, i) => (i % step === 0 ? l : ""));
  }
  const metricType = METRICS.find((m) => m.key === metric)?.type || "absolute";
  const trendingUp = trend >= 0;
  const changeText =
    metricType === "percent"
      ? `${trendingUp ? "▲" : "▼"} ${Math.abs(trend).toFixed(1)}%`
      : `${trendingUp ? "▲" : "▼"} ${Math.abs(trend).toFixed(1)}`;
  const color = trendingUp ? "#16a34a" : "#dc2626";

  const getProgressColor = (pct: number) => {
    const clamped = Math.min(Math.max(pct, 0), 100);
    if (clamped <= 50) return "#dc2626";
    if (clamped <= 75) return "#facc15";
    return "#16a34a";
  };

  // ----------------------
  // Loading state
  // ----------------------
  if (!userId || (loading && !recent)) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ padding: 16 }}
      >
        <Text style={styles.greeting}>👋 Hi, {userName}!</Text>

        {/* 🧾 Recent Scan */}
        {recent && (
          <Animated.View
            style={[
              {
                borderRadius: 12,
                padding: 3,
                marginBottom: 16,
              },
              shouldGlow && {
                shadowColor: "#16a34a",
                shadowOpacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.75],
                }),
                shadowRadius: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, 18],
                }),
                shadowOffset: { width: 0, height: 0 },
                borderWidth: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 2],
                }),
                borderColor: "#16a34a",
              },
            ]}
          >

            <View style={styles.recentCard}>
              <Text style={styles.recentTitle}>🧾 Your Recent Scan Results</Text>
              <View style={styles.metricsGrid}>
                {METRICS.map((m) => {
                  const value = recent[m.key];
                  if (value == null) return null;

                  const isNotLocked =
                    scanCount <= MAX_FREE_SCANS && !isPremium && m.premium;
                  const isLocked = !isNotLocked && m.premium && !isPremium;

                  return (
                    <TouchableOpacity
                      key={m.key}
                      activeOpacity={isLocked ? 1 : 0.7}
                      onPress={() => isLocked && router.push("/settings")}
                      style={styles.metricTile}
                    >
                      {/* Metric Label - left-aligned */}
                      <Text style={styles.metricTileLabel}>{m.label}</Text>
                      {/* Metric Value */}
                      {isLocked ? (
                        <View style={{ position: "relative", alignItems: "center", justifyContent: "center", height: 28, marginTop: 4 }}>
                          {/* Multiple blurred blobs */}
                          {LOCK_BLUR_OFFSETS.map((o, i) => (
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
                                  { translateX: o.x },
                                  { translateY: o.y },
                                ],
                              }}
                            />
                          ))}
                          {/* Invisible text for layout */}
                          <Text style={[styles.metricTileValue, { opacity: 0 }]}>{m.type === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1)}</Text>
                        </View>
                      ) : (
                        <Text style={styles.metricTileValue}>
                          {m.key === "weight"
                            ? formatWeight(value)
                            : m.type === "percent"
                              ? `${value.toFixed(1)}%`
                              : value.toFixed(1)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}



        {/* 📈 Chart */}
        <Text style={styles.subtext}>📈 Track your progress below:</Text>
        <Text style={styles.chartTitle}>{METRICS.find((m) => m.key === metric)?.label} over time</Text>
        <Text style={[styles.changeText, { color }]}>{changeText} ({range.toUpperCase()})</Text>

        {/* Metric Selector */}
        <View style={styles.metricSelector}>
          {METRICS.map((m) => {
            const disabled = m.premium && !isPremium;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => !disabled && setMetric(m.key)}
                disabled={disabled}
                style={[
                  styles.metricButton,
                  { backgroundColor: metric === m.key ? "#fff" : "#2c2c2c", opacity: disabled ? 0.5 : 1 },
                ]}
              >
                <Text style={{ color: metric === m.key ? "#000" : "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Range Selector */}
        <View style={styles.rangeSelector}>
          {["1week", "1month", "ytd", "max"].map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeButton, { backgroundColor: range === r ? "#fff" : "#2c2c2c" }]}
            >
              <Text style={{ color: range === r ? "#000" : "#d1d5db", fontWeight: "600" }}>{r.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        {values.length > 0 ? (
          <View style={styles.chartCard}>
            <LineChart
              data={{ labels, datasets: [{ data: values, color: () => color }] }}
              width={Dimensions.get("window").width - 40}
              height={260}
              yAxisSuffix={
                metric === "weight"
                  ? (weightUnit === "kg" ? " kg" : " lbs")
                  : (metricType === "percent" ? "%" : "")
              }
              withVerticalLines={false}
              withHorizontalLines
              withDots
              verticalLabelRotation={30}
              chartConfig={{
                backgroundColor: "#2c2c2c",
                backgroundGradientFrom: "#2c2c2c",
                backgroundGradientTo: "#2c2c2c",
                decimalPlaces: 1,
                color: () => color,
                labelColor: () => "#d1d5db",
                propsForDots: { r: "4", strokeWidth: "2", stroke: color },
              }}
              bezier
              style={{ borderRadius: 16 }}
            />
          </View>
        ) : (
          <Text style={styles.noDataText}>No data yet — try uploading your first scan!</Text>
        )}

        {/* 🎯 Goals */}
        <View style={{ marginTop: 24 }}>
          {goals.length > 0 ? (
            <>
              <Text style={styles.subtext}>🎯 Your Goals</Text>
              {goals.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  activeOpacity={0.8}
                  onPress={() => openGoalDetails(g)}
                  style={styles.goalCard}
                >
                  <Text style={styles.goalText}>
                    {METRICS.find((m) => m.key === g.metric)?.label}: {g.target_value}
                    {g.metric.includes("percent") ? "%" : ""} by {g.target_date.split("T")[0]}
                  </Text>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${g.progress ?? 0}%`, backgroundColor: getProgressColor(g.progress ?? 0) },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>{g.progress?.toFixed(1) ?? 0}% complete</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <Text style={styles.noDataText}>No goals yet - try setting a new goal!</Text>
          )}
        </View>

        {/* 🔹 Goal Modal */}
        <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {progressLoading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <>
                  <Text style={styles.modalTitle}>
                    {selectedGoal ? METRICS.find((m) => m.key === selectedGoal.metric)?.label : "Goal"} Details
                  </Text>

                  {goalProgress && selectedGoal && (
                    <View style={{ gap: 16 }}>

                      {/* Projected Value Card */}
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Projected Value</Text>
                        <Text style={styles.statNumber}>
                          {goalProgress.predicted_value?.toFixed(1)}
                          {selectedGoal.metric.includes("percent") ? "%" : " lbs"}
                        </Text>
                        <Text style={styles.statSub}>
                          by {formatLongDate(selectedGoal.target_date)}
                        </Text>
                      </View>

                      {/* Difference To Goal */}
                      <View style={styles.rowCard}>
                        <Text style={styles.rowLabel}>Remaining</Text>
                        <Text style={[
                          styles.rowValue,
                          { color: "#fff" }
                        ]}>
                          {Math.abs(goalProgress.difference_to_goal).toFixed(1)}
                          {selectedGoal.metric.includes("percent") ? "%" : " lbs"}
                        </Text>
                      </View>

                      {/* Weekly Performance */}
                      <View style={styles.rowCard}>
                        <Text style={styles.rowLabel}>Your Weekly Trend</Text>
                        <Text style={[
                          styles.rowValue,
                          { color: goalProgress.weekly_change >= 0 ? "#16a34a" : "#dc2626" }
                        ]}>
                          {goalProgress.weekly_change >= 0 ? "+" : "-"}
                          {Math.abs(goalProgress.weekly_change).toFixed(2)}
                          {selectedGoal.metric.includes("percent") ? "%/week" : " lbs/week"}
                        </Text>
                      </View>

                      {/* Required Weekly Trend */}
                      <View style={styles.rowCard}>
                        <Text style={styles.rowLabel}>Required Weekly Pace</Text>
                        <Text style={[
                          styles.rowValue,
                          {
                            color:
                              goalProgress.required_weekly_change >= 0 ? "#16a34a" : "#dc2626"
                          }
                        ]}>
                          {goalProgress.required_weekly_change >= 0 ? "+" : "-"}
                          {Math.abs(goalProgress.required_weekly_change).toFixed(2)}
                          {selectedGoal.metric.includes("percent") ? "%/week" : " lbs/week"}
                        </Text>
                      </View>

                      {/* Status */}
                      <View style={styles.statusCard}>
                        <Text
                          style={[
                            styles.statusText,
                            { color: goalProgress.on_track ? "#16a34a" : "#dc2626" }
                          ]}
                        >
                          {goalProgress.on_track ? "On Track" : "Not On Track"}
                        </Text>
                      </View>

                    </View>
                  )}


                  <TouchableOpacity style={styles.closeButton} onPress={() => setShowModal(false)}>
                    <Text style={{ color: "#000", fontWeight: "600" }}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

// ----------------------
// Styles
// ----------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1f1f1f" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1f1f1f" },
  greeting: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 12 },
  subtext: { fontSize: 16, color: "#9ca3af", marginVertical: 12 },
  chartTitle: { fontSize: 20, fontWeight: "600", color: "#fff", marginBottom: 4 },
  changeText: { fontSize: 16, marginBottom: 16 },
  recentCard: { backgroundColor: "#2c2c2c", borderRadius: 12, padding: 16, marginBottom: 16 },
  recentTitle: { color: "#fff", textAlign: "center", fontSize: 18, fontWeight: "700", marginBottom: 6, justifyContent: "center" },
  metricText: { color: "#d1d5db", fontSize: 15, marginBottom: 4 },
  blurOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", borderRadius: 12 },
  lockText: { color: "#fff", fontSize: 14, fontWeight: "600", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  metricSelector: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  metricButton: { flex: 1, marginHorizontal: 2, paddingVertical: 6, borderRadius: 8, alignItems: "center" },
  rangeSelector: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  rangeButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  chartCard: { backgroundColor: "#2c2c2c", borderRadius: 16, padding: 10 },
  noDataText: { textAlign: "center", color: "#9ca3af" },
  goalCard: { backgroundColor: "#2c2c2c", padding: 12, borderRadius: 8, marginBottom: 12 },
  goalText: { color: "#fff", fontSize: 14, marginBottom: 6 },
  progressBarBackground: { backgroundColor: "#3b3b3b", height: 10, borderRadius: 6, overflow: "hidden" },
  progressBarFill: { height: 10, borderRadius: 6 },
  progressText: { color: "#d1d5db", fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalContent: { backgroundColor: "#2c2c2c", padding: 24, borderRadius: 12, width: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 12 },
  modalText: { fontSize: 14, color: "#d1d5db", marginBottom: 12, lineHeight: 20 },
  closeButton: { marginTop: 12, backgroundColor: "#fff", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
  },

  metricTile: {
    width: "48%",
    backgroundColor: "#2c2c2c",
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
    position: "relative",
  },

  metricTileLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
    textAlign: "center",  // labels left-aligned
  },

  metricTileValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center", // numbers centered
  },
  statCard: {
    backgroundColor: "#333",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statLabel: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 4,
  },
  statNumber: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  statSub: {
    color: "#9ca3af",
    marginTop: 4,
    fontSize: 13,
  },

  rowCard: {
    backgroundColor: "#2a2a2a",
    padding: 14,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    color: "#9ca3af",
    fontSize: 15,
  },
  rowValue: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },

  statusCard: {
    backgroundColor: "#2c2c2c",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "700",
  },
});
