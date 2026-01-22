const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add tflite as an asset extension
config.resolver.assetExts.push('tflite');

// Add yaml support for rule files (not strictly needed now that we use .js)
config.resolver.sourceExts.push('yaml');
config.resolver.sourceExts.push('yml');

module.exports = config;
