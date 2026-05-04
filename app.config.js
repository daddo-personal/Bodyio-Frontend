import "dotenv/config";

export default ({ config }) => ({
  ...config,
  expo: {
    name: "body.io",
    slug: "body-io",
    owner: "daddo0823",
    version: "1.0.2",
    orientation: "portrait",
    icon: "./assets/images/BodyIO.png",
    scheme: "frontend",
    userInterfaceStyle: "automatic",

    experiments: {
      nt: true,
    },

    ios: {
      supportsTablet: true,
      usesAppleSignIn: true,
      bundleIdentifier: "com.daddo0823.bodyio",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "Body.io uses the camera to capture progress photos that are analyzed to estimate body fat percentage and muscle composition. For example, we use these photos to generate body metrics and track changes over time.",
        NSPhotoLibraryUsageDescription: "Body.io accesses your photo library so you can choose existing progress photos to analyze body composition and track your progress over time."
      },
    },

    android: {
      icon: "./assets/images/BodyIO.png",
      permissions: ["android.permission.RECORD_AUDIO"],
      package: "com.daddo0823.bodyio",
      googleServicesFile: "./google-services.json",
      versionCode: 2,
      privacyPolicyUrl: "https://github.com/daddo-personal/Bodyio-Frontend/blob/main/privacy.md",
    },

    web: {
      output: "static",
      favicon: "./assets/images/BodyIO.png",
    },

    plugins: [
      "expo-router",
      "expo-apple-authentication",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Body.io needs access to your photos so you can select progress photos to analyze body composition and track changes over time.",
          cameraPermission: "Body.io needs camera access so you can take progress photos that are analyzed to estimate body fat and muscle metrics."
        },
      ],
      "expo-font",
      "expo-web-browser",
      "expo-notifications",
      "expo-build-properties",
    ],

    extra: {
      router: {},
      eas: {
        projectId: "cf2c3344-dff9-49db-8b3e-aeaad2df071e",
      },

      // ✅ ENV → Constants.expoConfig.extra.*
      apiUrl: process.env.API_URL,
      revenuecatIOSApiKey: process.env.REVENUECAT_IOS_API_KEY,
      revenuecatAndroidApiKey: process.env.REVENUECAT_ANDROID_API_KEY,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    },
  },
});
