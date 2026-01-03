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
    if (
      !age ||
      !weight ||
      !heightFeet ||
      heightInches === "" ||
      !ethnicity ||
      !sex
    ) {
      Alert.alert("Missing info", "Please fill out all fields.");
      return;
    }

    try {
      const saved = await AsyncStorage.getItem("user");
      if (!saved) {
        Alert.alert("Error", "No user found. Please sign up again.");
        return;
      }

      const parsed = JSON.parse(saved);
      const userID = parsed.id;

      // 🆕 Always convert to lbs before saving to backend
      const finalWeight =
        unit === "kg" ? (parseFloat(weight) * 2.20462).toFixed(1) : weight;

      const feet = parseInt(heightFeet, 10);
      const inches = parseInt(heightInches, 10);

      if (Number.isNaN(feet) || feet <= 0) {
        Alert.alert("Height error", "Enter a valid height (feet).");
        return;
      }
      if (Number.isNaN(inches) || inches < 0 || inches > 11) {
        Alert.alert("Height error", "Inches must be between 0 and 11.");
        return;
      }

      const totalHeightInches =
       parseInt(heightFeet) * 12 + parseInt(heightInches); 

      const res = await fetch(`${API_URL}/users/${userID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: parseInt(age),
          weight: parseFloat(finalWeight),
          height: totalHeightInches,
          ethnicity,
          sex,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        Alert.alert("Error", error.detail || "Failed to update user info.");
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
          onChangeText={setWeight}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Height</Text>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <TextInput
            placeholder="Feet"
            placeholderTextColor="#9ca3af"
            value={heightFeet}
            onChangeText={setHeightFeet}
            keyboardType="numeric"
            style={[styles.input, { flex: 1 }]}
          />

          <TextInput
            placeholder="Inches"
            placeholderTextColor="#9ca3af"
            value={heightInches}
            onChangeText={setHeightInches}
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
