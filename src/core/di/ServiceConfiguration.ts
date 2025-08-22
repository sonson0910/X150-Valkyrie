import ServiceContainer, { ServiceLifetime } from './ServiceContainer';
import { SERVICE_TOKENS } from './ServiceTokens';
import logger from '../../utils/Logger';

// Import all services - grouped by category
// Core Services
import { ErrorHandler } from '../../services/ErrorHandler';
import EnhancedErrorHandler from '../errors/EnhancedErrorHandler';
import { NetworkService } from '../../services/NetworkService';
import { CardanoAPIService } from '../../services/CardanoAPIService';
import { ConfigurationService } from '../../services/ConfigurationService';
import { environment } from '../../config/Environment';
import { EventBus } from '../../services/EventBus';
import { PerformanceMonitor } from '../../services/PerformanceMonitor';
import { WalletDataService } from '../../services/WalletDataService';
import { CertificatePinningService } from '../../services/CertificatePinningService';
import { OfflineTransactionService } from '../../services/OfflineTransactionService';

// Wallet Services
import { CardanoWalletService } from '../../services/CardanoWalletService';
import WalletService from '../../services/wallet/WalletService';
import WalletKeyManager from '../../services/wallet/WalletKeyManager';
import TransactionBuilder from '../../services/wallet/TransactionBuilder';
import AccountManager from '../../services/wallet/AccountManager';
import { WalletStateService } from '../../services/WalletStateService';

// Bluetooth Services
import { BluetoothTransferService } from '../../services/BluetoothTransferService';
import BluetoothTransactionService from '../../services/bluetooth/BluetoothTransactionService';
import BLEDeviceManager from '../../services/bluetooth/BLEDeviceManager';
import BLEConnectionManager from '../../services/bluetooth/BLEConnectionManager';
import BLEDataTransfer from '../../services/bluetooth/BLEDataTransfer';

// Portfolio Services
import { PortfolioAnalyticsService } from '../../services/PortfolioAnalyticsService';
import PortfolioService from '../../services/portfolio/PortfolioService';
import AssetPriceService from '../../services/portfolio/AssetPriceService';
import PortfolioCalculationService from '../../services/portfolio/PortfolioCalculationService';
import AnalyticsEngineService from '../../services/portfolio/AnalyticsEngineService';

// Security Services
import { BiometricService } from '../../services/BiometricService';
import { MnemonicEncryptionService } from '../../services/MnemonicEncryptionService';
import MnemonicTransformService from '../../services/MnemonicTransformService';
import { SecureTransferService } from '../../services/SecureTransferService';
import { NFCService } from '../../services/NFCService';

// Advanced Services
import { MultiSignatureService } from '../../services/MultiSignatureService';
import { NFTManagementService } from '../../services/NFTManagementService';
import { DeFiStakingService } from '../../services/DeFiStakingService';
import { AddressResolverService } from '../../services/AddressResolverService';
import { GuardianRecoveryService } from '../../services/GuardianRecoveryService';

// Utilities
import { MemoryUtils } from '../../utils/MemoryUtils';
import { CryptoUtils } from '../../utils/CryptoUtils';

/**
 * ServiceConfiguration - Centralized DI container configuration
 * 
 * This class configures all services in the dependency injection container
 * with proper lifetimes, dependencies, and initialization order.
 */
export class ServiceConfiguration {
    private static isConfigured = false;

    /**
     * Configure all services in the container
     */
    static configure(container: ServiceContainer): void {
        if (ServiceConfiguration.isConfigured) {
            logger.warn('Services already configured, skipping', 'ServiceConfiguration.configure');
            return;
        }

        try {
            logger.info('Configuring dependency injection container', 'ServiceConfiguration.configure');

            // Configure services in dependency order
            ServiceConfiguration.configureUtilities(container);
            ServiceConfiguration.configureCoreServices(container);
            ServiceConfiguration.configureSecurityServices(container);
            ServiceConfiguration.configureWalletServices(container);
            ServiceConfiguration.configureBluetoothServices(container);
            ServiceConfiguration.configurePortfolioServices(container);
            ServiceConfiguration.configureAdvancedServices(container);

            // Validate container configuration
            const validation = container.validate();
            if (!validation.isValid) {
                logger.error('Container validation failed', 'ServiceConfiguration.configure', validation.errors);
                throw new Error(`Container validation failed: ${validation.errors.join(', ')}`);
            }

            ServiceConfiguration.isConfigured = true;
            logger.info('Dependency injection container configured successfully', 'ServiceConfiguration.configure', {
                totalServices: container.getRegisteredTokens().length
            });

        } catch (error) {
            logger.error('Failed to configure dependency injection container', 'ServiceConfiguration.configure', error);
            throw new Error(`Service configuration failed: ${error}`);
        }
    }

