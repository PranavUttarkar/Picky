module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Removed "expo-router/babel" plugin — deprecated in SDK 50 in favor of babel-preset-expo
    plugins: [],
  };
};
