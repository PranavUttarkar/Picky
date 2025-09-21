import { ExpoConfig } from 'expo/config';

export default (): ExpoConfig => ({
  name: 'Picky',
  slug: 'picky',
  scheme: 'picky',
  version: '0.1.0',
  orientation: 'portrait',
  assetBundlePatterns: ['**/*'],
  ios: { supportsTablet: true },
  android: {},
  web: { bundler: 'metro', output: 'static' },
  plugins: [
    ['expo-router'],
    ['expo-notifications'],
    ['expo-calendar'],
    'expo-font',
  ],
  experiments: { tsconfigPaths: true },
});
