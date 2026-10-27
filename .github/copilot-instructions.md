# Copilot instructions for Bodyio-Frontend

## Project architecture (Expo + file-based routing)
- This is an Expo Router app (`main: expo-router/entry`) with route files in `app/`.
- Entry redirect is `app/index.tsx`: reads `AsyncStorage.getItem("user")` and routes to `/(tabs)/home` or `/auth`.
- Root runtime wiring is in `app/_layout.tsx`: initializes notifications and RevenueCat once on app mount.
- Tab shell is `app/(tabs)/_layout.tsx` with 5 tabs: `home`, `upload`, `dashboard`, `history`, `settings`.

## Config + environment contract
- Runtime config is injected via `app.config.js` under `expo.extra` and read with `Constants.expoConfig.extra.*`.
- Required env keys: `API_URL`, `REVENUECAT_IOS_API_KEY`, `REVENUECAT_ANDROID_API_KEY`, `GOOGLE_WEB_CLIENT_ID`.
- Do not hardcode API base URLs in screen files; follow existing `const API_URL = Constants.expoConfig.extra.apiUrl` pattern.

## Core data flows you must preserve
- `AsyncStorage` key `"user"` is the canonical session snapshot used across screens (`auth`, `dashboard`, `settings`, `history`, `userinfo`).
- After mutating user data or premium state, code typically re-fetches `/users/{id}` and writes back to `AsyncStorage`.
- Premium sync pattern: call `/users/{id}/{platform}/verify_premium` before reading premium-gated user fields (see `dashboard.tsx`, `settings.tsx`, `goals.tsx`).
- Push token flow: use `registerForPushNotificationsAsync()` from `hooks/notifications.ts`, then POST `/users/{id}/push-token` if missing.

## Camera/upload workflow conventions
- Camera screen (`app/camera.tsx`) returns captured image via AsyncStorage bridge keys:
  - `camera_return_photo`
  - `camera_return_label`
- Upload/edit screens read those keys on focus (`useFocusEffect`), validate via backend, then clear keys.
- Weight unit preference is persisted as `"weight_unit"` and UI converts values between lbs/kg (do not silently change stored semantics).

## Auth and subscription integrations
- Email/Google/Apple auth flows live in `app/auth.tsx` and `app/createaccount.tsx`.
- RevenueCat is configured anonymously at startup, then user-linked with `Purchases.logIn(String(user.id))` after login.
- `useRevenueCat` (`hooks/useRevenueCat.ts`) fetches current offerings; settings uses it for paywall/subscription UI.

## UI + coding patterns specific to this repo
- Most screens keep styles inline; preserve existing style approach unless refactoring a full file.
- Theme is dark-first (frequent `#1f1f1f` backgrounds, light text, teal accents).
- Networking is mostly `fetch` (not centralized API clients), with defensive `res.ok` checks + `Alert.alert` for user-facing failures.
- Navigation is imperative via `useRouter()` (`router.push/replace/back`) rather than global state navigation.

## Developer workflows (verified from repo files)
- Install deps: `npm install`
- Run app: `npx expo start` (or `npm run start`)
- Platform runs: `npm run ios`, `npm run android`, `npm run web`
- Lint: `npm run lint`
- EAS profiles are defined in `eas.json`: `development`, `development-sim`, `preview`, `production`.
- There is no dedicated unit test script in `package.json`; rely on lint + manual smoke in Expo when changing flows.

## When making changes as an AI agent
- Keep route paths stable (`/(tabs)/...`) and avoid renaming files under `app/` unless navigation updates are intentional.
- If you touch auth/premium logic, validate both backend sync (`/users/.../verify_premium`) and local cache (`AsyncStorage "user"`).
- If you add new persistence keys, name them explicitly and clear them after one-time handoff patterns.
