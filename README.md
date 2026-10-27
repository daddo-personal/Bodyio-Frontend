# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install expo@54.0.20 expo-router@~6.0.13
   npx expo install react-native-screens react-native-safe-area-context 
   npx expo install @expo/vector-icons
   react-native-gesture-handler react-native-reanimated expo-constants expo-linking expo-status-bar
   npx expo install react-native-iap
   rm -rf node_modules package-lock.json .expo
   npm install
   ```

### EAS ios build development
https://expo.dev/accounts/<account_id>/settings/apple-devices to register device
rm -rf node_modules package-lock.json
npm install
eas build -p ios --profile development --clear-cache
npx expo start

### EAS android build development
rm -rf node_modules package-lock.json
npm install
eas build -p android --profile development --clear-cache
eas build -p android --profile preview --clear-cache for AAB needed for android playstore release 

Once app is built for android preview/production visit https://play.google.com/console/developers/app/keymanagement to and copy SHA1 fingerprint. Paste this fingerprint in https://console.cloud.google.com/apis/credentials?project=feisty-current-227120 for android

Once app is built for android preview, you can use eas credentials -p android and copy SHA-1 fingerprint
and update  https://console.cloud.google.com/apis/credentials?project=feisty-current-227120 for android

## Google play app signing 
https://play.google.com/console/developers/app/keymanagement

npx expo start --dev-client

## List secrets
eas secret:list

### Using ios TestFlight
eas build -p ios --profile production
eas submit -p ios --latest

### Android google play production
eas build -p android --profile production --clear-cache

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
