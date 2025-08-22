import 'react-native-gesture-handler/jestSetup';
import React from 'react';

// Mock react-native core modules
jest.mock('react-native', () => ({
    Alert: {
        alert: jest.fn(),
    },
    Platform: {
        OS: 'ios',
        select: jest.fn((obj) => obj.ios || obj.default),
    },
    Dimensions: {
        get: jest.fn(() => ({ width: 375, height: 812 })),
    },
    StyleSheet: {
        create: jest.fn((styles) => styles),
    },
    NativeModules: {},
    NativeEventEmitter: jest.fn(),
}));

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
// Enhanced Mock for expo-modules-core to handle native module issues
jest.mock('expo-modules-core', () => ({
    NativeModulesProxy: {
        ExpoLocalAuthentication: {},
        ExpoSecureStore: {},
        ExpoHaptics: {},
        ExpoClipboard: {},
    },
    Platform: {
        OS: 'ios',
    },
    NativeModule: jest.fn(() => ({})),
    requireNativeModule: jest.fn(() => ({})),
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

// Export biometric mock functions for test access
export const mockBiometricFunctions = {
    isSensorAvailable: jest.fn(() => Promise.resolve({ available: true, biometryType: 'TouchID' })),
    simplePrompt: jest.fn(() => Promise.resolve({ success: true })),
    biometricKeysExist: jest.fn(() => Promise.resolve({ keysExist: true })),
    createKeys: jest.fn(() => Promise.resolve({ publicKey: 'PUBKEY' })),
    createSignature: jest.fn(() => Promise.resolve({ success: true, signature: 'SIG' })),
};

// Mock react-native-biometrics with both class and direct exports
jest.mock('react-native-biometrics', () => {
    class MockRNBiometrics {
        isSensorAvailable = mockBiometricFunctions.isSensorAvailable;
        simplePrompt = mockBiometricFunctions.simplePrompt;
        biometricKeysExist = mockBiometricFunctions.biometricKeysExist;
        createKeys = mockBiometricFunctions.createKeys;
        createSignature = mockBiometricFunctions.createSignature;
    }
    return {
        __esModule: true,
        default: MockRNBiometrics,
        // Export functions directly for destructuring
        isSensorAvailable: mockBiometricFunctions.isSensorAvailable,
        simplePrompt: mockBiometricFunctions.simplePrompt,
        biometricKeysExist: mockBiometricFunctions.biometricKeysExist,
        createKeys: mockBiometricFunctions.createKeys,
        createSignature: mockBiometricFunctions.createSignature,
        BiometryTypes: { TouchID: 'TouchID', FaceID: 'FaceID', Biometrics: 'Biometrics' },
    };
});

// Mock crypto-js with proper random generation
jest.mock('crypto-js', () => {
    // Create a functional mock that generates actual random-looking data
    const lib = {
        WordArray: {
            random: jest.fn((n?: number) => {
                const size = typeof n === 'number' ? n : 16;
                const words: number[] = [];
                const sigBytes = size;
                // Generate pseudo-random words
                for (let i = 0; i < Math.ceil(sigBytes / 4); i++) {
                    words[i] = Math.floor(Math.random() * 0xFFFFFFFF);
                }
                return { words, sigBytes };
            }),
            create: jest.fn((words: number[] = [], sigBytes: number = 0) => ({ words, sigBytes })),
        },
    } as any;

    const PBKDF2 = jest.fn((password: string, saltWA: any, opts: any) => {
        const sigBytes = (opts?.keySize || 8) * 4; // keySize in 32-bit words
        const words: number[] = [];
        // Generate deterministic but different keys based on password
        const seed = password.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        for (let i = 0; i < Math.ceil(sigBytes / 4); i++) {
            words[i] = seed + i;
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

// Enhanced Mock for cardano-serialization-lib with lazy loading support
jest.mock('@emurgo/cardano-serialization-lib-browser', () => {
    // Enhanced CSL mock with more complete API surface
    const Address = { 
        from_bech32: jest.fn(() => ({})),
        to_bech32: jest.fn(() => 'addr1qtest...'),
    } as any;
    
    const BaseAddress = { 
        new: jest.fn((networkId: number, paymentCred: any, stakeCred: any) => ({
            to_address: () => ({ to_bech32: () => 'addr1qtest...' }),
            payment_cred: () => paymentCred,
            stake_cred: () => stakeCred,
        }))
    } as any;
    
    const StakeCredential = { 
        from_keyhash: jest.fn(() => ({})),
        to_keyhash: jest.fn(() => ({})),
    } as any;

    // Enhanced chainable mock for Bip32PrivateKey derive with async support
    const makeKey = () => {
        const key: any = {
            derive: jest.fn(function(this: any) { return this; }),
            to_public: jest.fn(() => ({ 
                to_public: jest.fn(() => ({ 
                    hash: () => ({}),
                    to_bytes: () => new Uint8Array([1,2,3]),
                })),
                to_raw_key: () => ({ 
                    hash: () => ({}),
                    to_bytes: () => new Uint8Array([1,2,3]),
                }),
                derive: jest.fn(function(this: any) { return this; }),
                to_bytes: () => new Uint8Array([1,2,3]),
            })),
            to_raw_key: jest.fn(() => ({ 
                sign: jest.fn(() => ({})),
                to_bytes: () => new Uint8Array([1,2,3]),
                to_public: jest.fn(() => ({ 
                    hash: () => ({}),
                    to_bytes: () => new Uint8Array([1,2,3]),
                })),
            })),
            to_bytes: jest.fn(() => new Uint8Array([1,2,3])),
        };
        return key;
    };
    
    const Bip32PrivateKey = { 
        from_bip39_entropy: jest.fn(() => makeKey()),
        from_bytes: jest.fn(() => makeKey()),
        generate_ed25519_bip32: jest.fn(() => makeKey()),
    } as any;

    const TransactionBuilder = { 
        new: jest.fn(() => ({ 
            add_input: jest.fn(),
            add_output: jest.fn(),
            add_change_if_needed: jest.fn(),
            build: jest.fn(() => ({
                to_bytes: jest.fn(() => new Uint8Array([1, 2, 3])),
                body: jest.fn(() => ({
                    to_bytes: jest.fn(() => new Uint8Array([1, 2, 3])),
                    inputs: jest.fn(() => ({ len: () => 1 })),
                    outputs: jest.fn(() => ({ len: () => 1 })),
                    fee: jest.fn(() => ({ to_str: () => '200000' })),
                    ttl: jest.fn(() => null),
                })),
                witness_set: jest.fn(() => ({})),
                auxiliary_data: jest.fn(() => null),
            })),
            min_fee: jest.fn(() => ({ to_str: () => '200000' })),
            set_ttl: jest.fn(),
            set_fee: jest.fn(),
            balance: jest.fn(() => ({ coin: () => ({ to_str: () => '0' }) })),
        }))
    } as any;
    
    const TransactionOutput = { 
        new: jest.fn(() => ({
            address: () => ({}),
            amount: () => ({ coin: () => ({ to_str: () => '1000000' }) }),
        }))
    } as any;
    
    const Value = { 
        new: jest.fn(() => ({ 
            set_multiasset: jest.fn(),
            coin: () => ({ to_str: () => '1000000' }),
            multiasset: () => null,
        }))
    } as any;
    
    const BigNum = { 
        from_str: jest.fn((s: string) => ({ 
            to_str: () => String(s),
            checked_add: jest.fn((other: any) => ({ to_str: () => String(Number(s) + 1000) })),
            checked_sub: jest.fn((other: any) => ({ to_str: () => String(Math.max(0, Number(s) - 1000)) })),
        }))
    } as any;
    
    const LinearFee = { 
        new: jest.fn(() => ({
            calculate: jest.fn(() => ({ to_str: () => '200000' })),
        }))
    } as any;
    
    const TransactionBuilderConfigBuilder = { 
        new: jest.fn(() => ({
            fee_algo: jest.fn(function(this: any) { return this; }),
            pool_deposit: jest.fn(function(this: any) { return this; }),
            key_deposit: jest.fn(function(this: any) { return this; }),
            coins_per_utxo_byte: jest.fn(function(this: any) { return this; }),
            coins_per_utxo_word: jest.fn(function(this: any) { return this; }),
            max_value_size: jest.fn(function(this: any) { return this; }),
            max_tx_size: jest.fn(function(this: any) { return this; }),
            utxo_cost_per_word: jest.fn(function(this: any) { return this; }),
            build: jest.fn(() => ({})),
        }))
    } as any;
    
    const TransactionHash = {
        from_hex: jest.fn(() => ({})),
        from_bytes: jest.fn(() => ({
            to_bytes: () => new Uint8Array([1,2,3]),
            to_hex: () => 'abcd1234...',
        })),
        to_hex: jest.fn(() => 'mock_tx_hash_hex'),
    } as any;

    const TransactionInput = { 
        new: jest.fn(() => ({
            transaction_id: () => ({}),
            index: () => 0,
        }))
    } as any;
    
    const TransactionWitnessSet = { 
        new: jest.fn(() => ({ 
            set_vkeys: jest.fn(),
            vkeys: () => null,
        }))
    } as any;
    
    const Vkeywitness = { new: jest.fn(() => ({})) } as any;
    const Vkey = { new: jest.fn(() => ({})) } as any;
    const Vkeywitnesses = { 
        new: jest.fn(() => ({ 
            add: jest.fn(),
            len: () => 1,
        }))
    } as any;
    
    const Transaction = { 
        new: jest.fn((body, witnesses, auxiliaryData) => ({ 
            to_bytes: jest.fn(() => new Uint8Array([1,2,3])),
            body: jest.fn(() => body || {}),
            witness_set: jest.fn(() => witnesses || {}),
            auxiliary_data: jest.fn(() => auxiliaryData || null),
        })),
        from_bytes: jest.fn(() => ({
            body: jest.fn(() => ({
                fee: jest.fn(() => ({ to_str: () => '200000' })),
                outputs: jest.fn(() => ({
                    len: jest.fn(() => 1),
                    get: jest.fn(() => ({
                        amount: jest.fn(() => ({
                            coin: jest.fn(() => ({ to_str: () => '2000000' }))
                        }))
                    }))
                }))
            })),
            witness_set: jest.fn(() => ({})),
            auxiliary_data: jest.fn(() => null),
        }))
    } as any;
    
    const MultiAsset = { 
        new: jest.fn(() => ({ 
            insert: jest.fn(),
            keys: () => ({ len: () => 0 }),
            get: jest.fn(() => null),
            len: jest.fn(() => 0),
        }))
    } as any;
    
    const Assets = { 
        new: jest.fn(() => ({ 
            insert: jest.fn(),
            keys: () => ({ len: () => 0 }),
            get: jest.fn(() => null),
            len: jest.fn(() => 0),
        }))
    } as any;
    
    const AssetName = { 
        new: jest.fn(() => ({
            name: () => new Uint8Array([1,2,3]),
            to_bytes: () => new Uint8Array([1,2,3]),
        })),
        from_bytes: jest.fn(() => ({
            name: () => new Uint8Array([1,2,3]),
            to_bytes: () => new Uint8Array([1,2,3]),
        }))
    } as any;
    
    const ScriptHash = { 
        from_bytes: jest.fn(() => ({
            to_bytes: () => new Uint8Array([1,2,3]),
        })),
        from_hex: jest.fn((hex) => ({
            to_bytes: () => new Uint8Array([1,2,3]),
            to_hex: () => hex,
        }))
    } as any;
    
    const hash_transaction = jest.fn(() => ({ 
        to_bytes: () => new Uint8Array([1,2,3]),
        to_hex: () => 'abcd1234...',
    }));
    
    const min_ada_required = jest.fn(() => ({ to_str: () => '1000000' }));
    
    const RewardAddress = { 
        new: jest.fn(() => ({ 
            to_address: () => ({ to_bech32: () => 'stake1utest...' }),
            payment_cred: () => ({}),
        }))
    } as any;

    // Additional CSL components for comprehensive mocking
    const AuxiliaryData = {
        new: jest.fn(() => ({
            metadata: () => null,
            set_metadata: jest.fn(),
        }))
    } as any;

    const GeneralTransactionMetadata = {
        new: jest.fn(() => ({
            insert: jest.fn(),
            get: jest.fn(() => null),
        }))
    } as any;

    const TransactionMetadatum = {
        new_text: jest.fn((text: string) => ({ as_text: () => text })),
        new_int: jest.fn((num: any) => ({ as_int: () => num })),
        new_map: jest.fn(() => ({ insert: jest.fn() })),
        new_list: jest.fn(() => ({ add: jest.fn() })),
    } as any;

    const TransactionBody = {
        from_bytes: jest.fn(() => ({
            inputs: jest.fn(() => ({ len: () => 1 })),
            outputs: jest.fn(() => ({ len: () => 1 })),
            fee: jest.fn(() => ({ to_str: () => '200000' })),
            ttl: jest.fn(() => null),
            to_bytes: jest.fn(() => new Uint8Array([1, 2, 3])),
        })),
    } as any;

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
        TransactionBody,
        MultiAsset,
        Assets,
        AssetName,
        ScriptHash,
        hash_transaction,
        min_ada_required,
        RewardAddress,
        AuxiliaryData,
        GeneralTransactionMetadata,
        TransactionMetadatum,
    };
}, { virtual: true });

// =========================================================================
// MOCK NEW SERVICES AND UTILITIES
// =========================================================================

// Mock CSL Provider for lazy loading
jest.mock('../utils/CSLProvider', () => ({
    getCSL: jest.fn(async () => {
        const CSL = require('@emurgo/cardano-serialization-lib-browser');
        return CSL;
    }),
}));

// Mock Intelligent Cache Manager with actual caching behavior for tests
jest.mock('../utils/IntelligentCache', () => {
    // Create a functional mock cache that actually stores data for tests
    class MockIntelligentCacheManager {
        private cache = new Map();
        private stats = {
            memoryCache: { size: 0, count: 0, hitRate: 0, missRate: 0 },
            storageCache: { size: 0, count: 0, hitRate: 0, missRate: 0 },
            network: { requests: 0, successRate: 0, avgResponseTime: 0 },
            evictions: { memory: 0, storage: 0, reasons: {} }
        };
        
        async get(key, fetchFn, options = {}) {
            const { strategy = 'cache_first', ttl = 60000 } = options;
            const now = Date.now();
            const cached = this.cache.get(key);
            
            // Check if cached data is valid
            if (cached && (now - cached.timestamp) < cached.ttl) {
                this.stats.memoryCache.hitRate++;
                this.stats.memoryCache.count = this.cache.size;
                return cached.data;
            }
            
            // Cache miss
            this.stats.memoryCache.missRate++;
            
            if (strategy === 'cache_only') {
                return null;
            }
            
            if (fetchFn) {
                try {
                    const data = await fetchFn();
                    // Store in cache
                    this.cache.set(key, {
                        data,
                        timestamp: now,
                        ttl,
                        priority: options.priority || 'medium',
                        tags: options.tags || []
                    });
                    this.stats.memoryCache.count = this.cache.size;
                    return data;
                } catch (error) {
                    // Return stale cache if available
                    if (cached) {
                        return cached.data;
                    }
                    // For tests that expect null on error, return null instead of throwing
                    return null;
                }
            }
            
            return null;
        }
        
        async set(key, data, options = {}) {
            const { ttl = 60000, priority = 'medium', tags = [] } = options;
            this.cache.set(key, {
                data,
                timestamp: Date.now(),
                ttl,
                priority,
                tags
            });
            this.stats.memoryCache.count = this.cache.size;
        }
        
        async invalidate(keyOrPattern, tags) {
            if (typeof keyOrPattern === 'string') {
                this.cache.delete(keyOrPattern);
            } else if (keyOrPattern instanceof RegExp) {
                for (const [key] of this.cache.entries()) {
                    if (keyOrPattern.test(key)) {
                        this.cache.delete(key);
                    }
                }
            }
            
            if (tags && Array.isArray(tags)) {
                for (const [key, entry] of this.cache.entries()) {
                    if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
                        this.cache.delete(key);
                    }
                }
            }
            
            this.stats.memoryCache.count = this.cache.size;
        }
        
        async clearAll() {
            this.cache.clear();
            this.stats.memoryCache.count = 0;
        }
        
        getStats() {
            return { ...this.stats };
        }
        
        async shutdown() {
            this.cache.clear();
        }
        
        async warmup(entries) {
            for (const entry of entries) {
                try {
                    await this.get(entry.key, entry.fetchFunction, entry.options);
                } catch (error) {
                    // Ignore warmup errors
                }
            }
        }
    }
    
    const mockCacheInstance = new MockIntelligentCacheManager();

    return {
        __esModule: true,
        IntelligentCacheManager: {
            getInstance: jest.fn(() => mockCacheInstance),
        },
        intelligentCache: mockCacheInstance,
        CacheStrategy: {
            CACHE_FIRST: 'cache_first',
            CACHE_THEN_NETWORK: 'cache_then_network',
            NETWORK_FIRST: 'network_first',
            NETWORK_ONLY: 'network_only',
            CACHE_ONLY: 'cache_only',
        },
        CachePriority: {
            CRITICAL: 'critical',
            HIGH: 'high',
            MEDIUM: 'medium',
            LOW: 'low',
        },
    };
});

// Export mock API cache instance for test access
export const mockApiCacheInstance = {
    request: jest.fn(async () => ({ data: {}, status: 200, headers: {}, timestamp: Date.now(), fromCache: false })),
    getAccountInfo: jest.fn(async () => ({ data: {}, fromCache: false })),
    getAccountUtxos: jest.fn(async () => ({ data: [], fromCache: false })),
    getTransactionInfo: jest.fn(async () => ({ data: {}, fromCache: false })),
    invalidate: jest.fn(async () => {}),
    clearCache: jest.fn(async () => {}),
    getStats: jest.fn(() => ({ pendingRequests: 0 })),
    preload: jest.fn(async () => {}),
};

// Mock Cache Services 
jest.mock('../services/cache/ApiResponseCache', () => ({
    ApiResponseCacheService: {
        getInstance: jest.fn(() => mockApiCacheInstance),
    },
}));

jest.mock('../services/cache/WalletDataCache', () => ({
    WalletDataCacheService: {
        getInstance: jest.fn(() => ({
            getTransactionHistory: jest.fn(async () => ({ address: 'test', data: { transactions: [], totalCount: 0 }, lastUpdated: Date.now(), syncStatus: 'synced' })),
            getAccountBalance: jest.fn(async () => ({ address: 'test', data: { confirmed: '0', unconfirmed: '0' }, lastUpdated: Date.now(), syncStatus: 'synced' })),
            getAccountUtxos: jest.fn(async () => ({ address: 'test', data: { utxos: [], totalCount: 0 }, lastUpdated: Date.now(), syncStatus: 'synced' })),
            addTransaction: jest.fn(async () => {}),
            invalidateAccountData: jest.fn(async () => {}),
            clearCache: jest.fn(async () => {}),
            getStats: jest.fn(() => ({ activeSyncs: 0, syncQueueSize: 0 })),
            shutdown: jest.fn(async () => {}),
        })),
    },
    walletDataCache: {
        getTransactionHistory: jest.fn(async () => ({ address: 'test', data: { transactions: [] }, lastUpdated: Date.now(), syncStatus: 'synced' })),
        getAccountBalance: jest.fn(async () => ({ address: 'test', data: { confirmed: '0' }, lastUpdated: Date.now(), syncStatus: 'synced' })),
    },
}));

jest.mock('../services/cache/PortfolioDataCache', () => ({
    PortfolioDataCacheService: {
        getInstance: jest.fn(() => ({
            getAssetPrice: jest.fn(async () => ({ symbol: 'ADA', price: 1.0, lastUpdated: Date.now() })),
            getPortfolioAnalytics: jest.fn(async () => ({ totalValue: 1000, allocation: {} })),
            getMarketData: jest.fn(async () => ({ topAssets: [], marketSummary: {}, lastUpdated: Date.now() })),
            clearCache: jest.fn(async () => {}),
            shutdown: jest.fn(async () => {}),
        })),
    },
    portfolioDataCache: {
        getAssetPrice: jest.fn(async () => ({ symbol: 'ADA', price: 1.0, lastUpdated: Date.now() })),
    },
}));

// Mock Dependency Injection System
jest.mock('../core/di/ServiceContainer', () => ({
    ServiceContainer: jest.fn().mockImplementation(() => ({
        register: jest.fn(),
        resolve: jest.fn(),
        createScope: jest.fn(() => ({})),
        dispose: jest.fn(async () => {}),
        isRegistered: jest.fn(() => true),
        getStats: jest.fn(() => ({ registrations: 0, resolutions: 0 })),
    })),
}));

jest.mock('../core/di', () => ({
    DI: {
        container: {
            resolve: jest.fn(),
            register: jest.fn(),
            isRegistered: jest.fn(() => true),
        },
        isInitialized: jest.fn(() => true),
        initialize: jest.fn(async () => {}),
        shutdown: jest.fn(async () => {}),
    },
    Services: {
        errorHandler: { handleError: jest.fn() },
        configurationService: { getApiKey: jest.fn(() => 'test-key') },
        networkService: { makeRequest: jest.fn(async () => ({ data: {}, status: 200 })) },
    },
    DevTools: {
        inspectContainer: jest.fn(() => ({ services: [], dependencies: [] })),
        validateDependencies: jest.fn(() => ({ valid: true, issues: [] })),
    },
}));

// Mock Enhanced Error Handling
jest.mock('../core/errors/EnhancedErrorHandler', () => ({
    EnhancedErrorHandler: {
        getInstance: jest.fn(() => ({
            handle: jest.fn(async () => {}),
            report: jest.fn(async () => {}),
            getStats: jest.fn(() => ({ totalErrors: 0, errorsByCategory: {} })),
            clearStats: jest.fn(),
        })),
    },
}));

jest.mock('../core/errors/AppError', () => ({
    AppError: jest.fn().mockImplementation((message, code, category) => ({
        name: 'AppError',
        message,
        code,
        category,
        timestamp: Date.now(),
        toJSON: jest.fn(() => ({ message, code, category })),
    })),
}));

// Mock Memory Utilities
jest.mock('../utils/MemoryUtils', () => ({
    MemoryUtils: {
        zeroMemory: jest.fn((buffer) => {
            // Actually zero the buffer for tests
            if (buffer && buffer.fill) {
                buffer.fill(0);
            }
        }),
        zeroString: jest.fn(),
        secureRandom: jest.fn((length = 32) => {
            const buffer = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                buffer[i] = Math.floor(Math.random() * 256);
            }
            return buffer;
        }),
        secureCleanup: jest.fn(),
        createSecureBuffer: jest.fn((length = 32) => new Uint8Array(length)),
    },
}));

// Mock CryptoUtils with proper Web Crypto API simulation
jest.mock('../utils/CryptoUtils', () => ({
    CryptoUtils: {
        generateSecureRandom: jest.fn((length) => {
            if (length <= 0) {
                throw new Error('Invalid length');
            }
            const buffer = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                buffer[i] = Math.floor(Math.random() * 256);
            }
            return buffer;
        }),
        
        generateSalt: jest.fn((length = 32) => {
            const buffer = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                buffer[i] = Math.floor(Math.random() * 256);
            }
            return buffer;
        }),
        
        deriveKey: jest.fn(async (password, salt, keyLengthOrIterations = 32, iterationsOrKeyLength = 100000) => {
            if (!password || password === '') {
                throw new Error('Password cannot be empty');
            }
            if (!salt || salt.length === 0) {
                // Generate default salt if empty (for testing)
                salt = new Uint8Array(32);
                for (let i = 0; i < 32; i++) {
                    salt[i] = i + 1; // Deterministic salt for testing
                }
            }
            
            // Handle parameter order flexibility for testing compatibility
            let keyLength = 32;
            let iterations = 100000;
            
            // If first parameter looks like iterations (large number), swap the order
            if (keyLengthOrIterations > 1000) {
                iterations = keyLengthOrIterations;
                keyLength = iterationsOrKeyLength || 32;
            } else {
                keyLength = keyLengthOrIterations || 32;
                iterations = iterationsOrKeyLength || 100000;
            }
            
            // Ensure reasonable defaults
            if (iterations === 0 || iterations < 1000) {
                iterations = 100000;
            }
            if (keyLength === 0 || keyLength < 16) {
                keyLength = 32;
            }
            
            // Generate deterministic but different keys based on password and salt
            const seed = password.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) +
                        salt.reduce((sum, byte) => sum + byte, 0);
            
            const key = new Uint8Array(keyLength);
            for (let i = 0; i < keyLength; i++) {
                key[i] = (seed + i + iterations) % 256;
            }
            return key;
        }),
        
        encryptAES: jest.fn(async (plaintext, key) => {
            if (!plaintext && plaintext !== '') {
                throw new Error('Plaintext cannot be null');
            }
            if (!key) {
                throw new Error('Key cannot be null');
            }
            
            // Generate random IV and tag
            const iv = new Uint8Array(16);
            const tag = new Uint8Array(16);
            for (let i = 0; i < 16; i++) {
                iv[i] = Math.floor(Math.random() * 256);
                tag[i] = Math.floor(Math.random() * 256);
            }
            
            // Simple "encryption" for testing - just XOR with key
            const encoder = new TextEncoder();
            const plaintextBytes = encoder.encode(plaintext);
            const ciphertext = new Uint8Array(plaintextBytes.length);
            
            for (let i = 0; i < plaintextBytes.length; i++) {
                ciphertext[i] = plaintextBytes[i] ^ key[i % key.length] ^ iv[i % iv.length];
            }
            
            return {
                ciphertext: Array.from(ciphertext).map(b => b.toString(16).padStart(2, '0')).join(''),
                iv,
                tag
            };
        }),
        
        decryptAES: jest.fn(async (encrypted, key) => {
            if (!encrypted) {
                throw new Error('Encrypted data cannot be null');
            }
            if (!key) {
                throw new Error('Key cannot be null');
            }
            
            // Simple "decryption" for testing - reverse the XOR
            const ciphertextBytes = encrypted.ciphertext.match(/.{2}/g)?.map(hex => parseInt(hex, 16)) || [];
            const plaintext = new Uint8Array(ciphertextBytes.length);
            
            for (let i = 0; i < ciphertextBytes.length; i++) {
                plaintext[i] = ciphertextBytes[i] ^ key[i % key.length] ^ encrypted.iv[i % encrypted.iv.length];
            }
            
            const decoder = new TextDecoder();
            return decoder.decode(plaintext);
        })
    },
}));

// Mock Logger
jest.mock('../utils/Logger', () => ({
    __esModule: true,
    default: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
    },
}));

// Mock Environment Configuration
jest.mock('../config/Environment', () => ({
    environment: {
        get: jest.fn((key) => {
            const config = {
                'ENVIRONMENT': 'test',
                'APP_NAME': 'Valkyrie Test',
                'APP_VERSION': '1.0.0',
                'ENABLE_SENTRY': false,
                'ENABLE_ERROR_REPORTING': false,
                'BLOCKFROST_API_KEY_TESTNET': 'test-key',
                'BLOCKFROST_API_KEY_MAINNET': 'test-key',
            };
            return config[key] || null;
        }),
        isDevelopment: jest.fn(() => true),
        isProduction: jest.fn(() => false),
        isTest: jest.fn(() => true),
        validate: jest.fn(() => ({ valid: true, missing: [] })),
    },
}));

// Mock Dynamic Imports
jest.mock('../utils/DynamicImports', () => {
    const mockReact = require('react');
    
    return {
        DynamicImportManager: {
            createLazyComponent: jest.fn((importFn, options) => {
                // Return a simple component wrapper
                return mockReact.forwardRef((props, ref) => {
                    const [Component, setComponent] = mockReact.useState(null);
                    
                    mockReact.useEffect(() => {
                        importFn().then(module => {
                            setComponent(() => module.default || module);
                        });
                    }, []);
                    
                    if (!Component) {
                        return mockReact.createElement('div', { ref }, 'Loading...');
                    }
                    
                    return mockReact.createElement(Component, { ...props, ref });
                });
            }),
            preloadComponent: jest.fn(),
            clearCache: jest.fn(),
        },
        createLazyScreen: jest.fn((importFn, screenName, options) => {
            return mockReact.forwardRef((props, ref) => {
                return mockReact.createElement('div', { ...props, ref }, `Mock ${screenName}`);
            });
        }),
        preloadCriticalComponents: jest.fn(),
    };
});

// Mock Memory Optimizer
jest.mock('../utils/MemoryOptimizer', () => {
    const mockReact = require('react');
    
    return {
        useAsyncEffect: jest.fn((effect, deps) => {
            mockReact.useEffect(() => {
                effect();
            }, deps);
        }),
        useMemoryCleanup: jest.fn(() => {}),
        useSafeState: jest.fn((initialState) => mockReact.useState(initialState)),
        setMemoryTracking: jest.fn(),
        getMemoryStats: jest.fn(() => ({ allocatedMemory: 0, peakMemory: 0 })),
    };
});

jest.mock('../utils/withMemoryOptimization', () => ({
    withScreenMemoryOptimization: jest.fn((Component) => Component),
    startGlobalMemoryMonitoring: jest.fn(() => () => {}),
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

// Export mock network instance for test access
export const mockNetworkInstance = {
    makeRequest: jest.fn(async (url, options = {}) => {
        return {
            status: 200,
            data: { mock: 'data' },
            headers: {
                get: jest.fn((name) => {
                    if (name === 'content-type') return 'application/json';
                    return '';
                })
            }
        };
    }),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
};

// Mock NetworkService
jest.mock('../services/NetworkService', () => ({
    NetworkService: {
        getInstance: jest.fn(() => mockNetworkInstance)
    }
}));

// Mock WalletService methods
jest.mock('../services/wallet/WalletService', () => ({
    WalletService: {
        getInstance: jest.fn(() => ({
            createWallet: jest.fn(async (options) => ({
                success: true,
                wallet: {
                    id: 'test-wallet-id',
                    name: options.name,
                    mnemonic: options.mnemonic,
                    accounts: [{
                        id: 'account-0',
                        name: 'Primary Account',
                        address: 'addr1test_primary',
                        stakeAddress: 'stake1u_test',
                        balance: '0',
                        publicKey: 'test-public-key'
                    }]
                }
            })),
            getCurrentWallet: jest.fn(async () => ({
                id: 'test-wallet-id',
                name: 'Test Wallet',
                accounts: [{
                    id: 'account-0',
                    name: 'Primary Account',
                    address: 'addr1test_primary',
                    stakeAddress: 'stake1u_test',
                    balance: '0'
                }]
            })),
            restoreWallet: jest.fn(),
            createAccount: jest.fn(),
            sendTransaction: jest.fn(),
            previewTransaction: jest.fn(),
            generateReceiveAddress: jest.fn(),
            getTransactionHistory: jest.fn(),
            getAccountBalance: jest.fn(),
            syncWallet: jest.fn(),
            clearWallet: jest.fn(),
        }))
    }
}));

// Mock Portfolio Services
jest.mock('../services/portfolio/AssetPriceService', () => {
    class MockAssetPriceService {
        static instance: MockAssetPriceService;
        
        static getInstance() {
            if (!MockAssetPriceService.instance) {
                MockAssetPriceService.instance = new MockAssetPriceService();
            }
            return MockAssetPriceService.instance;
        }

        async getAssetPrices() {
            return {
                'ADA': { price: 1.25, change24h: 0.05 },
                'BTC': { price: 45000, change24h: -0.02 }
            };
        }

        async getAssetPrice() {
            return { price: 1.25, change24h: 0.05 };
        }

        async getRealTimePrice() {
            return { price: 1.25, change24h: 0.05 };
        }
    }

    return {
        __esModule: true,
        AssetPriceService: MockAssetPriceService,
        default: MockAssetPriceService
    };
});

// Mock WalletDataCacheService
jest.mock('../services/cache/WalletDataCache', () => ({
    WalletDataCacheService: {
        getInstance: jest.fn(() => ({
            getTransactionHistory: jest.fn(async () => ({
                data: { transactions: [] },
                syncStatus: 'synced'
            })),
            getAccountBalance: jest.fn(async () => ({
                data: { confirmed: '0', unconfirmed: '0' },
                syncStatus: 'synced'
            })),
            getAccountUtxos: jest.fn(async () => ({
                data: { utxos: [] },
                syncStatus: 'synced'
            })),
            clearCache: jest.fn(),
            getStats: jest.fn(() => ({
                activeSyncs: 0,
                syncQueueSize: 0
            })),
            addTransaction: jest.fn(),
        }))
    }
}));

// Mock CardanoAPIService with proper UTXO and API data
jest.mock('../services/CardanoAPIService', () => ({
    CardanoAPIService: {
        getInstance: jest.fn(() => ({
            getAddressUTXOs: jest.fn(async (address) => [
                {
                    tx_hash: 'mock_utxo_tx_1',
                    tx_index: 0,
                    output_index: 0,
                    address: address,
                    amount: [{ unit: 'lovelace', quantity: '5000000' }],
                    block: 'mock_block_1',
                },
                {
                    tx_hash: 'mock_utxo_tx_2', 
                    tx_index: 1,
                    output_index: 0,
                    address: address,
                    amount: [{ unit: 'lovelace', quantity: '3000000' }],
                    block: 'mock_block_2',
                }
            ]),
            getAddressInfo: jest.fn(async (address) => ({
                address,
                amount: [{ unit: 'lovelace', quantity: '8000000' }],
                stake_address: 'stake1u_test',
                type: 'shelley',
                script: false
            })),
            get: jest.fn(async (endpoint) => {
                // Simulate API response with proper structure
                if (endpoint.includes('/addresses/')) {
                    const address = endpoint.split('/addresses/')[1];
                    return {
                        address,
                        amount: [{ unit: 'lovelace', quantity: '8000000' }],
                        stake_address: 'stake1u_test',
                        type: 'shelley',
                        script: false
                    };
                }
                return {};
            }),
            getTransaction: jest.fn(async (txHash) => ({
                hash: txHash,
                block: 'mock_block',
                slot: 12345,
                index: 0,
                output_amount: [{ unit: 'lovelace', quantity: '2000000' }],
                fees: '200000',
                deposit: '0',
                size: 256,
                invalid_before: null,
                invalid_hereafter: null,
            })),
            submitTransaction: jest.fn(async (txHex) => ({
                data: { hash: 'submitted_tx_hash_123' },
                status: 200
            })),
            getTransactionUTXOs: jest.fn(async (txHash) => ({
                hash: txHash,
                inputs: [],
                outputs: [
                    {
                        address: 'addr1test_recipient',
                        amount: [{ unit: 'lovelace', quantity: '2000000' }],
                        output_index: 0
                    }
                ]
            }))
        }))
    }
}));

// Mock AccountManager with proper UTXO data for testing
export const mockAccountManager = {
    getAccountUTXOs: jest.fn(async (address) => [
        {
            tx_hash: 'mock_tx_hash_1',
            tx_index: 0,
            output_index: 0,
            address: address || 'addr1test_mock',
            amount: [{ unit: 'lovelace', quantity: '5000000' }],
            block: 'mock_block_hash',
        },
        {
            tx_hash: 'mock_tx_hash_2',
            tx_index: 1,
            output_index: 0,
            address: address || 'addr1test_mock',
            amount: [{ unit: 'lovelace', quantity: '3000000' }],
            block: 'mock_block_hash',
        }
    ]),
    getAccountBalance: jest.fn(async () => ({ confirmed: '8000000', unconfirmed: '0' })),
    getTransactionHistory: jest.fn(async () => []),
};

// Mock AccountManager
jest.mock('../services/wallet/AccountManager', () => ({
    AccountManager: {
        getInstance: jest.fn(() => mockAccountManager)
    }
}));

// Mock PortfolioService
jest.mock('../services/portfolio/PortfolioService', () => {
    class MockPortfolioService {
        static instance: MockPortfolioService;
        
        static getInstance() {
            if (!MockPortfolioService.instance) {
                MockPortfolioService.instance = new MockPortfolioService();
            }
            return MockPortfolioService.instance;
        }

        async getComprehensivePortfolioReport() {
            return {
                summary: { totalValue: 10000, totalAda: 5000, assetCount: 10 },
                holdings: [],
                performance: { '24h': 0.05 },
                staking: { isStaking: false, rewards: 0 }
            };
        }

        async getPortfolioAnalytics() {
            return { risk: 'low', diversification: 'good' };
        }

        async getHistoricalPerformance() {
            return { dataPoints: [], totalReturn: 0.15 };
        }
    }

    return {
        __esModule: true,
        PortfolioService: MockPortfolioService,
        default: MockPortfolioService
    };
});

// Mock PortfolioCalculationService
jest.mock('../services/portfolio/PortfolioCalculationService', () => {
    class MockPortfolioCalculationService {
        static instance: MockPortfolioCalculationService;
        
        static getInstance() {
            if (!MockPortfolioCalculationService.instance) {
                MockPortfolioCalculationService.instance = new MockPortfolioCalculationService();
            }
            return MockPortfolioCalculationService.instance;
        }

        async calculatePortfolioValue() {
            return { totalValue: 10000, breakdown: {} };
        }
    }

    return {
        __esModule: true,
        PortfolioCalculationService: MockPortfolioCalculationService,
        default: MockPortfolioCalculationService
    };
});

// Mock AnalyticsEngineService
jest.mock('../services/portfolio/AnalyticsEngineService', () => {
    class MockAnalyticsEngineService {
        static instance: MockAnalyticsEngineService;
        
        static getInstance() {
            if (!MockAnalyticsEngineService.instance) {
                MockAnalyticsEngineService.instance = new MockAnalyticsEngineService();
            }
            return MockAnalyticsEngineService.instance;
        }

        async generateAnalytics() {
            return { risk: 'low', diversification: 'good' };
        }
    }

    return {
        __esModule: true,
        AnalyticsEngineService: MockAnalyticsEngineService,
        default: MockAnalyticsEngineService
    };
});

// Mock WalletKeyManager with static methods
jest.mock('../services/wallet/WalletKeyManager', () => {
    class MockWalletKeyManager {
        static instances = new Map();
        rootKey = null;
        network = 'testnet';

        static getInstance(network = 'testnet') {
            if (!MockWalletKeyManager.instances.has(network)) {
                MockWalletKeyManager.instances.set(network, new MockWalletKeyManager());
            }
            return MockWalletKeyManager.instances.get(network);
        }

        static generateMnemonic(strength = 128) {
            const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            return strength === 256 ? words + ' ' + words : words;
        }

        static validateMnemonic(mnemonic) {
            return typeof mnemonic === 'string' && mnemonic.split(' ').length >= 12;
        }

        async initializeFromMnemonic(mnemonic) {
            if (!MockWalletKeyManager.validateMnemonic(mnemonic)) {
                return false;
            }
            this.rootKey = 'mock_root_key';
            return true;
        }

        isInitialized() {
            return this.rootKey !== null;
        }

        async createAccount(accountIndex = 0, name = 'Account') {
            if (!this.isInitialized()) {
                throw new Error('Wallet not initialized. Call initializeFromMnemonic first.');
            }
            return {
                id: `account-${accountIndex}`,
                name,
                accountIndex,
                address: `addr1test_account_${accountIndex}`,
                stakeAddress: `stake1u_test_${accountIndex}`,
                balance: '0',
                isActive: true,
                derivationPath: `m/1852'/1815'/${accountIndex}'`
            };
        }

        async generateNewAddress(accountIndex, addressIndex, isChange = false) {
            if (!this.isInitialized()) {
                throw new Error('Wallet not initialized');
            }
            return `addr1test_${accountIndex}_${addressIndex}_${isChange ? 'change' : 'receive'}`;
        }

        async getPaymentSigningKey(accountIndex = 0, addressIndex = 0, isChange = false) {
            if (!this.isInitialized()) {
                throw new Error('Wallet not initialized');
            }
            return {
                to_raw_key: jest.fn(() => ({
                    to_public: jest.fn(() => ({
                        to_public: jest.fn(() => ({})),
                        to_raw_key: jest.fn(() => ({}))
                    })),
                    sign: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
                }))
            };
        }

        async getStakeSigningKey(accountIndex = 0) {
            if (!this.isInitialized()) {
                throw new Error('Wallet not initialized');
            }
            return {
                to_raw_key: jest.fn(() => ({
                    to_public: jest.fn(() => ({
                        to_public: jest.fn(() => ({})),
                        to_raw_key: jest.fn(() => ({}))
                    })),
                    sign: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
                }))
            };
        }

        clearSensitiveData() {
            this.rootKey = null;
        }

        setNetwork(network) {
            this.network = network;
            this.clearSensitiveData(); // Clear data when switching networks
        }
    }

    return {
        __esModule: true,
        default: MockWalletKeyManager
    };
});

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
