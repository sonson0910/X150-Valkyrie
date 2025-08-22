module.exports = {
  preset: 'react-native',
  
  // =========================================================================
  // FILE EXTENSIONS AND TRANSFORMATION
  // =========================================================================
  
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  
  // Handle ES modules and CSL library properly
  transformIgnorePatterns: [
    'node_modules/(?!(' +
    '@emurgo/cardano-serialization-lib-browser|' +
    '@emurgo/cardano-serialization-lib-asmjs|' +
    'crypto-js|' +
    'bip39|' +
    'expo-.*|' +
    '@expo/.*|' +
    'react-native|' +
    'react-native-.*|' +
    '@react-native/.*|' +
    '@react-navigation/.*|' +
    '@react-native-async-storage/.*|' +
    '@react-native-community/.*' +
    ')/)',
  ],
  
  // =========================================================================
  // TEST CONFIGURATION
  // =========================================================================
  
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '<rootDir>/src/__tests__/setup.ts',
    '<rootDir>/scripts/',
    '<rootDir>/plugins/',
  ],
  
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  
  // =========================================================================
  // MODULE RESOLUTION AND ALIASES
  // =========================================================================
  
  moduleNameMapper: {
    // Path aliases matching tsconfig.json
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    
    // Asset mocks
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 
      '<rootDir>/src/__tests__/__mocks__/fileMock.js',
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    
    // Native modules that need mocking
    '^react-native-vector-icons/(.*)$': '<rootDir>/src/__tests__/__mocks__/react-native-vector-icons.js',
    '^react-native-svg$': '<rootDir>/src/__tests__/__mocks__/react-native-svg.js',
  },
  
  // =========================================================================
  // COVERAGE CONFIGURATION
  // =========================================================================
  
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/index.ts',
    '!src/polyfills/**',
    '!src/types/**',
    
    // Include new important modules
    'src/services/**/*.{ts,tsx}',
    'src/utils/**/*.{ts,tsx}',
    'src/core/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    'src/screens/**/*.{ts,tsx}',
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    // Specific thresholds for critical modules
    'src/services/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/utils/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/core/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // =========================================================================
  // TEST ENVIRONMENT CONFIGURATION
  // =========================================================================
  
  testEnvironment: 'node',
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  
  // Enhanced timeout for CSL loading tests
  testTimeout: 30000,
  
  // =========================================================================
  // GLOBALS AND MOCKING
  // =========================================================================
  
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
    },
    __DEV__: true,
  },
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // =========================================================================
  // PERFORMANCE AND PARALLELIZATION
  // =========================================================================
  
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // Optimize for large codebases
  detectOpenHandles: true,
  forceExit: true,
  
  // =========================================================================
  // REPORTER CONFIGURATION
  // =========================================================================
  
  reporters: ['default'],
  
  // =========================================================================
  // VERBOSE OUTPUT FOR DEBUGGING
  // =========================================================================
  
  verbose: true,
  errorOnDeprecated: true,
};
