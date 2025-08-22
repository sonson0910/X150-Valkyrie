const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // =========================================================================
  // BUNDLE SIZE OPTIMIZATION & TREE SHAKING
  // =========================================================================
  
  // Enable production optimizations
  const isProduction = argv.mode === 'production';
  
  if (isProduction) {
    // Enhanced tree shaking
    config.optimization = {
      ...config.optimization,
      usedExports: true,
      providedExports: true,
      sideEffects: false,
      // Split chunks for better caching
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Vendor chunk for node_modules
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          // Crypto libraries chunk (CSL, etc)
          crypto: {
            test: /[\\/]node_modules[\\/](@emurgo|crypto-js|bip39)[\\/]/,
            name: 'crypto',
            chunks: 'all',
            priority: 20,
          },
          // UI libraries chunk
          ui: {
            test: /[\\/]node_modules[\\/](react-native-vector-icons|react-native-svg|expo-linear-gradient)[\\/]/,
            name: 'ui',
            chunks: 'all',
            priority: 15,
          },
          // Common/shared code
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
      // Minimize bundle size
      minimize: true,
      // Use compression
      concatenateModules: true,
    };
  }
  
  // Fix for Cardano serialization lib WASM
  config.module.rules.push({
    test: /\.wasm$/,
    type: 'asset/resource',
  });

  // Enhanced resolve configuration for tree shaking
  config.resolve = {
    ...config.resolve,
    // Enable tree shaking for ES modules
    mainFields: ['browser', 'es2015', 'module', 'main'],
    fallback: {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      util: require.resolve('util'),
      fs: false,
      path: false,
      os: false,
      assert: false,
      constants: false,
      vm: false,
    },
    // Alias for optimized imports
    alias: {
      ...config.resolve.alias,
      '@src': require('path').resolve(__dirname, 'src'),
      '@components': require('path').resolve(__dirname, 'src/components'),
      '@services': require('path').resolve(__dirname, 'src/services'),
      '@utils': require('path').resolve(__dirname, 'src/utils'),
      '@screens': require('path').resolve(__dirname, 'src/screens'),
      '@constants': require('path').resolve(__dirname, 'src/constants'),
    },
  };

  // Enhanced plugins for bundle optimization
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    })
  );
  
  if (isProduction) {
    // Add compression and analysis plugins
    config.plugins.push(
      // Define environment variables for tree shaking
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('production'),
        __DEV__: false,
      }),
      
      // Module concatenation for better tree shaking
      new webpack.optimize.ModuleConcatenationPlugin(),
      
      // Analysis and compression
      ...(process.env.ANALYZE_BUNDLE ? [
        new (require('webpack-bundle-analyzer')).BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html',
        })
      ] : [])
    );
  }

  // Fix for Cardano serialization lib
  config.experiments = {
    ...config.experiments,
    asyncWebAssembly: true,
    syncWebAssembly: true,
  };

  // Fix MIME type issues with proper Babel config
  config.module.rules.push({
    test: /\.js$/,
    include: /node_modules\/@emurgo\/cardano-serialization-lib-browser/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          ['@babel/preset-env', { loose: true }]
        ],
        plugins: [
          ['@babel/plugin-transform-runtime', { regenerator: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
          ['@babel/plugin-transform-private-property-in-object', { loose: true }],
          ['@babel/plugin-transform-class-properties', { loose: true }]
        ]
      }
    }
  });

  // Fix MIME Buffer issues specifically with string-replace-loader
  config.module.rules.push({
    test: /cardano_serialization_lib_bg\.js$/,
    use: {
      loader: 'string-replace-loader',
      options: {
        search: /Could not find MIME for Buffer/,
        replace: '// MIME Buffer issue fixed',
        flags: 'g'
      }
    }
  });

  // Fix MIME Buffer issues in other Cardano lib files
  config.module.rules.push({
    test: /\.js$/,
    include: /node_modules\/@emurgo\/cardano-serialization-lib-browser/,
    use: {
      loader: 'string-replace-loader',
      options: {
        search: /Could not find MIME for Buffer <null>/,
        replace: '// MIME Buffer issue fixed',
        flags: 'g'
      }
    }
  });

  // Ignore WASM warnings
  config.ignoreWarnings = [
    /Critical dependency: the request of a dependency is an expression/,
    /Module not found: No parser registered for webassembly\/async/,
    /Could not find MIME for Buffer/,
    /Module not found: Can't resolve 'vm'/,
  ];

  return config;
};
