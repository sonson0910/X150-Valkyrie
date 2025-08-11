import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorHandler, ErrorType, ErrorSeverity } from './ErrorHandler';

export interface NetworkConfiguration {
    mainnet: {
        blockfrostProjectId: string;
        cardanoscanApiKey?: string;
        adastatApiKey?: string;
    };
    testnet: {
        blockfrostProjectId: string;
        cardanoscanApiKey?: string;
        adastatApiKey?: string;
    };
}

export interface SecurityConfiguration {
    certificatePinning: {
        enabled: boolean;
        strictMode: boolean;
        allowedDomains: string[];
    };
    biometricAuth: {
        enabled: boolean;
        fallbackToPasscode: boolean;
        timeout: number;
    };
    encryption: {
        algorithm: 'AES-256' | 'ChaCha20';
        keyDerivation: 'PBKDF2' | 'Argon2';
        iterations: number;
    };
}

export interface PerformanceConfiguration {
    cache: {
        enabled: boolean;
        defaultTTL: number;
        maxSize: number;
    };
    monitoring: {
        enabled: boolean;
        slowOperationThreshold: number;
        logLevel: 'debug' | 'info' | 'warn' | 'error';
    };
    network: {
        timeout: number;
        retryAttempts: number;
        retryDelay: number;
    };
}

export interface AppConfiguration {
    network: NetworkConfiguration;
    security: SecurityConfiguration;
    performance: PerformanceConfiguration;
    environment: 'development' | 'staging' | 'production';
    version: string;
    buildNumber: string;
    nameService?: {
        mapping?: Record<string, string>;
        remoteResolvers?: string[]; // list of resolver endpoints
        adaHandle?: { enabled: boolean; policyId?: string };
    };
}

export class ConfigurationService {
    private static instance: ConfigurationService;
    private config: AppConfiguration;
    private errorHandler: ErrorHandler;
    private isInitialized = false;

    static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    constructor() {
        this.errorHandler = ErrorHandler.getInstance();
        this.config = this.getDefaultConfiguration();
    }

    /**
     * Initialize configuration service
     */
    async initialize(): Promise<boolean> {
        try {
            if (this.isInitialized) {
                return true;
            }

            // Load configuration from storage
            await this.loadConfiguration();

            // Validate configuration
            this.validateConfiguration();

            // Set up environment-specific overrides
            this.setupEnvironmentOverrides();

            this.isInitialized = true;
            console.log('Configuration service initialized successfully');

            return true;
        } catch (error) {
            this.errorHandler.handleError(
                error as Error,
                'ConfigurationService.initialize',
                ErrorSeverity.HIGH,
                ErrorType.STORAGE
            );
            return false;
        }
    }

    /**
     * Get default configuration
     */
    private getDefaultConfiguration(): AppConfiguration {
        return {
            network: {
                mainnet: {
                    blockfrostProjectId: 'YOUR_MAINNET_PROJECT_ID',
                    cardanoscanApiKey: 'YOUR_CARDANOSCAN_API_KEY',
                    adastatApiKey: 'YOUR_ADASTAT_API_KEY'
                },
                testnet: {
                    blockfrostProjectId: 'YOUR_TESTNET_PROJECT_ID',
                    cardanoscanApiKey: 'YOUR_CARDANOSCAN_TESTNET_API_KEY',
                    adastatApiKey: 'YOUR_ADASTAT_TESTNET_API_KEY'
                }
            },
            security: {
                certificatePinning: {
                    enabled: true,
                    strictMode: true,
                    allowedDomains: ['api.blockfrost.io', 'cardanoscan.io', 'adastat.net']
                },
                biometricAuth: {
                    enabled: true,
                    fallbackToPasscode: true,
                    timeout: 30000
                },
                encryption: {
                    algorithm: 'AES-256',
                    keyDerivation: 'PBKDF2',
                    iterations: 100000
                }
            },
            performance: {
                cache: {
                    enabled: true,
                    defaultTTL: 30000,
                    maxSize: 100
                },
                monitoring: {
                    enabled: true,
                    slowOperationThreshold: 1000,
                    logLevel: 'info'
                },
                network: {
                    timeout: 10000,
                    retryAttempts: 3,
                    retryDelay: 1000
                }
            },
            environment: 'development',
            version: '1.0.0',
            buildNumber: '1',
            nameService: {
                mapping: {},
                remoteResolvers: [],
                adaHandle: { enabled: false }
            }
        };
    }

