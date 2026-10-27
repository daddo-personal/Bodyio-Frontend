import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases from "react-native-purchases";
import useRevenueCat from "../hooks/useRevenueCat";
import { PaywallPlansSkeleton } from "../components/screen-skeletons";

const API_URL = Constants.expoConfig?.extra?.apiUrl;
const PRIVACY_POLICY_URL = "https://privacy.bodyio.org/privacy";
const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export default function PaywallScreen() {
  const router = useRouter();
  const { offerings, loading: offeringsLoading } = useRevenueCat();
  const [submitting, setSubmitting] = useState(false);
  const params = useLocalSearchParams<{ source?: string }>();

  const subtitle = useMemo(() => {
    switch (params?.source) {
      case "after_scan":
        return "Nice work on your scan. Unlock Premium to get unlimited scans and deeper body composition insights.";
      case "locked_metric":
        return "That metric is part of Premium. Upgrade to unlock all body metrics and trends.";
      case "dashboard":
        return "Upgrade to Premium to unlock all dashboard insights, goals, and unlimited scans.";
      default:
        return "Unlock unlimited scans, all body metrics, full goal insights, and CSV exports.";
    }
  }, [params?.source]);

  const trackPaywallEvent = async (event: string, extra?: Record<string, any>) => {
    try {
      const payload = {
        event,
        source: params?.source || "unknown",
        at: new Date().toISOString(),
        ...(extra || {}),
      };

      console.log("[paywall-event]", payload);

      const raw = await AsyncStorage.getItem("paywall_events");
      const prev = raw ? JSON.parse(raw) : [];
      const next = [...prev, payload].slice(-30);
      await AsyncStorage.setItem("paywall_events", JSON.stringify(next));
    } catch (e) {
      console.log("trackPaywallEvent error:", e);
    }
  };

  useEffect(() => {
    trackPaywallEvent("shown");
  }, []);

  const refreshUserFromBackend = async () => {
    try {
      const saved = await AsyncStorage.getItem("user");
      if (!saved) return;

      const parsed = JSON.parse(saved);
      if (!parsed?.id || !API_URL) return;

      const verifyUrl = `${API_URL}/users/${parsed.id}/${Platform.OS}/verify_premium`;
      await fetch(verifyUrl).catch(() => null);

      const res = await fetch(`${API_URL}/users/${parsed.id}`);
      if (!res.ok) return;

      const updated = await res.json();
      await AsyncStorage.setItem("user", JSON.stringify(updated));
    } catch (e) {
      console.log("refreshUserFromBackend error:", e);
    }
  };

  const closePaywall = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/dashboard");
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem("paywall_last_seen_at", String(Date.now()));
    await trackPaywallEvent("skipped");
    closePaywall();
  };

  const handlePurchase = async (pkg: any) => {
    try {
      setSubmitting(true);
      await trackPaywallEvent("purchase_started", { package: pkg?.identifier });
      await Purchases.purchasePackage(pkg);
      await refreshUserFromBackend();
      await AsyncStorage.removeItem("show_paywall_after_scan");
      await AsyncStorage.setItem("paywall_last_seen_at", String(Date.now()));
      await trackPaywallEvent("purchase_success", { package: pkg?.identifier });

      Alert.alert("Success!", "Your Premium subscription is now active.", [
        { text: "Continue", onPress: closePaywall },
      ]);
    } catch (err: any) {
      if (err?.userCancelled) {
        await trackPaywallEvent("purchase_cancelled", { package: pkg?.identifier });
        return;
      }
      await trackPaywallEvent("purchase_failed", {
        package: pkg?.identifier,
        message: err?.message || "unknown",
      });
      Alert.alert("Purchase Failed", err?.message || "Could not complete purchase.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    try {
      setSubmitting(true);
      await trackPaywallEvent("restore_started");
      await Purchases.restorePurchases();
      await refreshUserFromBackend();
      await trackPaywallEvent("restore_success");
      Alert.alert("Restored", "Your purchases were restored.", [{ text: "OK", onPress: closePaywall }]);
    } catch (e: any) {
      await trackPaywallEvent("restore_failed", { message: e?.message || "unknown" });
      Alert.alert("Restore Failed", e?.message || "Could not restore purchases.");
    } finally {
      setSubmitting(false);
    }
  };

  const openLink = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Link error", "Could not open link.");
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1f1f1f" }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
        <TouchableOpacity onPress={handleSkip} style={{ alignSelf: "flex-start", marginBottom: 14 }}>
          <Text style={{ color: "#d1d5db", fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: "#2c2c2c",
            borderWidth: 1,
            borderColor: "#3f3f3f",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center" }}>
            Unlock BodyIO Premium
          </Text>

          <Text
            style={{
              color: "#d1d5db",
              fontSize: 15,
              textAlign: "center",
              marginTop: 10,
              lineHeight: 22,
            }}
          >
            {subtitle}
          </Text>

          <View
            style={{
              marginTop: 18,
              backgroundColor: "#1f1f1f",
              borderWidth: 1,
              borderColor: "#3f3f3f",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
              Premium Features
            </Text>
            <Text style={{ color: "#d1d5db", marginBottom: 4 }}>• Unlimited Scans</Text>
            <Text style={{ color: "#d1d5db", marginBottom: 4 }}>• All Body Metrics</Text>
            <Text style={{ color: "#d1d5db", marginBottom: 4 }}>• Goals & Insights for all metrics</Text>
            <Text style={{ color: "#d1d5db" }}>• CSV Data Downloads</Text>
          </View>

          <View style={{ marginTop: 18 }}>
            {offeringsLoading && <PaywallPlansSkeleton />}

            {offerings?.availablePackages?.map((pkg: any) => {
              const isAnnual = pkg.packageType === "ANNUAL";

              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  onPress={() => handlePurchase(pkg)}
                  disabled={submitting}
                  style={{
                    backgroundColor: isAnnual ? "#252c1f" : "#1f1f1f",
                    borderColor: isAnnual ? "#16a34a" : "#3f3f3f",
                    borderWidth: 1.5,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                    {isAnnual ? "Yearly Premium" : "Monthly Premium"}
                  </Text>
                  <Text style={{ color: "#d1d5db", marginTop: 4 }}>{pkg.product?.priceString}</Text>
                  {isAnnual && (
                    <Text style={{ color: "#16a34a", marginTop: 6, fontWeight: "700", fontSize: 12 }}>
                      BEST VALUE
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {!offerings?.availablePackages?.length && !offeringsLoading && (
              <Text style={{ color: "#9ca3af", textAlign: "center", marginBottom: 10 }}>
                Could not load plans right now.
              </Text>
            )}

            {Platform.OS === "ios" && (
              <TouchableOpacity
                onPress={handleRestore}
                disabled={submitting}
                style={{
                  marginTop: 6,
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>Restore Purchases</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSkip}
              disabled={submitting}
              style={{
                marginTop: 10,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#3f3f3f",
                backgroundColor: "#1f1f1f",
              }}
            >
              <Text style={{ color: "#e5e7eb", fontWeight: "700", fontSize: 15 }}>Maybe later</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: "#9ca3af", fontSize: 12, lineHeight: 18, marginTop: 14 }}>
            Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
            <Text
              onPress={() => router.push({ pathname: "/contact" })}
              style={{ color: "#fff", fontSize: 13, textDecorationLine: "underline" }}
            >
              Contact Support
            </Text>

            <Text
              onPress={() => openLink(TERMS_OF_USE_URL)}
              style={{ color: "#fff", fontSize: 13, textDecorationLine: "underline" }}
            >
              Terms of Use
            </Text>
          </View>

          <Text
            onPress={() => openLink(PRIVACY_POLICY_URL)}
            style={{ color: "#9ca3af", fontSize: 12, marginTop: 8, textDecorationLine: "underline" }}
          >
            Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
