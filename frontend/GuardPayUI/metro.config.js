const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration for GuardPay AI
 * https://facebook.github.io/metro/docs/configuration
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
