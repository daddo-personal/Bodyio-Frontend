import React, { useState } from "react";
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
  const [height, setHeight] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "other" | "">("");

  const handleSubmit = async () => {
    if (!age || !weight || !height || !ethnicity || !sex) {
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

      const res = await fetch(`${API_URL}/users/${userID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: parseInt(age),
          weight: parseFloat(weight),
          height: parseFloat(height),
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

        <Text style={styles.label}>Weight (lbs)</Text>
        <TextInput
          placeholder="Enter your weight"
          placeholderTextColor="#9ca3af"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Height (inches)</Text>
        <TextInput
          placeholder="Enter your height"
          placeholderTextColor="#9ca3af"
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          style={styles.input}
        />

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
        <TextInput
          placeholder="e.g. African American, Asian, Hispanic..."
          placeholderTextColor="#9ca3af"
          value={ethnicity}
          onChangeText={setEthnicity}
          style={styles.input}
        />

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
  safeArea: {
    flex: 1,
    backgroundColor: "#1f1f1f",
  },
  container: {
    flexGrow: 1,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 24,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 6,
  },
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
    justifyContent: "space-between",
    marginBottom: 16,
  },
  option: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#3f3f3f",
    backgroundColor: "#2c2c2c",
    marginHorizontal: 4,
  },
  optionSelected: {
    borderColor: "#fff",
    backgroundColor: "#3b3b3b",
  },
  optionText: {
    color: "#d1d5db",
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  button: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "600",
    fontSize: 16,
  },
};
