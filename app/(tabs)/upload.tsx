import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as StoreReview from "expo-store-review";

const API_URL = Constants.expoConfig.extra.apiUrl;

const WEIGHT_LIMITS = {
  lbs: { min: 50, max: 800 },
  kg: { min: 20, max: 363 }, // ~50–800 lbs
} as const;

type CaptureMode = "mirror" | "tripod";

export default function UploadScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState("");

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const [toastMessage, setToastMessage] = useState("");
  const toastOpacity = useState(new Animated.Value(0))[0];

  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");

  const [date, setDate] = useState(new Date());

  const [front, setFront] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);

  // Mirror selfie is the default
  const [captureMode, setCaptureMode] =
    useState<CaptureMode>("mirror");

  const [validated, setValidated] = useState<{
    [key: string]: boolean;
  }>({
    front: false,
    side: false,
  });

  const [uploading, setUploading] = useState<{
    [key: string]: boolean;
  }>({});

  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------
  // Weight helpers
  // ------------------------------------------------------------

  const sanitizeWeightInput = (text: string) => {
    // allow digits + one decimal point
    let t = text.replace(/[^\d.]/g, "");

    const firstDot = t.indexOf(".");

    if (firstDot !== -1) {
      t =
        t.slice(0, firstDot + 1) +
        t.slice(firstDot + 1).replace(/\./g, "");
    }

    return t;
  };

  const lbsFrom = (
    value: number,
    unit: "lbs" | "kg"
  ) => (unit === "kg" ? value * 2.20462 : value);

  const validateWeight = (
    raw: string,
    unit: "lbs" | "kg"
  ) => {
    const cleaned = raw.trim();

    if (!cleaned) {
      return {
        ok: false as const,
        message: "Please enter a valid weight.",
      };
    }

    const n = Number(cleaned);

    if (!Number.isFinite(n)) {
      return {
        ok: false as const,
        message: "Please enter a valid weight.",
      };
    }

    const { min, max } = WEIGHT_LIMITS[unit];

    if (n < min || n > max) {
      return {
        ok: false as const,
        message: `Weight must be between ${min} and ${max} ${unit}.`,
      };
    }

    const lbs = lbsFrom(n, unit);

    if (
      lbs < WEIGHT_LIMITS.lbs.min ||
      lbs > WEIGHT_LIMITS.lbs.max
    ) {
      return {
        ok: false as const,
        message: `Weight must be between ${WEIGHT_LIMITS.lbs.min} and ${WEIGHT_LIMITS.lbs.max} lbs.`,
      };
    }

    return {
      ok: true as const,
      value: n,
    };
  };

  // ------------------------------------------------------------
  // App review
  // ------------------------------------------------------------

  const maybeRequestReview = async () => {
    if (Platform.OS !== "ios") return;

    const isAvailable =
      await StoreReview.isAvailableAsync();

    if (!isAvailable) return;

    const hasAlreadyPrompted =
      await AsyncStorage.getItem(
        "has_review_prompted"
      );

    if (hasAlreadyPrompted === "true") return;

    await StoreReview.requestReview();

    await AsyncStorage.setItem(
      "has_review_prompted",
      "true"
    );
  };

  // ------------------------------------------------------------
  // Refresh date when screen receives focus
  // ------------------------------------------------------------

  useFocusEffect(
    React.useCallback(() => {
      setDate(new Date());
    }, [])
  );

  // ------------------------------------------------------------
  // Onboarding
  // ------------------------------------------------------------

  useEffect(() => {
    async function checkOnboarding() {
      const seen =
        await AsyncStorage.getItem("seenOnboarding");

      if (seen !== "true") {
        await AsyncStorage.setItem(
          "seenOnboarding",
          "true"
        );

        router.push("/onboarding");
      }
    }

    checkOnboarding();
  }, []);

  // ------------------------------------------------------------
  // Load weight unit preference
  // ------------------------------------------------------------

  useEffect(() => {
    async function loadUnitPreference() {
      const saved =
        await AsyncStorage.getItem("weight_unit");

      if (saved === "kg" || saved === "lbs") {
        setUnit(saved);
      }
    }

    loadUnitPreference();
  }, []);

  // ------------------------------------------------------------
  // Load capture mode preference
  // ------------------------------------------------------------

  useEffect(() => {
    async function loadCaptureMode() {
      const saved =
        await AsyncStorage.getItem("capture_mode");

      if (saved === "mirror" || saved === "tripod") {
        setCaptureMode(saved);
      }
    }

    loadCaptureMode();
  }, []);

  // ------------------------------------------------------------
  // Camera return handling
  // ------------------------------------------------------------

  useFocusEffect(
    React.useCallback(() => {
      async function loadCameraResult() {
        const returnedPhoto =
          await AsyncStorage.getItem(
            "camera_return_photo"
          );

        const returnedLabel =
          await AsyncStorage.getItem(
            "camera_return_label"
          );

        if (returnedPhoto && returnedLabel) {
          const valid = await validateSinglePose(
            returnedLabel,
            returnedPhoto
          );

          if (valid) {
            if (returnedLabel === "front") {
              setFront(returnedPhoto);
            }

            if (returnedLabel === "side") {
              setSide(returnedPhoto);
            }
          }

          await AsyncStorage.removeItem(
            "camera_return_photo"
          );

          await AsyncStorage.removeItem(
            "camera_return_label"
          );
        }
      }

      loadCameraResult();
    }, [])
  );

  // ------------------------------------------------------------
  // Unit toggle
  // ------------------------------------------------------------

  const UnitToggle = ({
    unit,
    toggleUnit,
  }: {
    unit: "lbs" | "kg";
    toggleUnit: () => void;
  }) => {
    return (
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

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Text
            style={{
              color:
                unit === "lbs" ? "#000" : "#bbb",
              fontWeight: "700",
            }}
          >
            lbs
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Text
            style={{
              color:
                unit === "kg" ? "#000" : "#bbb",
              fontWeight: "700",
            }}
          >
            kg
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const toggleUnit = async () => {
    if (weight) {
      let converted = "";

      if (unit === "lbs") {
        converted = (
          parseFloat(weight) / 2.20462
        ).toFixed(1);

        setUnit("kg");
        setWeight(converted);

        await AsyncStorage.setItem(
          "weight_unit",
          "kg"
        );
      } else {
        converted = (
          parseFloat(weight) * 2.20462
        ).toFixed(1);

        setUnit("lbs");
        setWeight(converted);

        await AsyncStorage.setItem(
          "weight_unit",
          "lbs"
        );
      }
    } else {
      const newUnit =
        unit === "lbs" ? "kg" : "lbs";

      setUnit(newUnit);

      await AsyncStorage.setItem(
        "weight_unit",
        newUnit
      );
    }
  };

  // ------------------------------------------------------------
  // Capture mode
  // ------------------------------------------------------------

  const changeCaptureMode = async (
    mode: CaptureMode
  ) => {
    if (mode === captureMode) return;

    setCaptureMode(mode);

    await AsyncStorage.setItem(
      "capture_mode",
      mode
    );

    // Clear existing photos when switching modes.
    // Prevents accidentally mixing mirror + tripod photos.
    setFront(null);
    setSide(null);

    setValidated({
      front: false,
      side: false,
    });

    setUploading({});
  };

  // ------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------

  const showToast = (
    message: string,
    duration = 1500
  ) => {
    setToastMessage(message);

    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }).start();
      }, duration);
    });
  };

  // ------------------------------------------------------------
  // Load user
  // ------------------------------------------------------------

  useFocusEffect(
    React.useCallback(() => {
      const loadUser = async () => {
        const saved =
          await AsyncStorage.getItem("user");

        if (!saved) return;

        const parsed = JSON.parse(saved);

        setUser(parsed);

        console.log(parsed);

        setUserId(
          parsed.id?.toString?.() ?? ""
        );

        if (parsed.height == null) {
          const res = await fetch(
            `${API_URL}/users/${parsed.id}`
          );

          if (res.ok) {
            const data = await res.json();
            setHeight(data.height);
          }
        } else {
          setHeight(parsed.height);
        }
      };

      loadUser();
    }, [])
  );

  // ------------------------------------------------------------
  // Error helper
  // ------------------------------------------------------------

  const safeErrorMessage = (detail: any) => {
    if (!detail) {
      return "Request failed. Please try again.";
    }

    if (Array.isArray(detail)) {
      const msgs = detail
        .map((e) =>
          typeof e?.msg === "string"
            ? e.msg
            : null
        )
        .filter(Boolean);

      if (msgs.length) {
        return msgs.join("\n");
      }

      try {
        return JSON.stringify(detail);
      } catch {
        return "Request failed. Please try again.";
      }
    }

    if (typeof detail === "object") {
      if (
        typeof detail.message === "string"
      ) {
        return detail.message;
      }

      try {
        return JSON.stringify(detail);
      } catch {
        return "Request failed. Please try again.";
      }
    }

    return String(detail);
  };

  // ------------------------------------------------------------
  // Pose validation
  // ------------------------------------------------------------

  const validateSinglePose = async (
    label: string,
    uri: string
  ) => {
    setUploading((prev) => ({
      ...prev,
      [label]: true,
    }));

    try {
      const formData = new FormData();

      formData.append(
        "photo",
        {
          uri,
          name: `${label}.jpg`,
          type: "image/jpeg",
        } as any
      );

      const res = await fetch(
        `${API_URL}/validate_pose`,
        {
          method: "POST",
          body: formData,
        }
      );

      const raw = await res.text();

      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        Alert.alert(
          "Pose Invalid",
          safeErrorMessage(
            data?.detail ?? data ?? raw
          ) ||
            `Your ${label} photo didn’t pass validation.`
        );

        setValidated((prev) => ({
          ...prev,
          [label]: false,
        }));

        return false;
      }

      setValidated((prev) => ({
        ...prev,
        [label]: true,
      }));

      return true;
    } catch (err) {
      console.error(
        "Pose validation failed",
        err
      );

      Alert.alert(
        "Error",
        "Failed to validate image. Please try again."
      );

      return false;
    } finally {
      setUploading((prev) => ({
        ...prev,
        [label]: false,
      }));
    }
  };

  // ------------------------------------------------------------
  // Gallery
  // ------------------------------------------------------------

  const pickImage = async (
    setter: (v: string) => void,
    label: string
  ) => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Photo library access is required."
      );

      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

    if (!result.canceled) {
      const uri = result.assets[0].uri;

      const valid =
        await validateSinglePose(
          label,
          uri
        );

      if (valid) {
        setter(uri);
      }
    }
  };

  // ------------------------------------------------------------
  // Camera
  // ------------------------------------------------------------

  const takePhoto = (
    setter: (v: string) => void,
    label: string
  ) => {
    router.push({
      pathname: "/camera",
      params: {
        label,
        captureMode,
      },
    });
  };

  // ------------------------------------------------------------
  // Image source selection
  // ------------------------------------------------------------

  const chooseImageSource = (
    setter: (v: string) => void,
    label: string
  ) => {
    Alert.alert(
      "Select Option",
      `Choose your ${label} photo:`,
      [
        {
          text: "Take Photo",
          onPress: () =>
            takePhoto(setter, label),
        },
        {
          text: "Choose from Gallery",
          onPress: () =>
            pickImage(setter, label),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  // ------------------------------------------------------------
  // Save metric
  // ------------------------------------------------------------

  const handleSave = async () => {
    if (!userId) {
      Alert.alert(
        "Please wait",
        "Loading your profile… try again in a second."
      );

      return;
    }

    const w = validateWeight(
      weight,
      unit
    );

    if (!w.ok) {
      Alert.alert(
        "Invalid weight",
        w.message
      );

      return;
    }

    // ----------------------------------------------------------
    // Determine required photos
    // ----------------------------------------------------------

    const requiredPhotos =
      captureMode === "mirror"
        ? { front }
        : { front, side };

    // ----------------------------------------------------------
    // Ensure required photos exist
    // ----------------------------------------------------------

    const missingPhoto =
      Object.entries(requiredPhotos).some(
        ([, uri]) => !uri
      );

    if (missingPhoto) {
      Alert.alert(
        "Photo Required",
        captureMode === "mirror"
          ? "Please take a front photo before saving your scan."
          : "Please take both front and side photos before saving your scan."
      );

      return;
    }

    // ----------------------------------------------------------
    // Ensure required photos passed validation
    // ----------------------------------------------------------

    const invalidPhoto =
      Object.entries(requiredPhotos).some(
        ([key, uri]) =>
          uri && !validated[key]
      );

    if (invalidPhoto) {
      Alert.alert(
        "Validation Required",
        "Please make sure all photos pass validation before saving."
      );

      return;
    }

    console.log(
      "Height: ",
      height
    );

    if (!height) {
      Alert.alert(
        "Please update your height information in settings"
      );

      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      let finalWeight = String(w.value);

      if (unit === "kg") {
        finalWeight = (
          w.value * 2.20462
        ).toFixed(1);
      } else {
        finalWeight = w.value.toFixed(1);
      }

      formData.append(
        "user_id",
        userId
      );

      formData.append(
        "height",
        height
      );

      formData.append(
        "weight",
        finalWeight
      );

      formData.append(
        "taken_at",
        date.toISOString()
      );

      // --------------------------------------------------------
      // Front photo
      // --------------------------------------------------------

      if (front) {
        formData.append(
          "photo_front",
          {
            uri: front,
            name: "front.jpg",
            type: "image/jpeg",
          } as any
        );
      }

      // --------------------------------------------------------
      // Side photo ONLY for tripod mode
      // --------------------------------------------------------

      if (
        captureMode === "tripod" &&
        side
      ) {
        formData.append(
          "photo_side",
          {
            uri: side,
            name: "side.jpg",
            type: "image/jpeg",
          } as any
        );
      }

      // Optional: tell backend which workflow was used.
      // Remove this if your FastAPI endpoint doesn't accept it yet.
      formData.append(
        "capture_mode",
        captureMode
      );

      const res = await fetch(
        `${API_URL}/metrics`,
        {
          method: "POST",
          body: formData,
        }
      );

      const raw = await res.text();

      let payload: any = null;

      try {
        payload = raw
          ? JSON.parse(raw)
          : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const msg =
          safeErrorMessage(
            payload?.detail ??
              payload ??
              raw
          );

        console.log(
          "METRICS UPLOAD FAILED",
          {
            status: res.status,
            raw,
            payload,
            userId,
            height,
            unit,
            finalWeight,
            captureMode,
            hasFront: !!front,
            hasSide: !!side,
          }
        );

        Alert.alert(
          "Upload failed",
          msg
        );

        return;
      }

      showToast(
        "✅ Metric uploaded successfully!"
      );

      await AsyncStorage.setItem(
        "highlight_recent",
        "true"
      );

      // --------------------------------------------------------
      // Reset UI
      // --------------------------------------------------------

      setWeight("");

      setUnit(
        (await AsyncStorage.getItem(
          "weight_unit"
        )) || "lbs"
      );

      setDate(new Date());

      setFront(null);
      setSide(null);

      setValidated({
        front: false,
        side: false,
      });

      setUploading({});

      setTimeout(() => {
        router.push(
          "/(tabs)/dashboard"
        );

        setTimeout(() => {
          maybeRequestReview();
        }, 1200);
      }, 600);
    } catch (err: any) {
      console.log(
        "NETWORK/JS ERROR",
        err
      );

      const msg =
        typeof err?.message ===
        "string"
          ? err.message
          : typeof err === "string"
            ? err
            : "Network error. Please try again.";

      Alert.alert(
        "Error",
        msg
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // Clear photo
  // ------------------------------------------------------------

  const clearPhoto = (
    label: "front" | "side"
  ) => {
    if (label === "front") {
      setFront(null);
    }

    if (label === "side") {
      setSide(null);
    }

    setValidated((prev) => ({
      ...prev,
      [label]: false,
    }));
  };

  // ------------------------------------------------------------
  // Photo input
  // ------------------------------------------------------------

  const renderPhotoInput = (
    label: string,
    uri: string | null,
    setter: (
      v: string | null
    ) => void
  ) => {
    const key =
      label.toLowerCase() as
        | "front"
        | "side";

    const isUploading =
      !!uploading[key];

    const instruction =
      captureMode === "mirror"
        ? "Stand in front of a mirror with your full body visible (head to knees)"
        : label === "Front"
          ? "Face the camera and keep your full body visible (head to knees)"
          : "Turn sideways and keep your full body visible (head to knees)";

    return (
      <View
        style={styles.photoSection}
      >
        <Text style={styles.label}>
          {label} Photo
        </Text>

        <Text
          style={
            styles.photoInstruction
          }
        >
          {instruction}
        </Text>

        {uri ? (
          <View
            style={{
              position: "relative",
            }}
          >
            <Image
              source={{ uri }}
              style={styles.preview}
            />

            {isUploading && (
              <View
                style={
                  styles.photoSpinnerOverlay
                }
              >
                <ActivityIndicator
                  size="large"
                  color="#fff"
                />

                <Text
                  style={
                    styles.photoSpinnerText
                  }
                >
                  Processing…
                </Text>
              </View>
            )}

            {validated[key] && (
              <View
                style={styles.checkmark}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                  }}
                >
                  ✓
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View
            style={styles.placeholderBox}
          >
            <Text
              style={
                styles.placeholderIcon
              }
            >
              📷
            </Text>

            <Text
              style={
                styles.placeholder
              }
            >
              No photo yet
            </Text>
          </View>
        )}

        {validated[key] &&
          uri && (
            <Text
              style={
                styles.validatedText
              }
            >
              ✓ Photo looks good
            </Text>
          )}

        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor:
                "#fff",
              opacity: isUploading
                ? 0.6
                : 1,
            },
          ]}
          onPress={() =>
            !isUploading &&
            chooseImageSource(
              setter as any,
              key
            )
          }
          disabled={isUploading}
        >
          <Text
            style={[
              styles.buttonText,
              {
                color: "#000",
              },
            ]}
          >
            {isUploading
              ? "Processing…"
              : `${
                  uri
                    ? "Retake"
                    : "Take"
                } ${label} Photo`}
          </Text>
        </TouchableOpacity>

        {uri && (
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Remove photo?",
                `Clear your ${label.toLowerCase()} photo?`,
                [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: () =>
                      clearPhoto(
                        key
                      ),
                  },
                ]
              )
            }
            style={{
              marginTop: 8,
            }}
          >
            <Text
              style={
                styles.clearPhotoText
              }
            >
              Clear {label} Photo
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      {/* Help / onboarding */}
      <TouchableOpacity
        onPress={() =>
          router.push("/onboarding")
        }
        style={
          styles.helpButton
        }
      >
        <Text
          style={
            styles.helpButtonText
          }
        >
          ?
        </Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={
          styles.container
        }
      >
        <Text
          style={styles.title}
        >
          New Body Scan
        </Text>

        <View
          style={styles.card}
        >
          {/* -------------------------------------------------- */}
          {/* Date */}
          {/* -------------------------------------------------- */}

          <Text
            style={styles.label}
          >
            Date
          </Text>

          <View
            style={[
              styles.input,
              {
                justifyContent:
                  "center",
              },
            ]}
          >
            <Text
              style={{
                color: "#fff",
                textAlign:
                  "center",
              }}
            >
              {date.toDateString()}
            </Text>
          </View>

          {/* -------------------------------------------------- */}
          {/* Weight */}
          {/* -------------------------------------------------- */}

          <Text
            style={styles.label}
          >
            Weight ({unit})
          </Text>

          <View
            style={{
              marginBottom: 12,
            }}
          >
            <UnitToggle
              unit={unit}
              toggleUnit={
                toggleUnit
              }
            />
          </View>

          <TextInput
            style={[
              styles.input,
              {
                textAlign:
                  "center",
              },
            ]}
            value={weight}
            onChangeText={(t) =>
              setWeight(
                sanitizeWeightInput(
                  t
                )
              )
            }
            keyboardType={
              Platform.OS === "ios"
                ? "decimal-pad"
                : "numeric"
            }
            placeholder={
              unit === "lbs"
                ? "50–800"
                : "20–363"
            }
            placeholderTextColor="#777"
          />

          {/* -------------------------------------------------- */}
          {/* Capture mode */}
          {/* -------------------------------------------------- */}

          <View
            style={
              styles.scanHeader
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Body Photos
            </Text>

            <Text
              style={
                styles.helperText
              }
            >
              Choose how you'd like
              to take your photos.
            </Text>
          </View>

          <View
            style={
              styles.modeContainer
            }
          >
            {/* Mirror */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                changeCaptureMode(
                  "mirror"
                )
              }
              style={[
                styles.modeOption,
                captureMode ===
                  "mirror" &&
                  styles.modeOptionSelected,
              ]}
            >
              <Text
                style={
                  styles.modeIcon
                }
              >
                📱
              </Text>

              <View
                style={{
                  flex: 1,
                }}
              >
                <View
                  style={
                    styles.modeTitleRow
                  }
                >
                  <Text
                    style={
                      styles.modeTitle
                    }
                  >
                    Mirror Selfie
                  </Text>
                </View>

                <Text
                  style={
                    styles.modeDescription
                  }
                >
                  1 photo · Quick &
                  easy
                </Text>
              </View>

              {captureMode ===
                "mirror" && (
                <Text
                  style={
                    styles.modeCheck
                  }
                >
                  ✓
                </Text>
              )}
            </TouchableOpacity>

            {/* Tripod */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                changeCaptureMode(
                  "tripod"
                )
              }
              style={[
                styles.modeOption,
                captureMode ===
                  "tripod" &&
                  styles.modeOptionSelected,
              ]}
            >
              <Text
                style={
                  styles.modeIcon
                }
              >
                📸
              </Text>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.modeTitle
                  }
                >
                  Tripod
                </Text>

                <Text
                  style={
                    styles.modeDescription
                  }
                >
                  2 photos · Front +
                  side
                </Text>
              </View>

              {captureMode ===
                "tripod" && (
                <Text
                  style={
                    styles.modeCheck
                  }
                >
                  ✓
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* -------------------------------------------------- */}
          {/* Mirror instructions */}
          {/* -------------------------------------------------- */}

          {captureMode ===
            "mirror" && (
            <View
              style={
                styles.tipBox
              }
            >
              <Text
                style={
                  styles.tipTitle
                }
              >
                📱 Mirror selfie
              </Text>

              <Text
                style={
                  styles.tipText
                }
              >
                Stand far enough away
                that your entire body
                is visible in the mirror.
                Keep only head and knees visible.
              </Text>
            </View>
          )}

          {/* -------------------------------------------------- */}
          {/* Tripod instructions */}
          {/* -------------------------------------------------- */}

          {captureMode ===
            "tripod" && (
            <View
              style={
                styles.tipBox
              }
            >
              <Text
                style={
                  styles.tipTitle
                }
              >
                📸 Tripod setup
              </Text>

              <Text
                style={
                  styles.tipText
                }
              >
                Place your phone on a
                stable surface or tripod.
                Keep the camera around
                chest height and make
                sure your entire body
                is visible. Keep only 
                head and knees visible.
              </Text>
            </View>
          )}

          {/* -------------------------------------------------- */}
          {/* Front */}
          {/* -------------------------------------------------- */}

          {renderPhotoInput(
            "Front",
            front,
            setFront
          )}

          {/* -------------------------------------------------- */}
          {/* Side - Tripod only */}
          {/* -------------------------------------------------- */}

          {captureMode ===
            "tripod" &&
            renderPhotoInput(
              "Side",
              side,
              setSide
            )}
        </View>

        {/* ---------------------------------------------------- */}
        {/* Save */}
        {/* ---------------------------------------------------- */}

        <TouchableOpacity
          style={
            styles.saveButton
          }
          onPress={
            handleSave
          }
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator
              color="#000"
            />
          ) : (
            <Text
              style={
                styles.saveButtonText
              }
            >
              Save Body Scan
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Toast */}
      <Animated.View
        pointerEvents="none"
        style={{
          position:
            "absolute",
          bottom: 50,
          left: 0,
          right: 0,
          alignItems:
            "center",
          opacity:
            toastOpacity,
        }}
      >
        <View
          style={
            styles.toast
          }
        >
          <Text
            style={
              styles.toastText
            }
          >
            {toastMessage}
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1f1f1f",
  },

  container: {
    padding: 20,
    paddingTop: 30,
    paddingBottom: 40,
    flexGrow: 1,
  },

  card: {
    backgroundColor: "#2c2c2c",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },

  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },

  label: {
    color: "#d1d5db",
    marginBottom: 6,
    fontWeight: "600",
    alignSelf: "flex-start",
  },

  input: {
    backgroundColor: "#1f1f1f",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    borderRadius: 8,
    width: "100%",
    marginBottom: 20,
    textAlign: "left",
  },

  // ----------------------------------------------------------
  // Body scan section
  // ----------------------------------------------------------

  scanHeader: {
    width: "100%",
    marginTop: 2,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },

  helperText: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 14,
  },

  // ----------------------------------------------------------
  // Capture mode selector
  // ----------------------------------------------------------

  modeContainer: {
    width: "100%",
    gap: 10,
    marginBottom: 16,
  },

  modeOption: {
    width: "100%",
    minHeight: 76,
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3b3b3b",
  },

  modeOptionSelected: {
    borderColor: "#fff",
    backgroundColor: "#333333",
  },

  modeIcon: {
    fontSize: 27,
    marginRight: 12,
  },

  modeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 3,
  },

  modeTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  modeDescription: {
    color: "#9ca3af",
    fontSize: 13,
  },

  modeCheck: {
    color: "#22c55e",
    fontSize: 21,
    fontWeight: "700",
    marginLeft: 8,
  },

  recommendedBadge: {
    backgroundColor: "#16a34a",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  recommendedBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },

  // ----------------------------------------------------------
  // Tips
  // ----------------------------------------------------------

  tipBox: {
    width: "100%",
    backgroundColor: "#252525",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#3b3b3b",
  },

  tipTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 5,
  },

  tipText: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 19,
  },

  // ----------------------------------------------------------
  // Photos
  // ----------------------------------------------------------

  photoSection: {
    width: "100%",
    marginBottom: 24,
    alignItems: "center",
  },

  photoInstruction: {
    color: "#9ca3af",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 10,
    lineHeight: 18,
  },

  preview: {
    width: 160,
    height: 220,
    borderRadius: 8,
    marginBottom: 8,
  },

  placeholderBox: {
    width: 160,
    height: 220,
    borderRadius: 8,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#3b3b3b",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },

  placeholderIcon: {
    fontSize: 28,
    marginBottom: 8,
    opacity: 0.6,
  },

  placeholder: {
    color: "#777",
    marginBottom: 8,
  },

  validatedText: {
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },

  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#16a34a",
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 10,
    alignItems: "center",
    width: 200,
  },

  buttonText: {
    fontWeight: "600",
    fontSize: 16,
  },

  clearPhotoText: {
    color: "#f87171",
    fontWeight: "600",
  },

  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  saveButton: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },

  saveButtonText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 16,
  },

  // ----------------------------------------------------------
  // Photo processing
  // ----------------------------------------------------------

  photoSpinnerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor:
      "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  photoSpinnerText: {
    marginTop: 10,
    color: "#fff",
    fontWeight: "700",
  },

  // ----------------------------------------------------------
  // Help
  // ----------------------------------------------------------

  helpButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 50,
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: "#3b3b3b",
    justifyContent: "center",
    alignItems: "center",
  },

  helpButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  // ----------------------------------------------------------
  // Toast
  // ----------------------------------------------------------

  toast: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },

  toastText: {
    color: "#fff",
    fontWeight: "600",
  },
});
