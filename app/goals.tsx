import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Swipeable, RectButton } from "react-native-gesture-handler";


const API_URL = Constants.expoConfig.extra.apiUrl;
type MetricKey = "weight" | "bmi" | "fat_percent" | "skeletal_muscle_percent";
type MetricFilter = "all" | MetricKey;

const METRIC_LIMITS: Record<MetricKey, { min: number; max: number; label: string }> = {
  weight: { min: 50, max: 800, label: "Weight (lbs)" },
  bmi: { min: 10, max: 80, label: "BMI" },
  fat_percent: { min: 2, max: 70, label: "Body fat %" },
  skeletal_muscle_percent: { min: 15, max: 60, label: "Muscle %" },
};

const METRICS = [
  { key: "weight", label: "Weight" },
  { key: "bmi", label: "BMI" },
  { key: "fat_percent", label: "Fat %" },
  { key: "skeletal_muscle_percent", label: "Muscle %" },
];

function formatDisplayDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return new Date(`${y}-${m}-${d}T00:00:00`).toDateString();
}

const isPercentMetric = (metricKey: string) =>
  metricKey === "fat_percent" || metricKey === "skeletal_muscle_percent";

const validateTargetValue = (metricKey: MetricKey, value: number) => {
  if (!Number.isFinite(value)) return { ok: false as const, message: "Enter a valid number." };

  const { min, max, label } = METRIC_LIMITS[metricKey];

  if (value < min || value > max) {
    return {
      ok: false as const,
      message: `${label} must be between ${min} and ${max}.`,
    };
  }

  return { ok: true as const };
};

const getTargetUnitLabel = (metricKey: string) => {
  if (isPercentMetric(metricKey)) return "(%)";
  if (metricKey === "weight") return "(lbs)";
  if (metricKey === "bmi") return "";
  return "";
};


/**
 * Parses target values safely:
 * - percent metrics: accept "10", "10%", or "0.10" meaning 10%
 *   - if 0 < n <= 1 => treat as fraction and convert to percent
 * - non-percent: just parse number
 */
