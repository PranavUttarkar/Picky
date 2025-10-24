// Metro configuration for Expo apps.
// Use Expo's default config to ensure the correct asset transformers and web settings are applied.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('metro-config').ConfigT} */
const config = getDefaultConfig(__dirname);

module.exports = config;
