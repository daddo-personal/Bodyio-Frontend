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
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";

const API_URL = Constants.expoConfig.extra.apiUrl;

const METRICS = [
  { key: "weight", label: "Weight" },
  { key: "bmi", label: "BMI" },
  { key: "fat_percent", label: "Fat %" },
  { key: "skeletal_muscle_percent", label: "Muscle %" },
  { key: "skeletal_muscle_pounds", label: "Muscle lbs" },
  { key: "fat_mass", label: "Fat Mass" },
];

// Converts date string "2025-12-31" into readable format
function formatDisplayDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return new Date(`${y}-${m}-${d}T00:00:00`).toDateString();
}

export default function GoalsScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any | null>(null);
  const [targetValue, setTargetValue] = useState<string>("");

  // ⭐ Store date as pure YYYY-MM-DD (NEVER as a Date object)
  const [selectedDate, setSelectedDate] = useState<{ year: string; month: string; day: string }>({
    year: "2025",
    month: "01",
    day: "01",
  });

  const [isPickerVisible, setPickerVisible] = useState(false);

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
  }, [userId]);

  const fetchGoals = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/goals/${userId}`);
      const data = await res.json();
      setGoals(data);
    } catch {}
  };

  // -----------------------------
  // Date Picker
  // -----------------------------
  const handleConfirmDate = (date: Date) => {
    // ⭐ EXTRACT ONLY THE DATE — THROW AWAY THE JS Date object
    const year = date.getFullYear().toString();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    setSelectedDate({ year, month, day });
    setPickerVisible(false);
  };

  const openCreateModal = () => {
    setEditingGoal({ metric: METRICS[0].key });
    setTargetValue("");
    setSelectedDate({
      year: String(new Date().getFullYear()),
      month: String(new Date().getMonth() + 1).padStart(2, "0"),
      day: String(new Date().getDate()).padStart(2, "0"),
    });
    setModalVisible(true);
  };

  const openEditModal = (goal: any) => {
    const [y, m, d] = goal.target_date.split("-");
    setEditingGoal(goal);
    setTargetValue(String(goal.target_value));
    setSelectedDate({ year: y, month: m, day: d });
    setModalVisible(true);
  };

  // -----------------------------
  // CREATE GOAL
  // -----------------------------
  const handleCreateGoal = async () => {
    if (!targetValue) return Alert.alert("Missing field", "Enter a value.");

    const ymd = `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;

    const payload = {
      user_id: userId,
      metric: editingGoal.metric,
      target_value: parseFloat(targetValue),
      target_date: ymd, // ⭐ EXACT DATE STRING — NO TIMEZONE EVER
    };

    try {
      const res = await fetch(`${API_URL}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();
      Alert.alert("Success", "Goal created");
      setModalVisible(false);
      fetchGoals();
    } catch {}
  };

  // -----------------------------
  // SAVE EDITED GOAL
  // -----------------------------
  const handleSaveGoal = async () => {
    if (!targetValue) return Alert.alert("Missing field", "Enter a value.");

    const ymd = `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;

    const payload = {
      user_id: userId,
      metric: editingGoal.metric,
      target_value: parseFloat(targetValue),
      target_date: ymd,
    };

    try {
      const res = await fetch(`${API_URL}/goals/${editingGoal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();
      Alert.alert("Success", "Goal updated");
      setModalVisible(false);
      fetchGoals();
    } catch {}
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
            await fetch(`${API_URL}/goals/${goalId}`, { method: "DELETE" });
            Alert.alert("Deleted");
            setModalVisible(false);
            fetchGoals();
          } catch {}
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>🎯 Your Goals</Text>

      {goals.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Text style={{ color: "#fff", marginBottom: 12 }}>
            You don't have any goals yet.
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
                <Text style={styles.goalDate}>
                  {formatDisplayDate(g.target_date)}
                </Text>
              </View>

              <Text style={styles.goalTargetLabel}>Target</Text>
              <Text style={styles.goalTargetValue}>{g.target_value}</Text>
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
                    const disabled =
                      !isPremium && !["weight", "bmi"].includes(item.key);

                    return (
                      <TouchableOpacity
                        disabled={disabled}
                        style={[
                          styles.metricChip,
                          editingGoal?.metric === item.key &&
                            styles.metricChipActive,
                          disabled && styles.metricChipDisabled,
                        ]}
                        onPress={() =>
                          setEditingGoal({ ...editingGoal, metric: item.key })
                        }
                      >
                        <Text
                          style={[
                            styles.metricChipText,
                            editingGoal?.metric === item.key &&
                              styles.metricChipTextActive,
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
            <Text style={styles.modalLabel}>Target Value</Text>
            <TextInput
              style={styles.modalInput}
              value={targetValue}
              placeholder="Enter value"
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
            />

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() =>
                  editingGoal?.id ? handleSaveGoal() : handleCreateGoal()
                }
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
