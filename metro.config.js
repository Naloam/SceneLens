const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add tflite as an asset extension
config.resolver.assetExts.push('tflite');

module.exports = config;