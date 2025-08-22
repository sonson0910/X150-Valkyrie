module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // remove prop-types and dead code in prod
      ...(process.env.NODE_ENV === 'production' ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
      // Avoid transforming modules in asm.js/browser CSL files to keep size lower
      [
        '@babel/plugin-transform-runtime',
        { helpers: true, regenerator: true }
      ],
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@utils': './src/utils',
            '@types': './src/types',
            '@constants': './src/constants',
            '@contexts': './src/contexts',
            '@assets': './assets'
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
