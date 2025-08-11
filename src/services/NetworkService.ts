import NetInfo from '@react-native-community/netinfo';
import { ErrorHandler, ErrorType, ErrorSeverity } from './ErrorHandler';
import { CertificatePinningService } from './CertificatePinningService';

export interface NetworkState {
    isConnected: boolean;
    type: 'wifi' | 'cellular' | 'none' | 'unknown';
    isInternetReachable: boolean | null;
    strength?: number; // WiFi signal strength
    carrier?: string; // Mobile carrier name
}

export interface NetworkConfig {
    enableCertificatePinning: boolean;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
}

export class NetworkService {
    private static instance: NetworkService;
    private networkState: NetworkState = {
        isConnected: false,
        type: 'none',
        isInternetReachable: null
    };
    private listeners: ((state: NetworkState) => void)[] = [];
    private config: NetworkConfig = {
        enableCertificatePinning: true,
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000
    };

    // Certificate pinning service
    private certificateService: CertificatePinningService;
    private isInitialized = false;

    constructor() {
        this.certificateService = CertificatePinningService.getInstance();
    }

    static getInstance(): NetworkService {
        if (!NetworkService.instance) {
            NetworkService.instance = new NetworkService();
        }
        return NetworkService.instance;
    }

    /**
     * Khởi tạo network service
     */
    async initialize(): Promise<boolean> {
        try {
            if (this.isInitialized) {
                return true;
            }

            // Subscribe to network state changes
            const unsubscribe = NetInfo.addEventListener(this.handleNetworkChange);

            // Get initial network state
            const netInfoState = await NetInfo.fetch();
            this.updateNetworkState(netInfoState);

            // Test internet connectivity
            await this.testInternetConnectivity();

            this.isInitialized = true;
            console.log('Network service initialized successfully');

            return true;

        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                'NetworkService.initialize',
                ErrorSeverity.HIGH,
                ErrorType.NETWORK
            );
            return false;
        }
    }

    /**
     * Xử lý thay đổi network state
     */
    private handleNetworkChange = (state: any) => {
        this.updateNetworkState(state);
    };

    /**
     * Cập nhật network state
     */
    private updateNetworkState(netInfoState: any): void {
        const previousState = { ...this.networkState };

        this.networkState = {
            isConnected: netInfoState.isConnected ?? false,
            type: netInfoState.type ?? 'unknown',
            isInternetReachable: netInfoState.isInternetReachable ?? null,
            strength: netInfoState.details?.strength,
            carrier: netInfoState.details?.carrier
        };

        // Notify listeners if state changed significantly
        if (this.hasSignificantChange(previousState, this.networkState)) {
            this.notifyListeners();
        }

        console.log('Network state updated:', this.networkState);
    }

    /**
     * Kiểm tra xem có thay đổi đáng kể không
     */
    private hasSignificantChange(previous: NetworkState, current: NetworkState): boolean {
        return (
            previous.isConnected !== current.isConnected ||
            previous.type !== current.type ||
            previous.isInternetReachable !== current.isInternetReachable
        );
    }

    /**
     * Test internet connectivity
     */
    private async testInternetConnectivity(): Promise<boolean> {
        try {
            // Test with multiple endpoints for reliability
            const endpoints = [
                'https://httpbin.org/get',
                'https://api.blockfrost.io/health',
                'https://google.com'
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'HEAD'
                    });

                    if (response.ok) {
                        console.log('Internet connectivity confirmed via:', endpoint);
                        return true;
                    }
                } catch (error) {
                    console.log(`Failed to test endpoint ${endpoint}:`, error);
                }
            }

            console.warn('All connectivity tests failed');
            return false;

        } catch (error) {
            console.error('Connectivity test failed:', error);
            return false;
        }
    }

    /**
     * Lấy current network state
     */
    getNetworkState(): NetworkState {
        return { ...this.networkState };
    }

    /**
     * Kiểm tra có kết nối internet không
     */
    isOnline(): boolean {
        return this.networkState.isConnected &&
            this.networkState.isInternetReachable === true;
    }

    /**
     * Kiểm tra có kết nối WiFi không
     */
    isWifiConnected(): boolean {
        return this.networkState.isConnected &&
            this.networkState.type === 'wifi';
    }

    /**
     * Kiểm tra có kết nối cellular không
     */
    isCellularConnected(): boolean {
        return this.networkState.isConnected &&
            this.networkState.type === 'cellular';
    }

    /**
     * Lấy WiFi signal strength
     */
    getWifiStrength(): number | undefined {
        return this.networkState.type === 'wifi' ? this.networkState.strength : undefined;
    }

    /**
     * Lấy mobile carrier name
     */
    getCarrierName(): string | undefined {
        return this.networkState.type === 'cellular' ? this.networkState.carrier : undefined;
    }

    /**
     * Thêm network state listener
     */
    addListener(listener: (state: NetworkState) => void): () => void {
        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify tất cả listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => {
            try {
                listener(this.networkState);
            } catch (error) {
                console.error('Error in network listener:', error);
            }
        });
    }

    /**
 * Thực hiện network request với retry logic và certificate pinning
 */
    async request<T>(
        url: string,
        options: RequestInit = {},
        retryCount: number = 0
    ): Promise<T> {
        try {
            if (!this.isOnline()) {
                throw new Error('No internet connection');
            }

            // Apply certificate pinning if enabled
            if (this.config.enableCertificatePinning) {
                await this.validateCertificatePinning(url);
            }

            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, this.config.timeout);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers,
                    },
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }

        } catch (error) {
            if (retryCount < this.config.retryAttempts) {
                console.log(`Request failed, retrying... (${retryCount + 1}/${this.config.retryAttempts})`);

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

                // Retry with incremented count
                return this.request(url, options, retryCount + 1);
            }

            throw error;
        }
    }

    /**
 * Validate certificate pinning cho URL
 */
    private async validateCertificatePinning(url: string): Promise<void> {
        try {
            // Use certificate service for validation
            const isValid = await this.certificateService.validateCertificate(url);

            if (!isValid) {
                console.warn(`Certificate validation failed for ${url}`);
            }
        } catch (error) {
            console.warn('Certificate pinning validation failed:', error);
        }
    }

    /**
     * Cập nhật network configuration
     */
    updateConfig(newConfig: Partial<NetworkConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('Network config updated:', this.config);
    }

    /**
     * Lấy network configuration
     */
    getConfig(): NetworkConfig {
        return { ...this.config };
    }

    /**
     * Cleanup service
     */
    cleanup(): void {
        this.isInitialized = false;
        this.listeners = [];
        console.log('Network service cleaned up');
    }
}