    /**
     * Load configuration from storage
     */
    private async loadConfiguration(): Promise<void> {
        try {
            const storedConfig = await AsyncStorage.getItem('app_configuration');

            if (storedConfig) {
                const parsedConfig = JSON.parse(storedConfig);
                this.config = { ...this.config, ...parsedConfig };
                console.log('Configuration loaded from storage');
            } else {
                console.log('No stored configuration found, using defaults');
            }
        } catch (error) {
            console.warn('Failed to load configuration from storage:', error);
            // Continue with default configuration
        }
    }

    /**
     * Save configuration to storage
     */
    async saveConfiguration(): Promise<void> {
        try {
            await AsyncStorage.setItem('app_configuration', JSON.stringify(this.config));
            console.log('Configuration saved to storage');
        } catch (error) {
            this.errorHandler.handleError(
                error as Error,
                'ConfigurationService.saveConfiguration',
                ErrorSeverity.MEDIUM,
                ErrorType.STORAGE
            );
        }
    }

    /**
     * Validate configuration
     */
    private validateConfiguration(): void {
        try {
            // Validate required fields
            if (!this.config.network.mainnet.blockfrostProjectId ||
                this.config.network.mainnet.blockfrostProjectId === 'YOUR_MAINNET_PROJECT_ID') {
                console.warn('Mainnet Blockfrost project ID not configured');
            }

            if (!this.config.network.testnet.blockfrostProjectId ||
                this.config.network.testnet.blockfrostProjectId === 'YOUR_TESTNET_PROJECT_ID') {
                console.warn('Testnet Blockfrost project ID not configured');
            }

            // Validate security settings
            if (this.config.security.certificatePinning.enabled &&
                this.config.security.certificatePinning.allowedDomains.length === 0) {
                console.warn('Certificate pinning enabled but no allowed domains configured');
            }

            // Validate performance settings
            if (this.config.performance.cache.maxSize <= 0) {
                console.warn('Invalid cache max size, using default');
                this.config.performance.cache.maxSize = 100;
            }

            console.log('Configuration validation completed');
        } catch (error) {
            console.error('Configuration validation failed:', error);
        }
    }

    /**
     * Setup environment-specific overrides
     */
    private setupEnvironmentOverrides(): void {
        try {
            const env = this.config.environment;

            switch (env) {
                case 'development':
                    this.config.performance.monitoring.logLevel = 'debug';
                    this.config.performance.monitoring.enabled = true;
                    this.config.security.certificatePinning.strictMode = false;
                    break;

                case 'staging':
                    this.config.performance.monitoring.logLevel = 'info';
                    this.config.performance.monitoring.enabled = true;
                    this.config.security.certificatePinning.strictMode = true;
                    break;

                case 'production':
                    this.config.performance.monitoring.logLevel = 'warn';
                    this.config.performance.monitoring.enabled = true;
                    this.config.security.certificatePinning.strictMode = true;
                    this.config.security.biometricAuth.fallbackToPasscode = false;
                    break;
            }

            console.log(`Environment-specific configuration applied for: ${env}`);
        } catch (error) {
            console.error('Failed to setup environment overrides:', error);
        }
    }

    /**
     * Get configuration
     */
    getConfiguration(): AppConfiguration {
        return { ...this.config };
    }

    /**
     * Get network configuration
     */
    getNetworkConfiguration(): NetworkConfiguration {
        return { ...this.config.network };
    }

    /**
     * Get security configuration
     */
    getSecurityConfiguration(): SecurityConfiguration {
        return { ...this.config.security };
    }

    /**
     * Get performance configuration
     */
    getPerformanceConfiguration(): PerformanceConfiguration {
        return { ...this.config.performance };
    }

    /**
     * Update configuration
     */
    async updateConfiguration(updates: Partial<AppConfiguration>): Promise<void> {
        try {
            this.config = { ...this.config, ...updates };

            // Re-validate after updates
            this.validateConfiguration();

            // Save to storage
            await this.saveConfiguration();

            console.log('Configuration updated successfully');
        } catch (error) {
            this.errorHandler.handleError(
                error as Error,
                'ConfigurationService.updateConfiguration',
                ErrorSeverity.MEDIUM,
                ErrorType.STORAGE
            );
            throw error;
        }
    }

    /**
     * Get API key for service
     */
    getApiKey(service: 'blockfrost' | 'cardanoscan' | 'adastat', network: 'mainnet' | 'testnet'): string | undefined {
        try {
            const networkConfig = this.config.network[network];

            switch (service) {
                case 'blockfrost':
                    return networkConfig.blockfrostProjectId;
                case 'cardanoscan':
                    return networkConfig.cardanoscanApiKey;
                case 'adastat':
                    return networkConfig.adastatApiKey;
                default:
                    return undefined;
            }
        } catch (error) {
            console.error(`Failed to get API key for ${service}:`, error);
            return undefined;
        }
    }

