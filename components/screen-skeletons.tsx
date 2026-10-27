import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Skeleton } from "./ui/skeleton";

export function DashboardSkeletonScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton width="50%" height={28} style={styles.gapM} />

        <View style={styles.card}>
          <Skeleton width="70%" height={22} style={styles.gapM} />
          <View style={styles.grid}>
            <Skeleton width="48%" height={84} />
            <Skeleton width="48%" height={84} />
            <Skeleton width="48%" height={84} />
            <Skeleton width="48%" height={84} />
          </View>
        </View>

        <Skeleton width="100%" height={40} style={styles.gapM} />
        <Skeleton width="100%" height={220} style={styles.gapM} />

        <View style={styles.statsRow}>
          <Skeleton width="48%" height={84} />
          <Skeleton width="48%" height={84} />
          <Skeleton width="48%" height={84} />
          <Skeleton width="48%" height={84} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function SettingsSkeletonScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.centerContainer}>
        <Skeleton width="42%" height={26} style={styles.gapM} />

        <View style={styles.card}>
          <Skeleton width="50%" height={20} style={styles.gapM} />
          <Skeleton width="100%" height={84} style={styles.gapM} />
          <Skeleton width="100%" height={50} style={styles.gapS} />
          <Skeleton width="100%" height={50} style={styles.gapS} />
          <Skeleton width="100%" height={50} style={styles.gapS} />
        </View>

        <View style={styles.card}>
          <Skeleton width="45%" height={20} style={styles.gapM} />
          <Skeleton width="100%" height={46} style={styles.gapS} />
          <Skeleton width="100%" height={46} style={styles.gapS} />
          <Skeleton width="100%" height={46} style={styles.gapS} />
          <Skeleton width="100%" height={46} style={styles.gapS} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function HistorySkeletonScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton width="65%" height={24} style={styles.gapM} />

        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.historyCard}>
            <Skeleton width="45%" height={18} style={styles.gapS} />
            <Skeleton width="100%" height={12} style={styles.gapS} />
            <Skeleton width="100%" height={12} style={styles.gapS} />
            <Skeleton width="70%" height={12} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PaywallPlansSkeleton() {
  return (
    <View style={{ marginTop: 8 }}>
      <Skeleton width="100%" height={84} style={styles.gapS} />
      <Skeleton width="100%" height={84} style={styles.gapS} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1f1f1f",
  },
  container: {
    padding: 16,
  },
  centerContainer: {
    padding: 24,
    alignItems: "center",
  },
  card: {
    width: "100%",
    backgroundColor: "#2c2c2c",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  historyCard: {
    backgroundColor: "#2c2c2c",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  gapM: {
    marginBottom: 14,
  },
  gapS: {
    marginBottom: 10,
  },
});
