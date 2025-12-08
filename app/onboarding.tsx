import React from "react";
import Onboarding from "react-native-onboarding-swiper";
import { View, Image } from "react-native"; // ✅ added View here
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function OnboardingScreen() {
  const router = useRouter();

  const handleDone = async () => {
    await AsyncStorage.setItem("seenOnboarding", "true");
    router.replace("/(tabs)/upload");
  };

  return (
    <Onboarding
      onSkip={handleDone}
      onDone={handleDone}
      containerStyles={{ backgroundColor: "#1f1f1f" }}
      titleStyles={{
        fontWeight: "700",
        fontSize: 24,
        color: "#fff",
        textAlign: "center",
        marginBottom: 8,
      }}
      subTitleStyles={{
        fontSize: 16,
        textAlign: "center",
        color: "#9ca3af",
        paddingHorizontal: 16,
      }}
      bottomBarHighlight={false}
      transitionAnimationDuration={400}
      showSkip={true}
      skipLabel="Skip"
      nextLabel="Next"
      doneLabel="Get Started"
      skipToPage={3}
      controlStatusBar={false}
      imageContainerStyles={{
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
      }}
      pages={[
        {
          backgroundColor: "#1f1f1f",
          image: (
            <Image
              source={require("../assets/images/onboarding/good_lighting.png")}
              style={{ width: 250, height: 250, resizeMode: "contain" }}
            />
          ),
          title: "🕶️ Good Lighting & Plain Background",
          subtitle:
            "Ensure you’re in a well-lit area with an uncluttered, plain background. No shadows",
        },
        {
          backgroundColor: "#1f1f1f",
          image: (
            <Image
              source={require("../assets/images/onboarding/front_pose.png")}
              style={{ width: 250, height: 250, resizeMode: "contain" }}
            />
          ),
          title: "📸 Front Pose",
          subtitle: "Stand tall and face forward for your front photo, with relaxed arms.",
        },
        {
          backgroundColor: "#1f1f1f",
          image: (
            <Image
              source={require("../assets/images/onboarding/side_pose.png")}
              style={{ width: 250, height: 250, resizeMode: "contain" }}
            />
          ),
          title: "↔️ Side Pose",
          subtitle: "Turn to the side and capture a clear side profile, with relaxed arms.",
        },
        {
          backgroundColor: "#1f1f1f",
          image: (
            <Image
              source={require("../assets/images/onboarding/back_pose.png")}
              style={{ width: 250, height: 250, resizeMode: "contain" }}
            />
          ),
          title: "🔙 Back Pose",
          subtitle: "Face away from the camera and take your final photo, with relaxed arms.",
        },
      ]}
      DotComponent={({ selected }) => (
        <View
          style={{
            width: 8,
            height: 8,
            marginHorizontal: 4,
            borderRadius: 4,
            backgroundColor: selected ? "#22d3ee" : "#4b5563",
          }}
        />
      )}
    />
  );
}
