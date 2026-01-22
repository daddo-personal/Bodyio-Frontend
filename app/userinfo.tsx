import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig.extra.apiUrl;
const WEIGHT_LIMITS = {
  lbs: { min: 50, max: 800 },
  kg: { min: 20, max: 363 }, // ~50–800 lbs
} as const;

const HEIGHT_LIMITS_IN = { min: 36, max: 96 }; // 3'0" to 8'0"
export default function UserInfo() {
  const router = useRouter();

  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "other" | "">("");

  // 🆕 UNIT STATE
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");

  // 🆕 Load unit preference
  useEffect(() => {
    async function loadUnit() {
      const saved = await AsyncStorage.getItem("weight_unit");
      if (saved === "lbs" || saved === "kg") setUnit(saved);
    }
    loadUnit();
  }, []);


  const sanitizeNumberInput = (text: string) => {
    // digits + one decimal (for weight)
    let t = text.replace(/[^\d.]/g, "");
    const firstDot = t.indexOf(".");
    if (firstDot !== -1) {
      t = t.slice(0, firstDot + 1) + t.slice(firstDot + 1).replace(/\./g, "");
    }
    return t;
  };

  const sanitizeIntInput = (text: string) => text.replace(/[^\d]/g, "");

  const validateWeight = (raw: string, unit: "lbs" | "kg") => {
    const cleaned = raw.trim();
    if (!cleaned) return { ok: false as const, message: "Please enter a valid weight." };

    const n = Number(cleaned);
    if (!Number.isFinite(n)) return { ok: false as const, message: "Please enter a valid weight." };

    const { min, max } = WEIGHT_LIMITS[unit];
    if (n < min || n > max) {
      return { ok: false as const, message: `Weight must be between ${min} and ${max} ${unit}.` };
    }

    return { ok: true as const, value: n };
  };

  const validateHeightFtIn = (feetRaw: string, inchesRaw: string) => {
    const feet = Number(feetRaw);
    const inches = Number(inchesRaw);

    if (!Number.isFinite(feet) || feet <= 0) {
      return { ok: false as const, message: "Enter a valid height (feet)." };
    }
    if (!Number.isFinite(inches) || inches < 0 || inches > 11) {
      return { ok: false as const, message: "Inches must be between 0 and 11." };
    }

    const totalIn = feet * 12 + inches;

    if (totalIn < HEIGHT_LIMITS_IN.min || totalIn > HEIGHT_LIMITS_IN.max) {
      const minFt = Math.floor(HEIGHT_LIMITS_IN.min / 12);
      const minIn = HEIGHT_LIMITS_IN.min % 12;
      const maxFt = Math.floor(HEIGHT_LIMITS_IN.max / 12);
      const maxIn = HEIGHT_LIMITS_IN.max % 12;
      return {
        ok: false as const,
        message: `Height must be between ${minFt}'${minIn}" and ${maxFt}'${maxIn}".`,
      };
    }

    return { ok: true as const, value: totalIn };
  };

  // 🆕 Toggle lbs/kg + convert inputted weight
  const toggleUnit = async () => {
    if (weight) {
      let converted = "";

      if (unit === "lbs") {
        converted = (parseFloat(weight) / 2.20462).toFixed(1);
        setUnit("kg");
        setWeight(converted);
        await AsyncStorage.setItem("weight_unit", "kg");
      } else {
        converted = (parseFloat(weight) * 2.20462).toFixed(1);
        setUnit("lbs");
        setWeight(converted);
        await AsyncStorage.setItem("weight_unit", "lbs");
      }
    } else {
      const newUnit = unit === "lbs" ? "kg" : "lbs";
      setUnit(newUnit);
      await AsyncStorage.setItem("weight_unit", newUnit);
    }
  };

  // 🆕 UI Toggle Component
  const UnitToggle = () => (
    <TouchableOpacity
      onPress={toggleUnit}
      activeOpacity={0.9}
      style={{
        width: 80,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#3b3b3b",
        padding: 3,
        flexDirection: "row",
        alignItems: "center",
        position: "relative",
        marginBottom: 10,
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 34,
          height: 32,
          borderRadius: 17,
          backgroundColor: "#fff",
          left: unit === "lbs" ? 2 : 44,
          top: 1,
          zIndex: 5,
        }}
      />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: unit === "lbs" ? "#fff" : "#bbb", fontWeight: "700" }}>lbs</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: unit === "kg" ? "#fff" : "#bbb", fontWeight: "700" }}>kg</Text>
      </View>
    </TouchableOpacity>
  );

  const handleSubmit = async () => {
    if (!age || !weight || !heightFeet || heightInches === "" || !ethnicity || !sex) {
      Alert.alert("Missing info", "Please fill out all fields.");
      return;
    }

    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 10 || ageNum > 120) {
      Alert.alert("Age error", "Enter a valid age.");
      return;
    }

    const w = validateWeight(weight, unit);
    if (!w.ok) {
      Alert.alert("Weight error", w.message);
      return;
    }

    const h = validateHeightFtIn(heightFeet, heightInches);
    if (!h.ok) {
      Alert.alert("Height error", h.message);
      return;
    }

    // Always store lbs in backend
    const finalWeightLbs = unit === "kg" ? w.value * 2.20462 : w.value;

    try {
      const saved = await AsyncStorage.getItem("user");
      if (!saved) {
        Alert.alert("Error", "No user found. Please sign up again.");
        return;
      }

      const parsed = JSON.parse(saved);
      const userID = parsed.id;

      const res = await fetch(`${API_URL}/users/${userID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: Math.round(ageNum),
          weight: Number(finalWeightLbs.toFixed(1)),
          height: Math.round(h.value), // total inches
          ethnicity,
          sex,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        Alert.alert("Error", error?.detail || "Failed to update user info.");
        return;
      }

      const updatedUser = await res.json();
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      router.replace("/(tabs)/home");
    } catch (err) {
      console.error("❌ Network error:", err);
      Alert.alert("Network Error", "Unable to update user info. Try again later.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Tell us about yourself 🧍‍♂️</Text>

        <Text style={styles.label}>Age</Text>
        <TextInput
          placeholder="Enter your age"
          placeholderTextColor="#9ca3af"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          style={styles.input}
        />

        {/* 🆕 Weight Section With Toggle */}
        <Text style={styles.label}>Weight ({unit})</Text>
        <UnitToggle />

        <TextInput
          placeholder={`Enter your weight in ${unit}`}
          placeholderTextColor="#9ca3af"
          value={weight}
          onChangeText={(t) => setWeight(sanitizeNumberInput(t))}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Height</Text>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <TextInput
            placeholder="Feet"
            placeholderTextColor="#9ca3af"
            value={heightFeet}
            onChangeText={(t) => setHeightFeet(sanitizeIntInput(t))}
            keyboardType="numeric"
            style={[styles.input, { flex: 1 }]}
          />

          <TextInput
            placeholder="Inches"
            placeholderTextColor="#9ca3af"
            value={heightInches}
            onChangeText={(t) => setHeightInches(sanitizeIntInput(t))}
            keyboardType="numeric"
            style={[styles.input, { flex: 1 }]}
          />

        </View>

        <Text style={styles.label}>Sex</Text>
        <View style={styles.optionContainer}>
          {["male", "female", "other"].map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setSex(option as any)}
              style={[
                styles.option,
                sex === option && styles.optionSelected,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  sex === option && styles.optionTextSelected,
                ]}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Ethnicity</Text>
        <View style={styles.optionContainer}>
          {[
            "African American",
            "Asian",
            "Hispanic",
            "White",
            "Middle Eastern",
            "Pacific Islander",
            "Native American",
            "Other",
          ].map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setEthnicity(option)}
              style={[
                styles.option,
                ethnicity === option && styles.optionSelected,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  ethnicity === option && styles.optionTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.button, { backgroundColor: "#fff", marginTop: 24 }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: { flex: 1, backgroundColor: "#1f1f1f" },
  container: { flexGrow: 1, padding: 24 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 24,
    textAlign: "center",
  },
  label: { fontSize: 16, fontWeight: "600", color: "#fff", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#3f3f3f",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#2c2c2c",
    color: "#fff",
  },
  optionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  option: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#3f3f3f",
    backgroundColor: "#2c2c2c",
    marginBottom: 8,
  },
  optionSelected: { borderColor: "#fff", backgroundColor: "#3b3b3b" },
  optionText: { color: "#d1d5db", fontWeight: "500" },
  optionTextSelected: { color: "#fff", fontWeight: "700" },
  button: { borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { fontWeight: "600", fontSize: 16 },
};
