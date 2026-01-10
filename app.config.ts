import { ExpoConfig } from 'expo/config';

export default (): ExpoConfig => ({
  name: 'Picky',
  slug: 'picky',
  scheme: 'picky',
  version: '0.1.0',
  orientation: 'portrait',
  assetBundlePatterns: ['**/*'],
  // iOS / Android specific config. Update bundleIdentifier before publishing to App Store.
  ios: {
    supportsTablet: true,
    // Replace with your App Store bundle identifier (reverse DNS), e.g. 'com.yourcompany.picky'
    bundleIdentifier: 'com.yourcompany.picky',
    // iOS buildNumber (string). Increment for each App Store build.
    buildNumber: '1',
    // Required for Apple Sign In
    usesAppleSignIn: true,
  },
  android: {
    // Required for Google Sign In on Android - replace with your actual package name
    package: 'com.yourcompany.picky',
  },
  web: { bundler: 'metro', output: 'static', favicon: './assets/branding/P.png' },
  plugins: [
    ['expo-router'],
    ['expo-notifications'],
    ['expo-calendar'],
    'expo-font',
    // Apple Sign In plugin
    'expo-apple-authentication',
  ],
  experiments: { tsconfigPaths: true },
});
