const { getDefaultConfig } = require('expo/metro-config');
const { exclusionList } = require('metro-config');

/**
 * Enhanced Metro configuration for bundle size optimization
 * - WASM asset handling for CSL library
 * - Tree shaking optimizations
 * - Bundle splitting for React Native
 * - Performance optimizations
 */
const config = getDefaultConfig(__dirname);

// Make sure wasm is resolved as an asset (not as source)
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}
// Ensure wasm is not in sourceExts
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== 'wasm');

// Allow all modules; relying on browser build. Removing blockList to avoid numeric require errors on other modules
delete config.resolver.blockList;

// Enhanced transformer with optimizations
config.transformer = {
  ...config.transformer,
  // Minify and optimize code
  minifierPath: require.resolve('metro-minify-terser'),
  minifierConfig: {
    // Enhanced minification for smaller bundles
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
    output: {
      comments: false,
    },
    compress: {
      drop_console: process.env.NODE_ENV === 'production',
      drop_debugger: true,
      reduce_vars: true,
      dead_code: true,
    },
  },
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: false,
      // Enable tree shaking for unused imports
      unstable_disableES6Transforms: false,
    },
  }),
};

// Bundle splitting configuration for better caching
config.serializer = {
  ...config.serializer,
  // Create separate bundles for better caching
  createModuleIdFactory: () => (path) => {
    // Create stable module IDs based on path
    const crypto = require('crypto');
    return crypto.createHash('md5').update(path).digest('hex').substring(0, 8);
  },
  // Optimize bundle output
  getModulesRunBeforeMainModule: () => [],
  processModuleFilter: (module) => {
    // Filter out test files and development-only modules
    if (module.path.includes('__tests__') || 
        module.path.includes('.test.') ||
        module.path.includes('.spec.')) {
      return false;
    }
    return true;
  },
};

module.exports = config;