const parseTargetValue = (raw: string, metricKey: string) => {
  const cleaned = raw.trim().replace(/\s+/g, "").replace("%", "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;

  if (isPercentMetric(metricKey)) {
    if (n > 0 && n <= 1) return n * 100; // 0.10 => 10
    return n; // 10 => 10
  }

  return n;
};

export default function GoalsScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any | null>(null);
  const [targetValue, setTargetValue] = useState<string>("");
  const [metricFilter, setMetricFilter] = useState<MetricFilter>("all");
  const [showSwipeTip, setShowSwipeTip] = useState(false);

  // Store date as YYYY-MM-DD parts
  const [selectedDate, setSelectedDate] = useState<{
    year: string;
    month: string;
    day: string;
  }>({
    year: "2025",
    month: "01",
    day: "01",
  });

  const [isPickerVisible, setPickerVisible] = useState(false);
  type GoalStatusFilter = "active" | "completed" | "canceled";

  const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>("active");
  const confirmCancel = (goalId: string) => {
    Alert.alert("Cancel goal?", "You can view it later & resume under Canceled.", [
      { text: "No", style: "cancel" },
      { text: "Cancel goal", style: "destructive", onPress: () => updateGoalStatus(goalId, "canceled") },
    ]);
  };
  const renderLeftActions = (goal: any) => {
    // Swipe LEFT → show Complete (revealed on right side)
    return (
      <View style={styles.swipeActionRightWrap}>
        <RectButton
          style={[styles.swipeActionButton, styles.swipeComplete]}
          onPress={() => updateGoalStatus(goal.id, "completed")}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Complete</Text>
        </RectButton>
      </View>
    );
  };


  const renderRightActions = (goal: any) => {
    // Swipe RIGHT → show Cancel (revealed on left side)
    return (
      <View style={styles.swipeActionLeftWrap}>
        <RectButton
          style={[styles.swipeActionButton, styles.swipeCancel]}
          onPress={() => confirmCancel(goal.id)}
        >
          <Ionicons name="close-circle" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Cancel</Text>
        </RectButton>
      </View>
    );
  };

  const renderResumeActions = (goal: any) => {
    return (
      <View style={styles.swipeActionRightWrap}>
        <RectButton
          style={[styles.swipeActionButton, styles.swipeResume]}
          onPress={() => updateGoalStatus(goal.id, "active")}
        >
          <Ionicons name="refresh-circle" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Resume</Text>
        </RectButton>
      </View>
    );
  };

  const hasActiveGoals = goals.some((g) => (g.status ?? "active") === "active");
  const swipeEnabled = statusFilter === "active" || statusFilter === "canceled";

  useEffect(() => {
    async function maybeShowTip() {
      if (!hasActiveGoals || statusFilter !== "active") return;

      const seen = await AsyncStorage.getItem("seen_goals_swipe_tip");
      if (!seen) setShowSwipeTip(true);
    }

    maybeShowTip();
  }, [hasActiveGoals, statusFilter]);



  // ----------------------
  // Fetch premium from backend (calls verify_premium)
  // ----------------------

  useEffect(() => {
    if (!userId) return;
    async function fetchUserData() {
      try {
        // 1) Hit verify_premium for this platform
        const verifyUrl = `${API_URL}/users/${userId}/${Platform.OS}/verify_premium`;
        console.log("Goals verify_premium:", verifyUrl);
        const verifyRes = await fetch(verifyUrl);
        console.log("Goals verify_premium status:", verifyRes.status);
        let verifyBody: any = null;
        try {
          verifyBody = await verifyRes.json();
        } catch {
          // ignore body parse errors
        }
        console.log("Goals verify_premium body:", verifyBody);

        // 2) Fetch fresh user from backend
        const res = await fetch(`${API_URL}/users/${userId}`);
        if (!res.ok) {
          console.log("Goals /users fetch failed:", res.status);
          return;
        }

        const json = await res.json();
        setIsPremium(json.is_premium || false);

        // 3) Sync into AsyncStorage
        const saved = await AsyncStorage.getItem("user");
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.is_premium = json.is_premium;
          await AsyncStorage.setItem("user", JSON.stringify(parsed));
        }
      } catch (err) {
        console.log("Error fetching user scan count / premium:", err);
      }
    }

    fetchUserData();
  }, [userId]);

  // -----------------------------
  // Load user
  // -----------------------------
  useEffect(() => {
    const loadUser = async () => {
      const saved = await AsyncStorage.getItem("user");
      if (!saved) {
        router.replace("/auth");
        return;
      }
      const parsed = JSON.parse(saved);
      setUserId(parsed.id.toString());
      setIsPremium(parsed.is_premium || false);
    };
    loadUser();
  }, []);

  useEffect(() => {
    fetchGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);


  useEffect(() => {
    if (!isPremium && (metricFilter === "fat_percent" || metricFilter === "skeletal_muscle_percent")) {
      setMetricFilter("all");
    }
  }, [isPremium, metricFilter]);


  const fetchGoals = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/goals/${userId}`);
      const data = await res.json();
      setGoals(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  };

  // -----------------------------
  // Date Picker
  // -----------------------------
  const handleConfirmDate = (date: Date) => {
    const year = date.getFullYear().toString();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    setSelectedDate({ year, month, day });
    setPickerVisible(false);
  };

  const openCreateModal = () => {
    setEditingGoal({ metric: METRICS[0].key });
    setTargetValue("");
    const now = new Date();
    setSelectedDate({
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, "0"),
      day: String(now.getDate()).padStart(2, "0"),
    });
    setModalVisible(true);
  };

  const openEditModal = (goal: any) => {
    const [y, m, d] = goal.target_date.split("-");
    setEditingGoal(goal);
    setTargetValue(String(goal.target_value)); // backend stores numeric
    setSelectedDate({ year: y, month: m, day: d });
    setModalVisible(true);
  };

  // -----------------------------
  // CREATE GOAL
  // -----------------------------
  const handleCreateGoal = async () => {
    if (!targetValue) return Alert.alert("Missing field", "Enter a value.");
    if (!editingGoal?.metric) return Alert.alert("Missing field", "Select a metric.");

    const parsed = parseTargetValue(targetValue, editingGoal.metric);
    if (parsed == null) return Alert.alert("Invalid value", "Enter a valid number.");

    const metricKey = editingGoal.metric as MetricKey;
    const check = validateTargetValue(metricKey, parsed);
    if (!check.ok) return Alert.alert("Invalid value", check.message);

    const ymd = `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;

    const payload = {
      user_id: userId,
      metric: editingGoal.metric,
      target_value: parsed,
      target_date: ymd,
    };

    try {
      const res = await fetch(`${API_URL}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        Alert.alert("Error", err?.detail || "Failed to create goal.");
        return;
      }

      Alert.alert("Success", "Goal created");
      setModalVisible(false);
      fetchGoals();
    } catch {
      Alert.alert("Error", "Failed to create goal.");
    }
  };

  const updateGoalStatus = async (goalId: string, status: "active" | "completed" | "canceled") => {
    try {

      console.log("DKA: ", status)
      console.log(API_URL)
      const res = await fetch(`${API_URL}/goals/${goalId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        Alert.alert("Error", err?.detail || "Failed to update goal status.");
        return;
      }

      // refresh list + close modal
      await fetchGoals();
      setModalVisible(false);
    } catch {
      Alert.alert("Error", "Failed to update goal status.");
    }
  };


  // -----------------------------
  // SAVE EDITED GOAL
  // -----------------------------
  const handleSaveGoal = async () => {
    if (!editingGoal?.id) return;
    if (!targetValue) return Alert.alert("Missing field", "Enter a value.");

    const metricKey = editingGoal.metric as MetricKey;
    const parsed = parseTargetValue(targetValue, metricKey);
    if (parsed == null) return Alert.alert("Invalid value", "Enter a valid number.");


    const check = validateTargetValue(metricKey, parsed);
    if (!check.ok) return Alert.alert("Invalid value", check.message);
    const ymd = `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;

    const payload = {
      user_id: userId,
      metric: metricKey,
      target_value: parsed,
      target_date: ymd,
    };

    try {
      const res = await fetch(`${API_URL}/goals/${editingGoal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        Alert.alert("Error", err?.detail || "Failed to update goal.");
        return;
      }

      Alert.alert("Success", "Goal updated");
      setModalVisible(false);
      fetchGoals();
    } catch {
      Alert.alert("Error", "Failed to update goal.");
    }
  };

  // -----------------------------
  // DELETE GOAL
  // -----------------------------
  const handleDeleteGoal = async (goalId: string) => {
    Alert.alert("Confirm delete", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/goals/${goalId}`, { method: "DELETE" });
            if (!res.ok) {
              Alert.alert("Error", "Failed to delete goal.");
              return;
            }
            Alert.alert("Deleted");
            setModalVisible(false);
            fetchGoals();
          } catch {
            Alert.alert("Error", "Failed to delete goal.");
          }
        },
      },
    ]);
  };

  const activeMetricKey = editingGoal?.metric || "weight";
  const unitLabel = getTargetUnitLabel(activeMetricKey);
  const placeholder =
    isPercentMetric(activeMetricKey) ? "e.g. 10 or 10% or 0.10" : "Enter value";

  useEffect(() => {
    setMetricFilter("all");
  }, [statusFilter]);

  const filteredGoals = goals.filter((g) => {
    const s = (g.status ?? "active") as GoalStatusFilter;
    const matchesStatus = s === statusFilter;
    const matchesMetric = metricFilter === "all" ? true : g.metric === metricFilter;
    return matchesStatus && matchesMetric;
  });

  const filterLabel =
    statusFilter === "active"
      ? "active"
      : statusFilter === "completed"
        ? "completed"
        : "canceled";

  const emptyTitle =
    goals.length === 0
      ? "You don’t have any goals yet."
      : `No ${filterLabel} goals.`;


  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>🎯 Your Goals</Text>

      {showSwipeTip && swipeEnabled && statusFilter === "active" && hasActiveGoals && (
        <View style={styles.swipeTip}>
          <Ionicons name="swap-horizontal" size={18} color="#fff" />
          <Text style={styles.swipeTipText}>
            Tip: Swipe right to cancel • Swipe left to complete
            {statusFilter === "canceled" ? " • Swipe to resume" : ""}
          </Text>

          <TouchableOpacity
            onPress={async () => {
              await AsyncStorage.setItem("seen_goals_swipe_tip", "true");
              setShowSwipeTip(false);
            }}
            style={styles.swipeTipBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.swipeTipBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.filterRow}>
        {(["active", "completed", "canceled"] as GoalStatusFilter[]).map((s) => {
          const selected = statusFilter === s;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => setStatusFilter(s)}
              style={[styles.filterPill, selected && styles.filterPillActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterPillText, selected && styles.filterPillTextActive]}>
                {s === "active" ? "Active" : s === "completed" ? "Completed" : "Canceled"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ✅ Metric filter */}
      <View style={styles.filterRow}>
        {(
          [
            { key: "all", label: "All", premium: false },
            { key: "weight", label: "Weight", premium: false },
            { key: "bmi", label: "BMI", premium: false },
            { key: "fat_percent", label: "Fat %", premium: true },
            { key: "skeletal_muscle_percent", label: "Muscle %", premium: true },
          ] as { key: MetricFilter; label: string; premium: boolean }[]
        ).map((m) => {
          const selected = metricFilter === m.key;
          const disabled = m.premium && !isPremium;

          return (
            <TouchableOpacity
              key={m.key}
              disabled={disabled}
              onPress={() => !disabled && setMetricFilter(m.key)}
              style={[
                styles.filterPill,
                selected && styles.filterPillActive,
                disabled && { opacity: 0.4 },
              ]}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterPillText, selected && styles.filterPillTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredGoals.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Text style={{ color: "#fff", marginBottom: 12 }}>{emptyTitle}</Text>
          {statusFilter === "active" && (
            <TouchableOpacity style={styles.saveButton} onPress={openCreateModal}>
              <Text style={{ fontWeight: "600", color: "#000" }}>
                {goals.length === 0 ? "Create Your First Goal" : "Add Another Goal"}
              </Text>
            </TouchableOpacity>
          )}


          {/* Optional hint when they have goals but not in this filter */}
          {goals.length > 0 && (
            <Text style={{ color: "#9ca3af", marginTop: 10, textAlign: "center" }}>
              Try switching filters above.
            </Text>
          )}
        </View>
      ) : (
        <>
          {filteredGoals.map((g) => (
            <Swipeable
              key={g.id}
              enabled={swipeEnabled}
              renderLeftActions={
                statusFilter === "active"
                  ? () => renderRightActions(g)          // swipe RIGHT → Cancel
                  : statusFilter === "canceled"
                    ? () => renderResumeActions(g)         // swipe RIGHT (or left) → Resume
                    : undefined
              }
              renderRightActions={
                statusFilter === "active"
                  ? () => renderLeftActions(g)           // swipe LEFT → Complete
                  : undefined
              }
              overshootLeft={false}
              overshootRight={false}
            >

              <TouchableOpacity
                style={styles.goalCard}
                onPress={() => openEditModal(g)}
                activeOpacity={0.9}
              >
                <View style={styles.goalHeader}>
                  <Text style={styles.goalMetric}>
                    {METRICS.find((m) => m.key === g.metric)?.label}
                  </Text>
                  <Text style={styles.goalDate}>{formatDisplayDate(g.target_date)}</Text>
                </View>

                <Text style={styles.goalTargetLabel}>Target</Text>
                <Text style={styles.goalTargetValue}>
                  {g.target_value}
                  {isPercentMetric(g.metric) ? "%" : ""}
                </Text>

                {/* Optional: show status badge */}
                {!!g.status && (
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{String(g.status).toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Swipeable>
          ))}


          {statusFilter === "active" && (
            <TouchableOpacity
              style={[styles.saveButton, { marginTop: 16 }]}
              onPress={openCreateModal}
            >
              <Text style={{ fontWeight: "600", color: "#000" }}>Add Another Goal</Text>
            </TouchableOpacity>
          )}

        </>
      )}

      {/* MODAL */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingGoal?.id ? "Edit Goal" : "Create Goal"}
            </Text>

            {/* Metric selector (create only) */}
            {!editingGoal?.id && (
              <>
                <Text style={styles.modalLabel}>Select Metric</Text>
                <FlatList
                  horizontal
                  data={METRICS}
                  keyExtractor={(i) => i.key}
                  renderItem={({ item }) => {
                    const disabled = !isPremium && !["weight", "bmi"].includes(item.key);

                    const selected = editingGoal?.metric === item.key;

                    return (
                      <TouchableOpacity
                        disabled={disabled}
                        style={[
                          styles.metricChip,
                          selected && styles.metricChipActive,
                          disabled && styles.metricChipDisabled,
                        ]}
                        onPress={() => {
                          setEditingGoal({ ...editingGoal, metric: item.key });
                          setTargetValue(""); // reset input when switching metric
                        }}
                      >
                        <Text
                          style={[
                            styles.metricChipText,
                            selected && styles.metricChipTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}

            {/* Value */}
            <Text style={styles.modalLabel}>
              Target Value {unitLabel ? ` ${unitLabel}` : ""}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={targetValue}
              placeholder={placeholder}
              placeholderTextColor="#666"
              onChangeText={setTargetValue}
              keyboardType="numeric"
            />

            {/* Date */}
            <Text style={styles.modalLabel}>Target Date</Text>

            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setPickerVisible(true)}
            >
              <Text style={styles.datePickerText}>
                {`${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`}
              </Text>
            </TouchableOpacity>

            <DateTimePickerModal
              isVisible={isPickerVisible}
              mode="date"
              onConfirm={handleConfirmDate}
              onCancel={() => setPickerVisible(false)}
              minimumDate={new Date()}
            />

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() => (editingGoal?.id ? handleSaveGoal() : handleCreateGoal())}
              >
                <Text style={styles.modalSaveText}>
                  {editingGoal?.id ? "Save" : "Create"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              {editingGoal?.id && (
                <TouchableOpacity
                  style={styles.modalDeleteButton}
                  onPress={() => handleDeleteGoal(editingGoal.id)}
                >
                  <Text style={styles.modalDeleteText}>Delete Goal</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 40, marginBottom: 12 },

  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },

  saveButton: {
    backgroundColor: "#fff",
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
  },

  goalCard: {
    backgroundColor: "#2c2c2c",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },

  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  goalMetric: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  goalDate: { color: "#9ca3af" },

  goalTargetLabel: { color: "#aaa", fontSize: 12 },
  goalTargetValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#1f1f1f",
    padding: 20,
    borderRadius: 16,
  },

  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },

  modalLabel: { color: "#ccc", marginBottom: 6 },
  modalInput: {
    backgroundColor: "#2c2c2c",
    padding: 12,
    color: "#fff",
    borderRadius: 8,
    marginBottom: 16,
  },

  datePickerButton: {
    backgroundColor: "#2c2c2c",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },

  datePickerText: {
    color: "#fff",
    fontWeight: "600",
  },

  metricChip: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: "#2c2c2c",
    marginRight: 10,
    marginBottom: 10,
  },

  metricChipActive: { backgroundColor: "#fff" },
  metricChipDisabled: { opacity: 0.4 },

  metricChipText: { color: "#fff" },
  metricChipTextActive: { color: "#000", fontWeight: "700" },

  modalButtons: { marginTop: 20 },

  modalSaveButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  modalSaveText: { fontWeight: "700", fontSize: 16 },

  modalCancelButton: {
    backgroundColor: "#2c2c2c",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },

  modalCancelText: { color: "#fff" },

  modalDeleteButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },

  modalDeleteText: { color: "#fff", fontWeight: "700" },
  swipeActionLeftWrap: {
    justifyContent: "center",
    alignItems: "flex-start",
    marginBottom: 14,
    borderRadius: 12,
    overflow: "hidden",
  },
  swipeActionRightWrap: {
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 14,
    borderRadius: 12,
    overflow: "hidden",
  },
  swipeActionButton: {
    height: "100%",
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  swipeComplete: {
    backgroundColor: "#16a34a",
  },
  swipeCancel: {
    backgroundColor: "#dc2626",
  },
  swipeActionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
  },
  statusPillText: {
    color: "#9ca3af",
    fontWeight: "800",
    fontSize: 11,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    justifyContent: "center",
  },

  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#2c2c2c",
    borderWidth: 1,
    borderColor: "#333",
  },

  filterPillActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },

  filterPillText: {
    color: "#9ca3af",
    fontWeight: "800",
    fontSize: 12,
  },

  filterPillTextActive: {
    color: "#000",
  },
  swipeResume: {
    backgroundColor: "#2563eb", // blue
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
