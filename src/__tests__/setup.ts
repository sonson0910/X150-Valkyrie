import 'react-native-gesture-handler/jestSetup';

// Mock expo modules
jest.mock('expo-status-bar', () => ({}), { virtual: true });
jest.mock('expo-haptics', () => ({
    __esModule: true,
    default: {},
    impactAsync: jest.fn(() => Promise.resolve()),
    notificationAsync: jest.fn(() => Promise.resolve()),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
    NotificationFeedbackType: { Success: 'Success', Error: 'Error', Warning: 'Warning' },
}), { virtual: true });
jest.mock('expo-linear-gradient', () => ({
    __esModule: true,
    LinearGradient: 'LinearGradient',
}), { virtual: true });
jest.mock('expo-crypto', () => ({
    __esModule: true,
    digestStringAsync: jest.fn(() => Promise.resolve('hash')),
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}), { virtual: true });
// Mock expo-constants to avoid ESM import issues in Jest
jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        expoConfig: { extra: {} },
        manifest: { extra: {} },
    },
}));
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => { }),
    deleteItemAsync: jest.fn(async () => { }),
}));
jest.mock('expo-local-authentication');
jest.mock('expo-av');
jest.mock('expo-barcode-scanner', () => ({
    __esModule: true,
    BarCodeScanner: {
        requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    },
}), { virtual: true });

// Mock react-native internal modules (paths vary by RN version); use virtual stubs
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => jest.fn(), { virtual: true });
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

// Mock react-native-biometrics with class-based default export
jest.mock('react-native-biometrics', () => {
    class MockRNBiometrics {
        isSensorAvailable = jest.fn(() => Promise.resolve({ available: true, biometryType: 'TouchID' }));
        simplePrompt = jest.fn(() => Promise.resolve({ success: true }));
        biometricKeysExist = jest.fn(() => Promise.resolve({ keysExist: true }));
        createKeys = jest.fn(() => Promise.resolve({ publicKey: 'PUBKEY' }));
        createSignature = jest.fn(() => Promise.resolve({ success: true, signature: 'SIG' }));
    }
    return {
        __esModule: true,
        default: MockRNBiometrics,
        BiometryTypes: { TouchID: 'TouchID', FaceID: 'FaceID', Biometrics: 'Biometrics' },
    };
});

// Mock crypto-js
jest.mock('crypto-js', () => {
    // Minimal faithful mock returning correct sizes for PBKDF2 and WordArray.random
    const lib = {
        WordArray: {
            random: jest.fn((n?: number) => {
                const size = typeof n === 'number' ? n : 16;
                const words: number[] = [];
                const sigBytes = size;
                for (let i = 0; i < Math.ceil(sigBytes / 4); i++) {
                    words[i] = 0;
                }
                return { words, sigBytes };
            }),
            create: jest.fn((words: number[] = [], sigBytes: number = 0) => ({ words, sigBytes })),
        },
    } as any;

    const PBKDF2 = jest.fn((password: string, saltWA: any, opts: any) => {
        const sigBytes = (opts?.keySize || 8) * 4; // keySize in 32-bit words
        const words: number[] = [];
        for (let i = 0; i < Math.ceil(sigBytes / 4); i++) {
            words[i] = 0;
        }
        return { words, sigBytes };
    });

    const AES = {
        encrypt: jest.fn(() => ({ toString: () => 'encrypted_data' })),
        decrypt: jest.fn(() => ({ toString: () => 'decrypted_data' })),
    };

    const SHA256 = jest.fn(() => ({ toString: () => 'hash_value' }));

    const enc = { Hex: { parse: jest.fn(() => 'parsed_hex') }, Utf8: 'utf8' } as any;
    const mode = { CBC: 'cbc' } as any;
    const pad = { Pkcs7: 'pkcs7' } as any;

    return { __esModule: true, default: { AES, PBKDF2, SHA256, lib, enc, mode, pad }, AES, PBKDF2, SHA256, lib, enc, mode, pad };
});

// Mock bip39
jest.mock('bip39', () => {
    const gen = (strength?: number) => {
        const words12 = Array(11).fill('abandon').concat('about').join(' ');
        const words24 = Array(23).fill('abandon').concat('about').join(' ');
        return strength === 256 ? words24 : words12;
    };
    const validate = () => true;
    const toSeedSync = () => Buffer.from('test_seed');
    const toEntropy = (mnemonic: string) => {
        const wc = mnemonic.trim().split(/\s+/).length;
        const bytes = wc >= 24 ? 32 : 16;
        return '00'.repeat(bytes);
    };
    const entropyToMnemonic = (hex: string) => {
        const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
        const bytes = clean.length / 2;
        if (bytes >= 32) {
            // Return the same canonical 24-word phrase as generateMnemonic(256)
            return Array(23).fill('abandon').concat('about').join(' ');
        }
        return Array(11).fill('salt').concat('seed').join(' ');
    };
    return {
        __esModule: true,
        default: { generateMnemonic: gen, validateMnemonic: validate, mnemonicToSeedSync: toSeedSync, mnemonicToEntropy: toEntropy, entropyToMnemonic },
        generateMnemonic: jest.fn(gen),
        validateMnemonic: jest.fn(validate),
        mnemonicToSeedSync: jest.fn(toSeedSync),
        mnemonicToEntropy: jest.fn(toEntropy),
        entropyToMnemonic: jest.fn(entropyToMnemonic),
    };
});