    /**
     * Set API key for service
     */
    async setApiKey(service: 'blockfrost' | 'cardanoscan' | 'adastat', network: 'mainnet' | 'testnet', apiKey: string): Promise<void> {
        try {
            const networkConfig = this.config.network[network];

            switch (service) {
                case 'blockfrost':
                    networkConfig.blockfrostProjectId = apiKey;
                    break;
                case 'cardanoscan':
                    networkConfig.cardanoscanApiKey = apiKey;
                    break;
                case 'adastat':
                    networkConfig.adastatApiKey = apiKey;
                    break;
            }

            await this.saveConfiguration();
            console.log(`API key updated for ${service} on ${network}`);
        } catch (error) {
            this.errorHandler.handleError(
                error as Error,
                'ConfigurationService.setApiKey',
                ErrorSeverity.MEDIUM,
                ErrorType.STORAGE
            );
            throw error;
        }
    }

    /**
     * Reset configuration to defaults
     */
    async resetToDefaults(): Promise<void> {
        try {
            this.config = this.getDefaultConfiguration();
            await this.saveConfiguration();
            console.log('Configuration reset to defaults');
        } catch (error) {
            this.errorHandler.handleError(
                error as Error,
                'ConfigurationService.resetToDefaults',
                ErrorSeverity.MEDIUM,
                ErrorType.STORAGE
            );
            throw error;
        }
    }

    /**
     * Export configuration
     */
    exportConfiguration(): string {
        try {
            return JSON.stringify(this.config, null, 2);
        } catch (error) {
            console.error('Failed to export configuration:', error);
            return '';
        }
    }

    /**
     * Import configuration
     */
    async importConfiguration(configJson: string): Promise<boolean> {
        try {
            const importedConfig = JSON.parse(configJson);

            // Validate imported configuration
            if (!this.isValidConfiguration(importedConfig)) {
                throw new Error('Invalid configuration format');
            }

            this.config = { ...this.config, ...importedConfig };
            await this.saveConfiguration();

            console.log('Configuration imported successfully');
            return true;
        } catch (error) {
            this.errorHandler.handleError(
                error as Error,
                'ConfigurationService.importConfiguration',
                ErrorSeverity.MEDIUM,
                ErrorType.STORAGE
            );
            return false;
        }
    }

    /**
     * Validate configuration format
     */
    private isValidConfiguration(config: any): boolean {
        try {
            // Basic validation
            return config &&
                typeof config === 'object' &&
                config.network &&
                config.security &&
                config.performance &&
                config.environment &&
                config.version;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get configuration statistics
     */
    getConfigurationStats(): {
        totalSettings: number;
        configuredApis: number;
        securityFeatures: number;
        performanceSettings: number;
    } {
        try {
            const networkConfig = this.config.network;
            const securityConfig = this.config.security;
            const performanceConfig = this.config.performance;

            const configuredApis = [
                networkConfig.mainnet.blockfrostProjectId,
                networkConfig.mainnet.cardanoscanApiKey,
                networkConfig.mainnet.adastatApiKey,
                networkConfig.testnet.blockfrostProjectId,
                networkConfig.testnet.cardanoscanApiKey,
                networkConfig.testnet.adastatApiKey
            ].filter(key => key && key !== 'YOUR_MAINNET_PROJECT_ID' && key !== 'YOUR_TESTNET_PROJECT_ID').length;

            const securityFeatures = [
                securityConfig.certificatePinning.enabled,
                securityConfig.biometricAuth.enabled,
                securityConfig.encryption.algorithm !== 'AES-256'
            ].filter(Boolean).length;

            const performanceSettings = [
                performanceConfig.cache.enabled,
                performanceConfig.monitoring.enabled,
                performanceConfig.network.timeout !== 10000
            ].filter(Boolean).length;

            return {
                totalSettings: Object.keys(this.config).length,
                configuredApis: configuredApis,
                securityFeatures: securityFeatures,
                performanceSettings: performanceSettings
            };
        } catch (error) {
            console.error('Failed to get configuration stats:', error);
            return {
                totalSettings: 0,
                configuredApis: 0,
                securityFeatures: 0,
                performanceSettings: 0
            };
        }
    }

    /**
     * Lấy setting theo key
     */
    getSetting(key: string): any {
        return (this.config as any)[key];
    }

    /**
     * Set setting theo key
     */
    setSetting(key: string, value: any): void {
        (this.config as any)[key] = value;
        this.saveConfiguration();
    }

    /**
     * Lấy security setting
     */
    getSecuritySetting(key: string): any {
        return (this.config.security as any)[key];
    }

    /**
     * Set security setting
     */
    setSecuritySetting(key: string, value: any): void {
        (this.config.security as any)[key] = value;
        this.saveConfiguration();
    }
}
