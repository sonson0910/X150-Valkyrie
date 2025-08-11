import 'react-native-gesture-handler/jestSetup';

// Mock expo modules
jest.mock('expo-status-bar');
jest.mock('expo-haptics');
jest.mock('expo-linear-gradient');
jest.mock('expo-crypto');
jest.mock('expo-secure-store');
jest.mock('expo-local-authentication');
jest.mock('expo-av');

// Mock react-native modules
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
jest.mock('react-native/Libraries/Networking/Networking');

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

// Mock cardano-serialization-lib
jest.mock('cardano-serialization-lib', () => ({
    Address: {
        from_bech32: jest.fn(() => ({ to_bech32: () => 'test_address' })),
    },
    BaseAddress: {
        new: jest.fn(() => ({
            to_address: () => ({ to_bech32: () => 'test_address' }),
        })),
    },
    StakeCredential: {
        from_keyhash: jest.fn(() => 'stake_credential'),
    },
    Ed25519KeyHash: {
        from_bytes: jest.fn(() => ({ to_bech32: () => 'stake_address' })),
    },
    Bip32PrivateKey: {
        from_bip39_entropy: jest.fn(() => ({
            derive: jest.fn(() => ({
                derive: jest.fn(() => ({
                    to_public: () => ({
                        to_raw_key: () => ({
                            hash: () => ({ to_bech32: () => 'stake_address' }),
                        }),
                    }),
                })),
            })),
        })),
    },
}));

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
