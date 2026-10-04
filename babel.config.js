module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last in the plugins list per react-native-reanimated's setup docs.
    plugins: ['react-native-reanimated/plugin'],
  };
};
