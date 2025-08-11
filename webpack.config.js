const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Fix for Cardano serialization lib WASM
  config.module.rules.push({
    test: /\.wasm$/,
    type: 'asset/resource',
  });

  // Fix for Buffer issues
  config.resolve.fallback = {
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
  };

  // Add Buffer polyfill
  config.plugins.push(
    new (require('webpack')).ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    })
  );

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
