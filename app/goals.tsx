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

const API_URL = Constants.expoConfig.extra.apiUrl;

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

    // Optional sanity checks
    if (isPercentMetric(editingGoal.metric) && (parsed < 0 || parsed > 100)) {
      return Alert.alert("Invalid %", "Percent goals must be between 0 and 100.");
    }
    if (editingGoal.metric === "bmi" && (parsed < 5 || parsed > 80)) {
      // loose bounds, just to catch typos
      return Alert.alert("Invalid BMI", "Enter a realistic BMI value.");
    }
    if (editingGoal.metric === "weight" && parsed <= 0) {
      return Alert.alert("Invalid weight", "Weight must be greater than 0.");
    }

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

  // -----------------------------
  // SAVE EDITED GOAL
  // -----------------------------
  const handleSaveGoal = async () => {
    if (!editingGoal?.id) return;
    if (!targetValue) return Alert.alert("Missing field", "Enter a value.");

    const metricKey = editingGoal.metric;
    const parsed = parseTargetValue(targetValue, metricKey);
    if (parsed == null) return Alert.alert("Invalid value", "Enter a valid number.");

    if (isPercentMetric(metricKey) && (parsed < 0 || parsed > 100)) {
      return Alert.alert("Invalid %", "Percent goals must be between 0 and 100.");
    }
    if (metricKey === "bmi" && (parsed < 5 || parsed > 80)) {
      return Alert.alert("Invalid BMI", "Enter a realistic BMI value.");
    }
    if (metricKey === "weight" && parsed <= 0) {
      return Alert.alert("Invalid weight", "Weight must be greater than 0.");
    }

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

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>🎯 Your Goals</Text>

      {goals.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Text style={{ color: "#fff", marginBottom: 12 }}>
            You don&apos;t have any goals yet.
          </Text>
          <TouchableOpacity style={styles.saveButton} onPress={openCreateModal}>
            <Text style={{ fontWeight: "600", color: "#000" }}>
              Create Your First Goal
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {goals.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.goalCard}
              onPress={() => openEditModal(g)}
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
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.saveButton, { marginTop: 16 }]}
            onPress={openCreateModal}
          >
            <Text style={{ fontWeight: "600", color: "#000" }}>Add Another Goal</Text>
          </TouchableOpacity>
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
});
