/**
 * ServiceTokens - Type-safe service identifiers for dependency injection
 * 
 * This file contains all service tokens used throughout the application.
 * Using string constants ensures type safety and prevents typos.
 */

// =============================================================================
// CORE SERVICES
// =============================================================================

export const CORE_TOKENS = {
    // Error Handling
    ERROR_HANDLER: 'ErrorHandler',
    ENHANCED_ERROR_HANDLER: 'EnhancedErrorHandler',
    
    // Network & API
    NETWORK_SERVICE: 'NetworkService',
    CARDANO_API_SERVICE: 'CardanoAPIService',
    
    // Configuration
    CONFIGURATION_SERVICE: 'ConfigurationService',
    ENVIRONMENT: 'Environment',
    
    // Event System
    EVENT_BUS: 'EventBus',
    
    // Performance
    PERFORMANCE_MONITOR: 'PerformanceMonitor',
    
    // Storage
    WALLET_DATA_SERVICE: 'WalletDataService',
    
    // Security
    CERTIFICATE_PINNING_SERVICE: 'CertificatePinningService',
    
    // Offline Transactions
    OFFLINE_TRANSACTION_SERVICE: 'OfflineTransactionService'
} as const;

// =============================================================================
// WALLET SERVICES
// =============================================================================

export const WALLET_TOKENS = {
    // Legacy Services (Wrappers)
    CARDANO_WALLET_SERVICE: 'CardanoWalletService',
    
    // New Modular Architecture
    WALLET_SERVICE: 'WalletService',
    WALLET_KEY_MANAGER: 'WalletKeyManager',
    TRANSACTION_BUILDER: 'TransactionBuilder',
    ACCOUNT_MANAGER: 'AccountManager',
    
    // State Management
    WALLET_STATE_SERVICE: 'WalletStateService'
} as const;

// =============================================================================
// BLUETOOTH SERVICES
// =============================================================================

export const BLUETOOTH_TOKENS = {
    // Legacy Service (Wrapper)
    BLUETOOTH_TRANSFER_SERVICE: 'BluetoothTransferService',
    
    // New Modular Architecture
    BLUETOOTH_TRANSACTION_SERVICE: 'BluetoothTransactionService',
    BLE_DEVICE_MANAGER: 'BLEDeviceManager',
    BLE_CONNECTION_MANAGER: 'BLEConnectionManager',
    BLE_DATA_TRANSFER: 'BLEDataTransfer'
} as const;

// =============================================================================
// PORTFOLIO SERVICES
// =============================================================================

export const PORTFOLIO_TOKENS = {
    // Legacy Service (Wrapper)
    PORTFOLIO_ANALYTICS_SERVICE: 'PortfolioAnalyticsService',
    
    // New Modular Architecture
    PORTFOLIO_SERVICE: 'PortfolioService',
    ASSET_PRICE_SERVICE: 'AssetPriceService',
    PORTFOLIO_CALCULATION_SERVICE: 'PortfolioCalculationService',
    ANALYTICS_ENGINE_SERVICE: 'AnalyticsEngineService'
} as const;

// =============================================================================
// SECURITY SERVICES
// =============================================================================

export const SECURITY_TOKENS = {
    // Biometric Authentication
    BIOMETRIC_SERVICE: 'BiometricService',
    
    // Cryptography
    MNEMONIC_ENCRYPTION_SERVICE: 'MnemonicEncryptionService',
    MNEMONIC_TRANSFORM_SERVICE: 'MnemonicTransformService',
    
    // Secure Communication
    SECURE_TRANSFER_SERVICE: 'SecureTransferService',
    
    // NFC
    NFC_SERVICE: 'NFCService',
    
    // Identity & Recovery
    SECURE_IDENTITY_SERVICE: 'SecureIdentityService',
    MERCHANT_IDENTITY_SERVICE: 'MerchantIdentityService',
    GUARDIAN_KEY_SERVICE: 'GuardianKeyService',
    GUARDIAN_RECOVERY_SERVICE: 'GuardianRecoveryService'
} as const;

// =============================================================================
// ADVANCED SERVICES
// =============================================================================

export const ADVANCED_TOKENS = {
    // Multi-signature
    MULTI_SIGNATURE_SERVICE: 'MultiSignatureService',
    
    // NFT Management
    NFT_MANAGEMENT_SERVICE: 'NFTManagementService',
    
    // DeFi & Staking
    DEFI_STAKING_SERVICE: 'DeFiStakingService',
    
    // Address Resolution
    ADDRESS_RESOLVER_SERVICE: 'AddressResolverService'
} as const;

// =============================================================================
// UTILITY SERVICES
// =============================================================================

export const UTILITY_TOKENS = {
    // Logging
    LOGGER: 'Logger',
    
    // Memory Management
    MEMORY_UTILS: 'MemoryUtils',
    
    // Cryptographic Utilities
    CRYPTO_UTILS: 'CryptoUtils'
} as const;

