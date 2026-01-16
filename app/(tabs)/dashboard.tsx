// 📊 DashboardScreen.tsx (FULL UPDATE)
// ✅ Adds "Is this inaccurate?" pill on Recent Scan card
// ✅ Opens a bottom-sheet modal (NO ROUTES)
// ✅ User updates Fat % + Muscle % INSIDE the modal
// ✅ Selects verification method (DEXA / Calipers / Smart Scale / Other)
// ✅ Saves via PUT /metrics/{metric_id} as multipart/form-data
//
// 🚨 IMPORTANT BACKEND NOTE (read this once):
// Your current PUT /metrics/{metric_id} endpoint (in the code you pasted)
// does NOT accept fat_percent / skeletal_muscle_percent form fields.
// It only recalculates if photos are provided.
//
// So this UI will work once you add 3 optional Form fields on backend:
//   fat_percent: Optional[float] = Form(None)
//   skeletal_muscle_percent: Optional[float] = Form(None)
//   verified_method: Optional[str] = Form(None)
//
// I included the exact backend patch at the very bottom of this file comment.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";

const API_URL = Constants.expoConfig.extra.apiUrl;
const MAX_FREE_SCANS = 5;

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
  { key: "weight", label: "Weight", type: "absolute", premium: false, unitType: "weight" },
  { key: "bmi", label: "BMI", type: "absolute", premium: false, unitType: "unitless" },
  { key: "fat_percent", label: "Fat %", type: "percent", premium: true, unitType: "percent" },
  { key: "skeletal_muscle_percent", label: "Muscle %", type: "percent", premium: true, unitType: "percent" },
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

  // ✅ Verify / Update inside modal (NO ROUTES)
  const [showAccuracyModal, setShowAccuracyModal] = useState(false);
  const [verifyMethod, setVerifyMethod] = useState<"dexa" | "calipers" | "scale" | "other">("dexa");
  const [verifyFat, setVerifyFat] = useState<string>("");
  const [verifyMuscle, setVerifyMuscle] = useState<string>("");
  const [savingVerify, setSavingVerify] = useState(false);

  const startGlow = () => {
    Animated.sequence([
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
      setShouldGlow(false);
    });
  };

  const unitForMetric = (metricKey: string, weightUnit: "lbs" | "kg") => {
    if (metricKey === "fat_percent" || metricKey === "skeletal_muscle_percent") return "%";
    if (metricKey === "bmi") return ""; // BMI is unitless
    if (metricKey === "weight") return weightUnit; // "lbs" or "kg"
    return "";
  };

  const perWeekUnitForMetric = (metricKey: string, weightUnit: "lbs" | "kg") => {
    if (metricKey === "fat_percent" || metricKey === "skeletal_muscle_percent") return "%/week";
    if (metricKey === "bmi") return "/week"; // unitless/week
    if (metricKey === "weight") return `${weightUnit}/week`;
    return "/week";
  };

  const formatValueWithUnit = (metricKey: string, value: number, weightUnit: "lbs" | "kg") => {
    if (metricKey === "weight") {
      return weightUnit === "kg" ? `${(value / 2.20462).toFixed(1)} kg` : `${value.toFixed(1)} lbs`;
    }
    if (metricKey === "fat_percent" || metricKey === "skeletal_muscle_percent") {
      return `${value.toFixed(1)}%`;
    }
    if (metricKey === "bmi") {
      return value.toFixed(1);
    }
    return value.toFixed(1);
  };

  // ----------------------
  // Verify modal helpers
  // ----------------------
  const clampPct = (v: number) => Math.max(0, Math.min(v, 80));
  const parsePct = (s: string) => {
    const cleaned = s.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    if (Number.isNaN(n)) return null;
    return n;
  };

  const openVerifyModal = () => {
    if (!recent) return;
    setVerifyFat(recent.fat_percent != null ? String(Number(recent.fat_percent).toFixed(1)) : "");
    setVerifyMuscle(
      recent.skeletal_muscle_percent != null ? String(Number(recent.skeletal_muscle_percent).toFixed(1)) : ""
    );
    setVerifyMethod("dexa");
    setShowAccuracyModal(true);
  };

  const saveVerifiedValues = async () => {
    if (!recent?.id) {
      Alert.alert("Error", "No recent scan found to update.");
      return;
    }

    const fat = parsePct(verifyFat);
    const muscle = parsePct(verifyMuscle);

    if (fat == null || muscle == null) {
      Alert.alert("Invalid input", "Please enter numbers for Fat % and Muscle %.");
      return;
    }

    const fatClamped = clampPct(fat);
    const muscleClamped = clampPct(muscle);

    // optional sanity check
    if (fatClamped + muscleClamped > 120) {
      Alert.alert("Check values", "Those values look unusual. Please double-check.");
      return;
    }

    setSavingVerify(true);
    try {
      const form = new FormData();
      form.append("fat_percent", String(fatClamped));
      form.append("skeletal_muscle_percent", String(muscleClamped));
      form.append("verify_method", verifyMethod);

      const res = await fetch(`${API_URL}/metrics_verify/${recent.id}`, {
        method: "PUT",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.log("verify update error:", res.status, err);
        Alert.alert("Update failed", err?.detail || "Could not update your scan.");
        return;
      }

      const updated = await res.json();

      // ✅ Update local recent so UI refreshes instantly
      setRecent((prev: any) => ({
        ...(prev || {}),
        fat_percent: updated.fat_percent ?? fatClamped,
        skeletal_muscle_percent: updated.skeletal_muscle_percent ?? muscleClamped,
        verified_method: verifyMethod,
        verified_at: new Date().toISOString(),
      }));

      setShowAccuracyModal(false);
      Alert.alert("Saved", "Your verified values were updated.");
    } catch (e) {
      console.log("saveVerifiedValues error:", e);
      Alert.alert("Error", "Something went wrong saving your update.");
    } finally {
      setSavingVerify(false);
    }
  };

  // ----------------------
  // Glow flag
  // ----------------------
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

  // ----------------------
  // Load unit
  // ----------------------
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

  // ----------------------
  // Fetch scan_count + premium from backend (calls verify_premium)
  // ----------------------
  useEffect(() => {
    if (!userId) return;

    async function fetchUserData() {
      try {
        // 1) Hit verify_premium for this platform
        const verifyUrl = `${API_URL}/users/${userId}/${Platform.OS}/verify_premium`;
        console.log("Dashboard verify_premium:", verifyUrl);
        await fetch(verifyUrl).catch(() => null);

        // 2) Fetch fresh user from backend
        const res = await fetch(`${API_URL}/users/${userId}`);
        if (!res.ok) {
          console.log("Dashboard /users fetch failed:", res.status);
          return;
        }

        const json = await res.json();
        setScanCount(json.scan_count ?? 0);
        setIsPremium(json.is_premium || false);

        // 3) Sync into AsyncStorage
        const saved = await AsyncStorage.getItem("user");
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.scan_count = json.scan_count;
          parsed.is_premium = json.is_premium;
          await AsyncStorage.setItem("user", JSON.stringify(parsed));
        }
      } catch (err) {
        console.log("Error fetching user scan count / premium:", err);
      }
    }

    fetchUserData();
  }, [userId]);

  // ----------------------
  // Load user from AsyncStorage
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

  useEffect(() => {
    const selected = METRICS.find((m) => m.key === metric);
    if (selected?.premium && !isPremium) setMetric("weight");
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
          const latestRes = await fetch(`${API_URL}/metrics/latest?user_id=${userId}`);
          const latestJson = latestRes.ok ? await latestRes.json() : null;
          setRecent(latestJson);

          const chartRes = await fetch(
            `${API_URL}/metrics?user_id=${userId}&metric=${metric}&metric_range=${range}`
          );
          const chartJson = chartRes.ok ? await chartRes.json() : { points: [], trend: 0 };

          const dataRes = await fetch(`${API_URL}/users/${userId}`);
          if (dataRes.ok) {
            const u = await dataRes.json();
            setIsPremium(u.is_premium || false);
          }

          const cleanedPoints = (chartJson.points || [])
            .filter((p) => p.value != null)
            .filter((p) => {
              if (range !== "ytd") return true;
              const cutoff = DateTime.now().startOf("year");
              return DateTime.fromISO(p.taken_at).toLocal() >= cutoff;
            });

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
  // Fetch goals
  // ----------------------
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      const fetchGoals = async () => {
        try {
          const goalsRes = await fetch(`${API_URL}/goals/${userId}`);
          const goalsJson = goalsRes.ok ? await goalsRes.json() : [];

          const metricsPromises = goalsJson.map((goal) =>
            fetch(`${API_URL}/metrics?user_id=${userId}&metric=${goal.metric}&metric_range=max`)
              .then((res) => res.json())
              .then((d) => ({ metric: goal.metric, ...d }))
          );
          const allMetrics = await Promise.all(metricsPromises);

          const historicalData: Record<string, any[]> = {};
          allMetrics.forEach((metricData) => {
            const points = (metricData.points || []).filter((p: any) => p.value != null);
            if (points.length > 0) historicalData[metricData.metric] = points;
          });

          const goalsWithProgress = goalsJson.map((goal) => {
            const points = historicalData[goal.metric];
            if (!points || points.length === 0) return { ...goal, progress: 0, on_track: false };

            points.sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());

            const latestValue = Number(points[0].value);
            const firstValue = Number(points[points.length - 1].value);
            const targetValue = Number(goal.target_value);

            if (isNaN(firstValue) || isNaN(latestValue) || isNaN(targetValue)) {
              return { ...goal, progress: 0, on_track: false };
            }

            let progressPct = 0;
            if (firstValue === targetValue) progressPct = 100;
            else if (firstValue > targetValue) {
              progressPct = ((firstValue - latestValue) / (firstValue - targetValue)) * 100;
            } else {
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
  // Goal modal open
  // ----------------------
  const openGoalDetails = async (goal: any) => {
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
    const dayKey = DateTime.fromISO(point.taken_at, { zone: "utc" })
      .setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .toISODate();

    const prev = latestByDay[dayKey];
    const currTime = new Date(point.taken_at).getTime();
    if (!prev || currTime > new Date(prev.taken_at).getTime()) {
      latestByDay[dayKey] = { taken_at: point.taken_at, value: Number(point.value) };
    }
  });

  const groupedData = Object.entries(latestByDay)
    .map(([day, v]) => ({ day, value: v.value }))
    .sort((a, b) => DateTime.fromISO(a.day).toMillis() - DateTime.fromISO(b.day).toMillis());

  const values = groupedData.map((p) => {
    if (metric === "weight") {
      return weightUnit === "kg" ? Number((p.value / 2.20462).toFixed(1)) : Number(p.value.toFixed(1));
    }
    return Number(p.value.toFixed(1));
  });

  let labels = groupedData.map((p) => DateTime.fromISO(p.day).toLocaleString({ month: "short", day: "numeric" }));
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
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 16 }}>
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

                  const isNotLocked = scanCount <= MAX_FREE_SCANS && !isPremium && m.premium;
                  const isLocked = !isNotLocked && m.premium && !isPremium;

                  return (
                    <TouchableOpacity
                      key={m.key}
                      activeOpacity={isLocked ? 1 : 0.7}
                      onPress={() => {
                        if (isLocked) router.push("/settings");
                      }}
                      style={styles.metricTile}
                    >
                      <Text style={styles.metricTileLabel}>{m.label}</Text>

                      {isLocked ? (
                        <View
                          style={{
                            position: "relative",
                            alignItems: "center",
                            justifyContent: "center",
                            height: 28,
                            marginTop: 4,
                          }}
                        >
                          {LOCK_BLUR_OFFSETS.map((o, i) => (
                            <View
                              key={i}
                              style={{
                                position: "absolute",
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: "rgba(0,0,0,0.5)",
                                transform: [{ translateX: o.x }, { translateY: o.y }],
                              }}
                            />
                          ))}
                          <Text style={[styles.metricTileValue, { opacity: 0 }]}>
                            {m.type === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.metricTileValue}>
                          {formatValueWithUnit(m.key, value, weightUnit)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={openVerifyModal}
                  activeOpacity={0.85}
                  style={styles.infoPillBelow}
                >
                  <Ionicons name="information-circle" size={16} color="#fff" />
                  <Text style={styles.infoPillText}>Is this information inaccurate?</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ✅ Verify / Update modal (bottom sheet, edit INSIDE modal) */}
        <Modal
          visible={showAccuracyModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAccuracyModal(false)}
        >
          <View style={styles.sheetOverlay}>
            {/* tap outside to close */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setShowAccuracyModal(false)}
              style={StyleSheet.absoluteFillObject as any}
            />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.tooltipModal}>

                <Text style={styles.sheetTitle}>Verify / Update your scan</Text>
                <Text style={styles.sheetText}>
                  BodyIO estimates your metrics using your photos, height, and weight. Lighting, pose, and camera angle can sometimes affect accuracy. If your scan looks off, you can enter your verified Body Fat % and Muscle % below.
                </Text>

                {/* Method chips */}
                <View style={styles.methodRow}>
                  {[
                    { key: "dexa", label: "DEXA" },
                    { key: "calipers", label: "Calipers" },
                    { key: "scale", label: "Smart Scale" },
                    { key: "other", label: "Other" },
                  ].map((m) => {
                    const active = verifyMethod === (m.key as any);
                    return (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => setVerifyMethod(m.key as any)}
                        style={[styles.methodChip, active && styles.methodChipActive]}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Inputs */}
                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Fat %</Text>
                    <TextInput
                      value={verifyFat}
                      onChangeText={setVerifyFat}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 18.5"
                      placeholderTextColor="#6b7280"
                      style={styles.input}
                      maxLength={5}
                      returnKeyType="done"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Muscle %</Text>
                    <TextInput
                      value={verifyMuscle}
                      onChangeText={setVerifyMuscle}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 41.2"
                      placeholderTextColor="#6b7280"
                      style={styles.input}
                      maxLength={5}
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <Text style={styles.sheetFinePrint}>
                  Tip: Use the same method each time for the best trend tracking.
                </Text>

                {/* Buttons */}
                <View style={styles.sheetButtonRow}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setShowAccuracyModal(false)}
                    disabled={savingVerify}
                  >
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryBtn, savingVerify && { opacity: 0.6 }]}
                    onPress={saveVerifiedValues}
                    disabled={savingVerify}
                  >
                    {savingVerify ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

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
                  {
                    backgroundColor: metric === m.key ? "#fff" : "#2c2c2c",
                    opacity: disabled ? 0.5 : 1,
                  },
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
                  ? weightUnit === "kg"
                    ? " kg"
                    : " lbs"
                  : metricType === "percent"
                    ? "%"
                    : ""
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
                        {
                          width: `${g.progress ?? 0}%`,
                          backgroundColor: getProgressColor(g.progress ?? 0),
                        },
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

                  {goalProgress && selectedGoal && (() => {
                    const unit = unitForMetric(selectedGoal.metric, weightUnit);
                    const perWeek = perWeekUnitForMetric(selectedGoal.metric, weightUnit);
                    const decimals = selectedGoal.metric === "bmi" ? 2 : 1;

                    return (
                      <View style={{ gap: 16 }}>
                        <View style={styles.statCard}>
                          <Text style={styles.statLabel}>Projected Value</Text>
                          <Text style={styles.statNumber}>
                            {goalProgress.predicted_value?.toFixed(decimals)}
                            {unit ? ` ${unit}` : ""}
                          </Text>
                          <Text style={styles.statSub}>by {formatLongDate(selectedGoal.target_date)}</Text>
                        </View>

                        <View style={styles.rowCard}>
                          <Text style={styles.rowLabel}>Remaining</Text>
                          <Text style={[styles.rowValue, { color: "#fff" }]}>
                            {Math.abs(goalProgress.difference_to_goal).toFixed(decimals)}
                            {unit ? ` ${unit}` : ""}
                          </Text>
                        </View>

                        <View style={styles.rowCard}>
                          <Text style={styles.rowLabel}>Your Weekly Trend</Text>
                          <Text
                            style={[
                              styles.rowValue,
                              { color: goalProgress.weekly_change >= 0 ? "#16a34a" : "#dc2626" },
                            ]}
                          >
                            {goalProgress.weekly_change >= 0 ? "+" : "-"}
                            {Math.abs(goalProgress.weekly_change).toFixed(2)} {perWeek}
                          </Text>
                        </View>

                        <View style={styles.rowCard}>
                          <Text style={styles.rowLabel}>Required Weekly Pace</Text>
                          <Text
                            style={[
                              styles.rowValue,
                              { color: goalProgress.required_weekly_change >= 0 ? "#16a34a" : "#dc2626" },
                            ]}
                          >
                            {goalProgress.required_weekly_change >= 0 ? "+" : "-"}
                            {Math.abs(goalProgress.required_weekly_change).toFixed(2)} {perWeek}
                          </Text>
                        </View>

                        <View style={styles.statusCard}>
                          <Text
                            style={[
                              styles.statusText,
                              { color: goalProgress.on_track ? "#16a34a" : "#dc2626" },
                            ]}
                          >
                            {goalProgress.on_track ? "On Track" : "Not On Track"}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1f1f1f",
  },

  greeting: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 12 },
  subtext: { fontSize: 16, color: "#9ca3af", marginVertical: 12 },
  chartTitle: { fontSize: 20, fontWeight: "600", color: "#fff", marginBottom: 4 },
  changeText: { fontSize: 16, marginBottom: 16 },

  recentCard: {
    backgroundColor: "#2c2c2c",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  recentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  recentTitle: {
    color: "#fff",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 0,
  },
  infoPillBelow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#3b3b3b",
  },

  infoPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  recentHint: {
    marginTop: 8,
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 16,
  },

  metricSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  metricButton: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },

  rangeSelector: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },

  rangeButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },

  chartCard: { backgroundColor: "#2c2c2c", borderRadius: 16, padding: 10 },

  noDataText: { textAlign: "center", color: "#9ca3af" },

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
    // borderWidth: 1,
    // borderColor: "#333",
  },

  metricTileLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "center",
  },

  metricTileValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },

  goalCard: {
    backgroundColor: "#2c2c2c",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },

  goalText: { color: "#fff", fontSize: 14, marginBottom: 6 },

  progressBarBackground: {
    backgroundColor: "#3b3b3b",
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
  },

  progressBarFill: { height: 10, borderRadius: 6 },

  progressText: { color: "#d1d5db", fontSize: 12, marginTop: 4 },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },

  modalContent: {
    backgroundColor: "#2c2c2c",
    padding: 24,
    borderRadius: 12,
    width: "85%",
  },

  modalTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 12 },

  closeButton: {
    marginTop: 12,
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  statCard: {
    backgroundColor: "#333",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  statLabel: { color: "#9ca3af", fontSize: 14, marginBottom: 4 },

  statNumber: { color: "#fff", fontSize: 32, fontWeight: "700" },

  statSub: { color: "#9ca3af", marginTop: 4, fontSize: 13 },

  rowCard: {
    backgroundColor: "#2a2a2a",
    padding: 14,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rowLabel: { color: "#9ca3af", fontSize: 15 },

  rowValue: { color: "#fff", fontWeight: "600", fontSize: 16 },

  statusCard: {
    backgroundColor: "#2c2c2c",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },

  statusText: { fontSize: 18, fontWeight: "700" },

  // ✅ Bottom-sheet modal styles
  sheetOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 16,
  },

  tooltipModal: {
    backgroundColor: "#2c2c2c",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    borderRadius: 18,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#3b3b3b",
  },


  sheetGrabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#4b5563",
    marginBottom: 10,
    opacity: 0.9,
  },

  sheetTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },

  sheetText: {
    color: "#d1d5db",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: "center",
  },

  sheetFinePrint: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
  },

  sheetButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  primaryBtn: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 15,
  },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#1f1f1f",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3b3b3b",
  },

  secondaryBtnText: {
    color: "#e5e7eb",
    fontWeight: "800",
    fontSize: 15,
  },

  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 10,
  },

  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
  },

  methodChipActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },

  methodChipText: {
    color: "#e5e7eb",
    fontWeight: "800",
    fontSize: 12,
  },

  methodChipTextActive: {
    color: "#000",
  },

  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },

  inputLabel: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "700",
  },

  input: {
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
