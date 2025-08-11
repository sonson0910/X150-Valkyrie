import 'react-native-gesture-handler/jestSetup';

// Mock expo modules
jest.mock('expo-status-bar');
jest.mock('expo-haptics');
jest.mock('expo-linear-gradient');
jest.mock('expo-crypto');
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => { }),
    deleteItemAsync: jest.fn(async () => { }),
}));
jest.mock('expo-local-authentication');
jest.mock('expo-av');

// Mock react-native modules
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
// In RN 0.72+, internal Networking module path may change; skip explicit mock

// Mock navigation
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
        setOptions: jest.fn(),
    }),
    useRoute: () => ({
        params: {},
    }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn(() => Promise.resolve({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
    })),
    addEventListener: jest.fn(() => jest.fn()),
}));

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
    setInternetCredentials: jest.fn(),
    getInternetCredentials: jest.fn(),
    resetInternetCredentials: jest.fn(),
}));

// Mock react-native-biometrics
jest.mock('react-native-biometrics', () => ({
    isSensorAvailable: jest.fn(() => Promise.resolve({ available: true, biometryType: 'TouchID' })),
    simplePrompt: jest.fn(() => Promise.resolve({ success: true })),
    biometricKeysExist: jest.fn(() => Promise.resolve({ keysExist: true })),
    createKeys: jest.fn(() => Promise.resolve({ publicKey: 'PUBKEY' })),
    createSignature: jest.fn(() => Promise.resolve({ success: true, signature: 'SIG' })),
}));

// Mock crypto-js
jest.mock('crypto-js', () => ({
    AES: {
        encrypt: jest.fn(() => ({ toString: () => 'encrypted_data' })),
        decrypt: jest.fn(() => ({ toString: () => 'decrypted_data' })),
    },
    PBKDF2: jest.fn(() => ({ toString: () => 'derived_key' })),
    SHA256: jest.fn(() => ({ toString: () => 'hash_value' })),
    lib: {
        WordArray: {
            random: jest.fn(() => ({ toString: () => 'random_value' })),
        },
    },
    enc: {
        Hex: {
            parse: jest.fn(() => 'parsed_hex'),
        },
        Utf8: 'utf8',
    },
    mode: {
        CBC: 'cbc',
    },
    pad: {
        Pkcs7: 'pkcs7',
    },
}));

// Mock bip39
jest.mock('bip39', () => ({
    generateMnemonic: jest.fn(() => 'test mnemonic phrase'),
    validateMnemonic: jest.fn(() => true),
    mnemonicToSeedSync: jest.fn(() => Buffer.from('test_seed')),
}));

// Mock cardano-serialization-lib (virtual stub) to avoid requiring native/browser binaries in Jest
jest.mock('@emurgo/cardano-serialization-lib-browser', () => ({}), { virtual: true });

// Global test utilities
global.console = {
    ...console,
    // Uncomment to ignore a specific log level
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};

// Mock fetch globally
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        status: 200,
        statusText: 'OK',
    })
) as jest.MockedFunction<typeof fetch>;

// Setup test environment
beforeEach(() => {
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllTimers();
});
