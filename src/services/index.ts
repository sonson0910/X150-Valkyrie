// Core Services
export { ErrorHandler } from './ErrorHandler';
export { NetworkService } from './NetworkService';
export { OfflineTransactionService } from './OfflineTransactionService';
export { EventBus } from './EventBus';
export { PerformanceMonitor } from './PerformanceMonitor';
export { WalletDataService } from './WalletDataService';
export { CertificatePinningService } from './CertificatePinningService';
export { ConfigurationService } from './ConfigurationService';

// Cardano Services
export { CardanoAPIService } from './CardanoAPIService';
// Legacy CardanoWalletService (wrapper)
export { CardanoWalletService } from './CardanoWalletService';

// New modular wallet architecture
export { default as WalletService } from './wallet/WalletService';
export { default as WalletKeyManager } from './wallet/WalletKeyManager';
export { default as TransactionBuilder } from './wallet/TransactionBuilder';
export { default as AccountManager } from './wallet/AccountManager';

// Export wallet types
export type { TransactionRequest, TransactionResult } from './wallet/TransactionBuilder';

// Bluetooth Services  
// Legacy BluetoothTransferService (wrapper)
export { BluetoothTransferService } from './BluetoothTransferService';

// New modular Bluetooth architecture
export { default as BluetoothTransactionService } from './bluetooth/BluetoothTransactionService';
export { default as BLEDeviceManager } from './bluetooth/BLEDeviceManager';
export { default as BLEConnectionManager } from './bluetooth/BLEConnectionManager';
export { default as BLEDataTransfer } from './bluetooth/BLEDataTransfer';

// Export Bluetooth types
export type { MerchantDevice, TransferResult } from './bluetooth/BluetoothTransactionService';
export type { BLEDevice, BLEManager } from './bluetooth/BLEDeviceManager';
export type { TransferSession, TransferFrame } from './bluetooth/BLEDataTransfer';

export { AddressResolverService } from './AddressResolverService';

// Security Services
export { BiometricService } from './BiometricService';
export { MnemonicEncryptionService } from './MnemonicEncryptionService';

// Communication Services
export { SecureTransferService } from './SecureTransferService';

// Portfolio Services
// Legacy PortfolioAnalyticsService (wrapper)
export { PortfolioAnalyticsService } from './PortfolioAnalyticsService';

// New modular portfolio architecture
export { default as PortfolioService } from './portfolio/PortfolioService';
export { default as AssetPriceService } from './portfolio/AssetPriceService';
export { default as PortfolioCalculationService } from './portfolio/PortfolioCalculationService';
export { default as AnalyticsEngineService } from './portfolio/AnalyticsEngineService';

// Export portfolio types
export type { ComprehensivePortfolioReport, PortfolioInsights, PortfolioComparisonData } from './portfolio/PortfolioService';
export type { PriceData, HistoricalPrice } from './portfolio/AssetPriceService';
export type { PortfolioSummary, PortfolioAsset, PortfolioPerformance, AssetAllocation } from './portfolio/PortfolioCalculationService';
export type { TransactionAnalytics, StakingAnalytics, NFTCollectionAnalytics, DeFiAnalytics, RiskMetrics } from './portfolio/AnalyticsEngineService';

// Advanced Services
export { MultiSignatureService } from './MultiSignatureService';
export { NFTManagementService } from './NFTManagementService';
export { DeFiStakingService } from './DeFiStakingService';
export { GuardianRecoveryService } from './GuardianRecoveryService';

// =========================================================================
// INTELLIGENT CACHING SERVICES
// =========================================================================

// Export unified cache manager and core services
export {
    cacheManager,
    intelligentCache,
    UnifiedCacheManager,
    IntelligentCacheManager
} from './cache';

// Export specialized cache services
export {
    ApiResponseCacheService,
    walletDataCache,
    WalletDataCacheService,
    portfolioDataCache,
    PortfolioDataCacheService
} from './cache';

// Export cache utilities and decorators
export {
    Cached,
    CacheInvalidateOnChange,
    CacheKeyUtils,
    CacheMonitor
} from './cache';

// Export cache types and enums
export {
    CacheStrategy,
    CachePriority,
    type CacheOptions,
    type CacheEntry,
    type CacheStats,
    type ApiCacheConfig,
    type ApiRequestOptions,
    type CachedApiResponse,
    type WalletCacheEntry,
    type TransactionCacheData,
    type BalanceCacheData,
    type UtxoCacheData,
    type StakingCacheData,
    type AssetPriceData,
    type PortfolioAnalyticsData,
    type HistoricalPriceData,
    type MarketDataCache,
    type PerformanceMetrics
} from './cache';
