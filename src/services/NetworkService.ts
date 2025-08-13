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
        enableCertificatePinning: false,
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000
    };

    // Certificate pinning service
    private certificateService: CertificatePinningService;
    private isInitialized = false;
    // Optional RN SSL pinning fetch
    private rnSslFetch: any | null = null;

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
            // Try to load react-native-ssl-pinning fetch when running native
            try {
                // @ts-ignore dynamic require
                const rnSsl = require('react-native-ssl-pinning');
                if (rnSsl && rnSsl.fetch) {
                    this.rnSslFetch = rnSsl.fetch;
                    console.log('react-native-ssl-pinning detected and will be used when enabled');
                }
            } catch {}
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
                const { headers: optionHeaders, ...restOptions } = options;

                const mergedHeaders: Record<string, any> = {
                    ...(optionHeaders || {}),
                };

                // Set default Content-Type only when sending a body and header is not provided
                if ((restOptions as any).body && !('Content-Type' in mergedHeaders)) {
                    mergedHeaders['Content-Type'] = 'application/json';
                }

                const response = await this.performFetch(url, restOptions as any, mergedHeaders, controller.signal);

                clearTimeout(timeoutId);

                if (!response.ok) {
                    let msg = response.statusText;
                    try { const j = await response.json(); if (j?.message) msg = j.message; } catch {}
                    throw new Error(`HTTP ${response.status}: ${msg}`);
                }

                // Parse theo content-type
                const ct = response.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    return await response.json();
                }
                if (ct.includes('text/') || ct === '') {
                    return (await response.text()) as unknown as T;
                }
                // Binary (e.g., CBOR) return ArrayBuffer
                return (await response.arrayBuffer()) as unknown as T;
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
     * Thực hiện fetch, ưu tiên dùng react-native-ssl-pinning nếu khả dụng và pinning bật
     */
    private async performFetch(url: string, options: any, headers: Record<string, any>, signal?: AbortSignal): Promise<Response> {
        // Use RN SSL pinning fetch when available and enabled
        const usePinned = this.config.enableCertificatePinning && this.rnSslFetch;
        if (usePinned) {
            try {
                // Resolve native cert aliases for host
                const hostname = this.extractHostname(url);
                const aliases = CertificatePinningService.getInstance().getAliasesForHost(hostname);
                const res = await this.rnSslFetch(url, {
                    method: options.method ?? 'GET',
                    headers,
                    body: options.body,
                    timeoutInterval: Math.ceil(this.config.timeout / 1000),
                    sslPinning: {
                        // Cert aliases must be provided by native assets configuration
                        certs: aliases,
                    },
                });
                // Map RN SSL response to Response-like
                const textBody = res.bodyString ?? '';
                const status = res.status || 200;
                const ok = status >= 200 && status < 300;
                const contentType = this.findHeader(res.headers, 'content-type') || '';
                const responseLike: Response = {
                    ok,
                    status,
                    statusText: ok ? 'OK' : 'Error',
                    headers: new Headers(Object.entries(res.headers || {}).map(([k, v]) => [String(k), String(v)])),
                    url,
                    redirected: false,
                    type: 'basic',
                    body: null as any,
                    bodyUsed: false,
                    clone: function (): Response { throw new Error('Not implemented'); },
                    arrayBuffer: async function (): Promise<ArrayBuffer> {
                        const encoder = new TextEncoder();
                        const u8 = encoder.encode(textBody);
                        return u8.buffer;
                    },
                    blob: async function (): Promise<Blob> { throw new Error('Not implemented'); },
                    formData: async function (): Promise<FormData> { throw new Error('Not implemented'); },
                    json: async function (): Promise<any> { return textBody ? JSON.parse(textBody) : {}; },
                    text: async function (): Promise<string> { return textBody; },
                } as unknown as Response;
                return responseLike;
            } catch (e) {
                console.warn('Pinned fetch failed, falling back to standard fetch:', e);
            }
        }
        // Standard fetch fallback
        return await fetch(url, {
            signal,
            ...options,
            method: options.method ?? 'GET',
            headers,
        });
    }

    private findHeader(headersObj: any, key: string): string | undefined {
        if (!headersObj) return undefined;
        const entry = Object.entries(headersObj).find(([k]) => String(k).toLowerCase() === key.toLowerCase());
        return entry ? String(entry[1]) : undefined;
    }

    private extractHostname(url: string): string {
        try {
            return new URL(url).hostname;
        } catch (error) {
            const match = url.match(/^https?:\/\/([^\/]+)/);
            return match ? match[1] : url;
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