    /**
     * Configure utility services (no dependencies)
     */
    private static configureUtilities(container: ServiceContainer): void {
        // Logger (singleton instance already exists)
        container.registerInstance(SERVICE_TOKENS.LOGGER, logger);

        // Memory utilities (stateless)
        container.registerSingleton(
            SERVICE_TOKENS.MEMORY_UTILS,
            () => MemoryUtils
        );

        // Crypto utilities (stateless)
        container.registerSingleton(
            SERVICE_TOKENS.CRYPTO_UTILS,
            () => CryptoUtils
        );

        // Environment (singleton instance already exists)
        container.registerInstance(SERVICE_TOKENS.ENVIRONMENT, environment);

        logger.debug('Utility services configured', 'ServiceConfiguration.configureUtilities');
    }

    /**
     * Configure core services
     */
    private static configureCoreServices(container: ServiceContainer): void {
        // Error Handler (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.ERROR_HANDLER,
            () => ErrorHandler.getInstance()
        );

        // Enhanced Error Handler (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.ENHANCED_ERROR_HANDLER,
            () => EnhancedErrorHandler.getInstance()
        );

        // Event Bus (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.EVENT_BUS,
            () => EventBus.getInstance()
        );

        // Performance Monitor (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.PERFORMANCE_MONITOR,
            () => PerformanceMonitor.getInstance()
        );

        // Network Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.NETWORK_SERVICE,
            () => NetworkService.getInstance()
        );

        // Certificate Pinning Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.CERTIFICATE_PINNING_SERVICE,
            () => CertificatePinningService.getInstance()
        );

        // Cardano API Service (singleton, depends on Network Service)
        container.registerSingleton(
            SERVICE_TOKENS.CARDANO_API_SERVICE,
            () => CardanoAPIService.getInstance(),
            [SERVICE_TOKENS.NETWORK_SERVICE]
        );

        // Configuration Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.CONFIGURATION_SERVICE,
            () => ConfigurationService.getInstance()
        );

        // Wallet Data Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.WALLET_DATA_SERVICE,
            () => WalletDataService.getInstance()
        );

        // Offline Transaction Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.OFFLINE_TRANSACTION_SERVICE,
            () => OfflineTransactionService.getInstance()
        );

        logger.debug('Core services configured', 'ServiceConfiguration.configureCoreServices');
    }

    /**
     * Configure security services
     */
    private static configureSecurityServices(container: ServiceContainer): void {
        // Biometric Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.BIOMETRIC_SERVICE,
            () => BiometricService.getInstance()
        );

        // Mnemonic Encryption Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.MNEMONIC_ENCRYPTION_SERVICE,
            () => MnemonicEncryptionService
        );

        // Mnemonic Transform Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.MNEMONIC_TRANSFORM_SERVICE,
            () => MnemonicTransformService
        );

        // Secure Transfer Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.SECURE_TRANSFER_SERVICE,
            () => SecureTransferService.getInstance()
        );

        // NFC Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.NFC_SERVICE,
            () => NFCService.getInstance()
        );

        logger.debug('Security services configured', 'ServiceConfiguration.configureSecurityServices');
    }

    /**
     * Configure wallet services (new modular architecture)
     */
    private static configureWalletServices(container: ServiceContainer): void {
        // Wallet State Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.WALLET_STATE_SERVICE,
            () => WalletStateService.getInstance()
        );

        // Wallet Key Manager (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.WALLET_KEY_MANAGER,
            (c) => WalletKeyManager.getInstance('testnet') // Default to testnet
        );

        // Transaction Builder (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.TRANSACTION_BUILDER,
            (c) => TransactionBuilder.getInstance('testnet'),
            [SERVICE_TOKENS.CARDANO_API_SERVICE, SERVICE_TOKENS.WALLET_KEY_MANAGER]
        );

        // Account Manager (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.ACCOUNT_MANAGER,
            (c) => AccountManager.getInstance('testnet'),
            [SERVICE_TOKENS.CARDANO_API_SERVICE, SERVICE_TOKENS.WALLET_KEY_MANAGER]
        );

        // Wallet Service (main facade, singleton)
        container.registerSingleton(
            SERVICE_TOKENS.WALLET_SERVICE,
            (c) => WalletService.getInstance('testnet'),
            [
                SERVICE_TOKENS.WALLET_KEY_MANAGER,
                SERVICE_TOKENS.TRANSACTION_BUILDER,
                SERVICE_TOKENS.ACCOUNT_MANAGER
            ]
        );

        // Legacy Cardano Wallet Service (wrapper, singleton)
        container.registerSingleton(
            SERVICE_TOKENS.CARDANO_WALLET_SERVICE,
            (c) => CardanoWalletService.getInstance('testnet'),
            [SERVICE_TOKENS.WALLET_SERVICE]
        );

        logger.debug('Wallet services configured', 'ServiceConfiguration.configureWalletServices');
    }

    /**
     * Configure Bluetooth services (new modular architecture)
     */
    private static configureBluetoothServices(container: ServiceContainer): void {
        // BLE Device Manager (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.BLE_DEVICE_MANAGER,
            () => BLEDeviceManager.getInstance()
        );

        // BLE Connection Manager (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.BLE_CONNECTION_MANAGER,
            () => BLEConnectionManager.getInstance(),
            [SERVICE_TOKENS.BLE_DEVICE_MANAGER]
        );

        // BLE Data Transfer (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.BLE_DATA_TRANSFER,
            () => BLEDataTransfer.getInstance(),
            [SERVICE_TOKENS.SECURE_TRANSFER_SERVICE]
        );

        // Bluetooth Transaction Service (main facade, singleton)
        container.registerSingleton(
            SERVICE_TOKENS.BLUETOOTH_TRANSACTION_SERVICE,
            () => BluetoothTransactionService.getInstance(),
            [
                SERVICE_TOKENS.BLE_DEVICE_MANAGER,
                SERVICE_TOKENS.BLE_CONNECTION_MANAGER,
                SERVICE_TOKENS.BLE_DATA_TRANSFER,
                SERVICE_TOKENS.SECURE_TRANSFER_SERVICE
            ]
        );

        // Legacy Bluetooth Transfer Service (wrapper, singleton)
        container.registerSingleton(
            SERVICE_TOKENS.BLUETOOTH_TRANSFER_SERVICE,
            () => BluetoothTransferService.getInstance(),
            [SERVICE_TOKENS.BLUETOOTH_TRANSACTION_SERVICE]
        );

        logger.debug('Bluetooth services configured', 'ServiceConfiguration.configureBluetoothServices');
    }

    /**
     * Configure portfolio services (new modular architecture)
     */
    private static configurePortfolioServices(container: ServiceContainer): void {
        // Asset Price Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.ASSET_PRICE_SERVICE,
            () => AssetPriceService.getInstance()
        );

        // Portfolio Calculation Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.PORTFOLIO_CALCULATION_SERVICE,
            () => PortfolioCalculationService.getInstance(),
            [
                SERVICE_TOKENS.ASSET_PRICE_SERVICE,
                SERVICE_TOKENS.CARDANO_API_SERVICE,
                SERVICE_TOKENS.NFT_MANAGEMENT_SERVICE,
                SERVICE_TOKENS.DEFI_STAKING_SERVICE
            ]
        );

        // Analytics Engine Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.ANALYTICS_ENGINE_SERVICE,
            () => AnalyticsEngineService.getInstance(),
            [
                SERVICE_TOKENS.ASSET_PRICE_SERVICE,
                SERVICE_TOKENS.CARDANO_API_SERVICE,
                SERVICE_TOKENS.NFT_MANAGEMENT_SERVICE,
                SERVICE_TOKENS.DEFI_STAKING_SERVICE
            ]
        );

        // Portfolio Service (main facade, singleton)
        container.registerSingleton(
            SERVICE_TOKENS.PORTFOLIO_SERVICE,
            () => PortfolioService.getInstance(),
            [
                SERVICE_TOKENS.ASSET_PRICE_SERVICE,
                SERVICE_TOKENS.PORTFOLIO_CALCULATION_SERVICE,
                SERVICE_TOKENS.ANALYTICS_ENGINE_SERVICE
            ]
        );

        // Legacy Portfolio Analytics Service (wrapper, singleton)
        container.registerSingleton(
            SERVICE_TOKENS.PORTFOLIO_ANALYTICS_SERVICE,
            () => PortfolioAnalyticsService.getInstance(),
            [SERVICE_TOKENS.PORTFOLIO_SERVICE]
        );

        logger.debug('Portfolio services configured', 'ServiceConfiguration.configurePortfolioServices');
    }

    /**
     * Configure advanced services
     */
    private static configureAdvancedServices(container: ServiceContainer): void {
        // NFT Management Service (singleton) - register early as it's a dependency
        container.registerSingleton(
            SERVICE_TOKENS.NFT_MANAGEMENT_SERVICE,
            () => NFTManagementService.getInstance(),
            [SERVICE_TOKENS.CARDANO_API_SERVICE]
        );

        // DeFi Staking Service (singleton) - register early as it's a dependency
        container.registerSingleton(
            SERVICE_TOKENS.DEFI_STAKING_SERVICE,
            () => DeFiStakingService.getInstance(),
            [SERVICE_TOKENS.CARDANO_API_SERVICE]
        );

        // Multi-signature Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.MULTI_SIGNATURE_SERVICE,
            () => MultiSignatureService.getInstance(),
            [SERVICE_TOKENS.CARDANO_API_SERVICE]
        );

        // Address Resolver Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.ADDRESS_RESOLVER_SERVICE,
            () => AddressResolverService.getInstance(),
            [SERVICE_TOKENS.CARDANO_API_SERVICE]
        );

        // Guardian Recovery Service (singleton)
        container.registerSingleton(
            SERVICE_TOKENS.GUARDIAN_RECOVERY_SERVICE,
            () => GuardianRecoveryService.getInstance(),
            [SERVICE_TOKENS.CARDANO_API_SERVICE]
        );

        logger.debug('Advanced services configured', 'ServiceConfiguration.configureAdvancedServices');
    }

    /**
     * Reset configuration state (for testing)
     */
    static reset(): void {
        ServiceConfiguration.isConfigured = false;
        logger.debug('Service configuration reset', 'ServiceConfiguration.reset');
    }

    /**
     * Get configuration status
     */
    static isConfigurationComplete(): boolean {
        return ServiceConfiguration.isConfigured;
    }

    /**
     * Configure minimal container (for testing or lightweight scenarios)
     */
    static configureMinimal(container: ServiceContainer): void {
        try {
            logger.debug('Configuring minimal dependency injection container', 'ServiceConfiguration.configureMinimal');

            // Only essential services
            ServiceConfiguration.configureUtilities(container);
            
            // Core essentials
            container.registerSingleton(SERVICE_TOKENS.ERROR_HANDLER, () => ErrorHandler.getInstance());
            container.registerSingleton(SERVICE_TOKENS.NETWORK_SERVICE, () => NetworkService.getInstance());
            container.registerSingleton(SERVICE_TOKENS.CARDANO_API_SERVICE, () => CardanoAPIService.getInstance());

            // Basic wallet services
            container.registerSingleton(SERVICE_TOKENS.WALLET_KEY_MANAGER, () => WalletKeyManager.getInstance('testnet'));
            container.registerSingleton(SERVICE_TOKENS.WALLET_SERVICE, () => WalletService.getInstance('testnet'));

            logger.info('Minimal dependency injection container configured', 'ServiceConfiguration.configureMinimal', {
                totalServices: container.getRegisteredTokens().length
            });

        } catch (error) {
            logger.error('Failed to configure minimal container', 'ServiceConfiguration.configureMinimal', error);
            throw new Error(`Minimal configuration failed: ${error}`);
        }
    }
}

export default ServiceConfiguration;