// Mock cardano-serialization-lib (virtual stub) to avoid requiring native/browser binaries in Jest
jest.mock('@emurgo/cardano-serialization-lib-browser', () => {
    const Address = { from_bech32: jest.fn(() => ({})) } as any;
    const BaseAddress = { new: jest.fn((networkId: number) => ({ to_address: () => ({ to_bech32: () => 'addr1...' }) })) } as any;
    const StakeCredential = { from_keyhash: jest.fn(() => ({})) } as any;

    // Chainable mock for Bip32PrivateKey derive
    const makeKey = () => {
        const key: any = {};
        key.derive = jest.fn(() => key);
        key.to_public = jest.fn(() => ({ to_raw_key: () => ({ hash: () => ({}) }) }));
        key.to_raw_key = jest.fn(() => ({ sign: jest.fn(() => ({})) }));
        return key;
    };
    const Bip32PrivateKey = { from_bip39_entropy: jest.fn(() => makeKey()) } as any;

    const TransactionBuilder = { new: jest.fn(() => ({ add_input: jest.fn(), add_output: jest.fn(), add_change_if_needed: jest.fn(), build: jest.fn(() => ({})), min_fee: jest.fn(() => ({ to_str: () => '200000' })) })) } as any;
    const TransactionOutput = { new: jest.fn(() => ({})) } as any;
    const Value = { new: jest.fn(() => ({ set_multiasset: jest.fn() })) } as any;
    const BigNum = { from_str: jest.fn((s: string) => ({ to_str: () => String(s) })) } as any;
    const LinearFee = { new: jest.fn(() => ({})) } as any;
    const TransactionBuilderConfigBuilder = { new: jest.fn(() => ({ fee_algo: jest.fn(() => ({ pool_deposit: jest.fn(() => ({ key_deposit: jest.fn(() => ({ coins_per_utxo_byte: jest.fn(() => ({ max_value_size: jest.fn(() => ({ max_tx_size: jest.fn(() => ({ build: jest.fn(() => ({})) })) })) })) })) })) })) })) } as any;
    const TransactionInput = { new: jest.fn(() => ({})) } as any;
    const TransactionWitnessSet = { new: jest.fn(() => ({ set_vkeys: jest.fn() })) } as any;
    const TransactionHash = { from_bytes: jest.fn(() => ({ })) } as any;
    const Vkeywitness = { new: jest.fn(() => ({})) } as any;
    const Vkey = { new: jest.fn(() => ({})) } as any;
    const Vkeywitnesses = { new: jest.fn(() => ({ add: jest.fn() })) } as any;
    const Transaction = { new: jest.fn(() => ({ to_bytes: () => new Uint8Array([1,2,3]) })) } as any;
    const MultiAsset = { new: jest.fn(() => ({ insert: jest.fn() })) } as any;
    const Assets = { new: jest.fn(() => ({ insert: jest.fn() })) } as any;
    const AssetName = { new: jest.fn(() => ({})) } as any;
    const ScriptHash = { from_bytes: jest.fn(() => ({})) } as any;
    const hash_transaction = jest.fn(() => ({ to_bytes: () => new Uint8Array([1,2,3]) }));
    const min_ada_required = jest.fn(() => ({ to_str: () => '1000000' }));
    const RewardAddress = { new: jest.fn(() => ({ to_address: () => ({ to_bech32: () => 'stake1u...' }) })) } as any;

    return {
        __esModule: true,
        Address,
        BaseAddress,
        StakeCredential,
        Bip32PrivateKey,
        TransactionBuilder,
        TransactionOutput,
        Value,
        BigNum,
        LinearFee,
        TransactionBuilderConfigBuilder,
        TransactionInput,
        TransactionWitnessSet,
        TransactionHash,
        Vkeywitness,
        Vkey,
        Vkeywitnesses,
        Transaction,
        MultiAsset,
        Assets,
        AssetName,
        ScriptHash,
        hash_transaction,
        min_ada_required,
        RewardAddress,
    };
}, { virtual: true });

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
    try {
        const { eventBus } = require('../services/EventBus');
        eventBus.clearAll();
    } catch {}
});

afterEach(() => {
    jest.clearAllTimers();
    try {
        const { eventBus } = require('../services/EventBus');
        eventBus.clearAll();
    } catch {}
    try {
        const { ErrorHandler } = require('../services/ErrorHandler');
        ErrorHandler.getInstance().clearErrorLog();
    } catch {}
    try {
        const { OfflineTransactionService } = require('../services/OfflineTransactionService');
        OfflineTransactionService.getInstance().cleanup();
    } catch {}
});