// =============================================================================
// AGGREGATED TOKENS
// =============================================================================

export const SERVICE_TOKENS = {
    ...CORE_TOKENS,
    ...WALLET_TOKENS,
    ...BLUETOOTH_TOKENS,
    ...PORTFOLIO_TOKENS,
    ...SECURITY_TOKENS,
    ...ADVANCED_TOKENS,
    ...UTILITY_TOKENS
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CoreServiceToken = keyof typeof CORE_TOKENS;
export type WalletServiceToken = keyof typeof WALLET_TOKENS;
export type BluetoothServiceToken = keyof typeof BLUETOOTH_TOKENS;
export type PortfolioServiceToken = keyof typeof PORTFOLIO_TOKENS;
export type SecurityServiceToken = keyof typeof SECURITY_TOKENS;
export type AdvancedServiceToken = keyof typeof ADVANCED_TOKENS;
export type UtilityServiceToken = keyof typeof UTILITY_TOKENS;

export type ServiceToken = keyof typeof SERVICE_TOKENS;

// =============================================================================
// TOKEN GROUPS
// =============================================================================

export const TOKEN_GROUPS = {
    CORE: Object.values(CORE_TOKENS),
    WALLET: Object.values(WALLET_TOKENS),
    BLUETOOTH: Object.values(BLUETOOTH_TOKENS),
    PORTFOLIO: Object.values(PORTFOLIO_TOKENS),
    SECURITY: Object.values(SECURITY_TOKENS),
    ADVANCED: Object.values(ADVANCED_TOKENS),
    UTILITY: Object.values(UTILITY_TOKENS)
} as const;

export const ALL_TOKENS = Object.values(SERVICE_TOKENS);

// =============================================================================
// TOKEN VALIDATION
// =============================================================================

/**
 * Check if a string is a valid service token
 */
export function isValidServiceToken(token: string): token is keyof typeof SERVICE_TOKENS {
    return (ALL_TOKENS as readonly string[]).includes(token);
}

/**
 * Get token group for a service token
 */
export function getTokenGroup(token: string): string | null {
    for (const [groupName, tokens] of Object.entries(TOKEN_GROUPS)) {
        if ((tokens as readonly string[]).includes(token)) {
            return groupName;
        }
    }
    return null;
}

/**
 * Get all tokens in a specific group
 */
export function getTokensInGroup(groupName: keyof typeof TOKEN_GROUPS): readonly string[] {
    return TOKEN_GROUPS[groupName];
}

// =============================================================================
// TOKEN METADATA
// =============================================================================

export interface ServiceTokenMetadata {
    token: string;
    group: string;
    description: string;
    isLegacy: boolean;
    dependencies?: string[];
}

/**
 * Get metadata for all service tokens
 */
export function getAllTokenMetadata(): ServiceTokenMetadata[] {
    const metadata: ServiceTokenMetadata[] = [];

    // Core Services
    Object.values(CORE_TOKENS).forEach(token => {
        metadata.push({
            token,
            group: 'CORE',
            description: getTokenDescription(token),
            isLegacy: false
        });
    });

    // Wallet Services
    Object.values(WALLET_TOKENS).forEach(token => {
        metadata.push({
            token,
            group: 'WALLET',
            description: getTokenDescription(token),
            isLegacy: token === WALLET_TOKENS.CARDANO_WALLET_SERVICE
        });
    });

    // Bluetooth Services
    Object.values(BLUETOOTH_TOKENS).forEach(token => {
        metadata.push({
            token,
            group: 'BLUETOOTH',
            description: getTokenDescription(token),
            isLegacy: token === BLUETOOTH_TOKENS.BLUETOOTH_TRANSFER_SERVICE
        });
    });

    // Portfolio Services
    Object.values(PORTFOLIO_TOKENS).forEach(token => {
        metadata.push({
            token,
            group: 'PORTFOLIO',
            description: getTokenDescription(token),
            isLegacy: token === PORTFOLIO_TOKENS.PORTFOLIO_ANALYTICS_SERVICE
        });
    });

    // Security Services
    Object.values(SECURITY_TOKENS).forEach(token => {
        metadata.push({
            token,
            group: 'SECURITY',
            description: getTokenDescription(token),
            isLegacy: false
        });
    });

    // Advanced Services
    Object.values(ADVANCED_TOKENS).forEach(token => {
        metadata.push({
            token,
            group: 'ADVANCED',
            description: getTokenDescription(token),
            isLegacy: false
        });
    });

    // Utility Services
    Object.values(UTILITY_TOKENS).forEach(token => {
        metadata.push({
            token,
            group: 'UTILITY',
            description: getTokenDescription(token),
            isLegacy: false
        });
    });

    return metadata;
}

/**
 * Get human-readable description for a token
 */
function getTokenDescription(token: string): string {
    const descriptions: { [key: string]: string } = {
        // Core
        [CORE_TOKENS.ERROR_HANDLER]: 'Global error handling and logging',
        [CORE_TOKENS.NETWORK_SERVICE]: 'Network connectivity and request management',
        [CORE_TOKENS.CARDANO_API_SERVICE]: 'Cardano blockchain API integration',
        [CORE_TOKENS.CONFIGURATION_SERVICE]: 'Application configuration management',
        [CORE_TOKENS.ENVIRONMENT]: 'Environment variables and settings',
        [CORE_TOKENS.EVENT_BUS]: 'Event-driven communication system',
        [CORE_TOKENS.PERFORMANCE_MONITOR]: 'Performance monitoring and metrics',
        [CORE_TOKENS.WALLET_DATA_SERVICE]: 'Wallet data persistence and storage',
        [CORE_TOKENS.CERTIFICATE_PINNING_SERVICE]: 'SSL certificate pinning security',
        [CORE_TOKENS.OFFLINE_TRANSACTION_SERVICE]: 'Offline transaction management',

        // Wallet
        [WALLET_TOKENS.CARDANO_WALLET_SERVICE]: 'Legacy wallet service (wrapper)',
        [WALLET_TOKENS.WALLET_SERVICE]: 'Main wallet orchestration service',
        [WALLET_TOKENS.WALLET_KEY_MANAGER]: 'Key derivation and address management',
        [WALLET_TOKENS.TRANSACTION_BUILDER]: 'Transaction construction and signing',
        [WALLET_TOKENS.ACCOUNT_MANAGER]: 'Account and balance management',
        [WALLET_TOKENS.WALLET_STATE_SERVICE]: 'Wallet state management',

        // Bluetooth
        [BLUETOOTH_TOKENS.BLUETOOTH_TRANSFER_SERVICE]: 'Legacy Bluetooth service (wrapper)',
        [BLUETOOTH_TOKENS.BLUETOOTH_TRANSACTION_SERVICE]: 'Bluetooth transaction orchestration',
        [BLUETOOTH_TOKENS.BLE_DEVICE_MANAGER]: 'BLE device discovery and management',
        [BLUETOOTH_TOKENS.BLE_CONNECTION_MANAGER]: 'BLE connection lifecycle management',
        [BLUETOOTH_TOKENS.BLE_DATA_TRANSFER]: 'Frame-based encrypted data transfer',

        // Portfolio
        [PORTFOLIO_TOKENS.PORTFOLIO_ANALYTICS_SERVICE]: 'Legacy portfolio service (wrapper)',
        [PORTFOLIO_TOKENS.PORTFOLIO_SERVICE]: 'Portfolio management orchestration',
        [PORTFOLIO_TOKENS.ASSET_PRICE_SERVICE]: 'Real-time and historical price data',
        [PORTFOLIO_TOKENS.PORTFOLIO_CALCULATION_SERVICE]: 'Portfolio value calculations',
        [PORTFOLIO_TOKENS.ANALYTICS_ENGINE_SERVICE]: 'Advanced portfolio analytics',

        // Security
        [SECURITY_TOKENS.BIOMETRIC_SERVICE]: 'Biometric authentication',
        [SECURITY_TOKENS.MNEMONIC_ENCRYPTION_SERVICE]: 'Mnemonic phrase encryption',
        [SECURITY_TOKENS.MNEMONIC_TRANSFORM_SERVICE]: 'Mnemonic transformation and obfuscation',
        [SECURITY_TOKENS.SECURE_TRANSFER_SERVICE]: 'Secure data transfer protocols',
        [SECURITY_TOKENS.NFC_SERVICE]: 'Near Field Communication integration',
        [SECURITY_TOKENS.SECURE_IDENTITY_SERVICE]: 'Identity verification and management',
        [SECURITY_TOKENS.MERCHANT_IDENTITY_SERVICE]: 'Merchant identity resolution',
        [SECURITY_TOKENS.GUARDIAN_KEY_SERVICE]: 'Guardian key management',
        [SECURITY_TOKENS.GUARDIAN_RECOVERY_SERVICE]: 'Guardian-based wallet recovery',

        // Advanced
        [ADVANCED_TOKENS.MULTI_SIGNATURE_SERVICE]: 'Multi-signature transaction support',
        [ADVANCED_TOKENS.NFT_MANAGEMENT_SERVICE]: 'NFT collection and management',
        [ADVANCED_TOKENS.DEFI_STAKING_SERVICE]: 'DeFi and staking operations',
        [ADVANCED_TOKENS.ADDRESS_RESOLVER_SERVICE]: 'Address resolution and validation',

        // Utility
        [UTILITY_TOKENS.LOGGER]: 'Centralized logging service',
        [UTILITY_TOKENS.MEMORY_UTILS]: 'Secure memory management utilities',
        [UTILITY_TOKENS.CRYPTO_UTILS]: 'Cryptographic utility functions'
    };

    return descriptions[token] || 'Service description not available';
}

export default SERVICE_TOKENS;
