iOS deployment (Expo / EAS) — quick guide

This repo uses Expo (SDK ~52) and is managed (no committed `ios/` native project).
Below are recommended paths to build and publish to TestFlight / App Store.

1) Preparations
- Join the Apple Developer Program (required).
- Set an App Store bundle identifier in `app.config.ts` (`ios.bundleIdentifier`).
- Update version/build numbers in `app.config.ts` (expo `version`) and `ios.buildNumber` before each release.
- Install EAS CLI if you plan to use EAS Build: `npm install -g eas-cli`.

2) Recommended: Use EAS Build (no mac required for building)
- Login: `eas login`
- Configure your project: `eas build:configure` (creates `eas.json` if needed)
- Start a production iOS build:

  eas build -p ios --profile production

- Submit to App Store Connect (after downloading the .ipa):

  eas submit -p ios --apple-id you@domain.com

Notes: EAS can manage credentials for you. Inspect build logs on expo.dev to see the generated iOS project's deployment target if needed.

3) Local macOS/Xcode path (if you have a Mac)
- Generate native iOS project locally (prebuild):

  npx expo prebuild --platform ios

  Note: `expo prebuild` must be run on macOS to generate iOS project files. After prebuild, inspect `ios/Podfile` (look for `platform :ios, '14.0'` or similar).

- Open the generated workspace in Xcode (`ios/*.xcworkspace`), set your signing & capabilities and bundle identifier if necessary.
- Archive (Product > Archive) and upload to App Store Connect via Xcode Organizer.

4) If you need the exact iOS deployment target
- If you run `npx expo prebuild` on macOS the generated `ios/Podfile` will contain a `platform :ios, 'XX.X'` line — that is the deployment target used for your project. Alternatively, EAS Build logs also show the Podfile/platform used.

5) Typical checklist before submission
- App icons & launch/splash screens
- Privacy permission strings (camera/photo/use of calendar) in `app.json` or `app.config.ts`
- Push notification credentials (APNs) if using `expo-notifications`
- Fill App Store Connect metadata and screenshots
- Increment `ios.buildNumber` and `expo` version

In the future can add:
- Add a real bundle identifier and update buildNumber for you if you provide it.
- Create an `eas.json` profile tuned for apple account 
- Run `npx expo prebuild` locally on macOS or help you set up an EAS build and inspect logs to report the exact iOS deployment target.
