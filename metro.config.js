const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");

const { resolver } = config;
resolver.assetExts = resolver.assetExts.filter((ext) => ext !== "svg");
resolver.sourceExts = [...resolver.sourceExts, "svg"];

module.exports = withNativeWind(config, { input: "./global.css" });