const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");

const { resolver } = config;
resolver.assetExts = resolver.assetExts.filter((ext) => ext !== "svg");
resolver.sourceExts = [...resolver.sourceExts, "svg"];

// Suppress console warnings for leaflet CSS
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  // Suppress leaflet CSS warnings about local resources
  if (message.includes('leaflet') && message.includes('Importing local resources in CSS')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = args.join(' ');
  // Suppress leaflet CSS warnings about local resources
  if (message.includes('leaflet') && message.includes('Importing local resources in CSS')) {
    return;
  }
  originalConsoleLog.apply(console, args);
};

module.exports = withNativeWind(config, { input: "./global.css" });