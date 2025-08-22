import logger from '../../utils/Logger';
import { BLUETOOTH_CONSTANTS } from '../../constants/index';

// BLE Manager interface for type safety
export interface BLEManager {
    state(): Promise<string>;
    requestPermissions(): Promise<boolean>;
    canAdvertise(): Promise<boolean>;
    startAdvertising(options: any): Promise<void>;
    stopAdvertising(): Promise<void>;
    startDeviceScan(uuids: string[] | null, options: any, callback: (error: any, device: any) => void): Promise<void>;
    stopDeviceScan(): Promise<void>;
    connectToDevice(deviceId: string, options?: any): Promise<any>;
    stopMonitoringCharacteristicForService(serviceUUID: string, characteristicUUID: string): Promise<void>;
}

// BLE Device interface
export interface BLEDevice {
    discoverAllServicesAndCharacteristics(): Promise<void>;
    services(): Promise<any[]>;
    characteristicsForService(serviceUUID: string): Promise<any[]>;
    writeCharacteristicWithResponseForService(serviceUUID: string, characteristicUUID: string, data: Uint8Array): Promise<void>;
    cancelConnection(): Promise<void>;
}

/**
 * BLEDeviceManager - Manages BLE hardware, scanning, advertising, and permissions
 * 
 * Responsibilities:
 * - Initialize and manage BLE manager
 * - Handle Bluetooth permissions and state
 * - Manage device scanning and discovery
 * - Handle advertising for merchant mode
 * - Create mock implementations for development
 */
export class BLEDeviceManager {
    private static instance: BLEDeviceManager;
    private bleManager: BLEManager | null = null;
    private isScanning: boolean = false;
    private isAdvertising: boolean = false;
    private discoveredDevices: Map<string, any> = new Map();

    private constructor() {}

    public static getInstance(): BLEDeviceManager {
        if (!BLEDeviceManager.instance) {
            BLEDeviceManager.instance = new BLEDeviceManager();
        }
        return BLEDeviceManager.instance;
    }

    /**
     * Initialize BLE manager
     * @returns Success status
     */
    async initialize(): Promise<boolean> {
        try {
            logger.debug('Initializing BLE device manager', 'BLEDeviceManager.initialize');

            // Try to initialize real BLE manager
            try {
                // @ts-ignore dynamic require to avoid breaking web
                const ble = require('react-native-ble-plx');
                if (ble && ble.BleManager) {
                    this.bleManager = new ble.BleManager();
                    logger.info('React Native BLE PLX initialized', 'BLEDeviceManager.initialize');
                    return true;
                }
            } catch (error) {
                logger.warn('React Native BLE PLX not available, using mock', 'BLEDeviceManager.initialize', error);
            }

            // Fallback to mock for development/web
            this.bleManager = this.createMockBLEManager();
            logger.info('Mock BLE manager created for development', 'BLEDeviceManager.initialize');
            
            return true;

        } catch (error) {
            logger.error('Failed to initialize BLE device manager', 'BLEDeviceManager.initialize', error);
            return false;
        }
    }

    /**
     * Check Bluetooth status and permissions
     * @returns Bluetooth capabilities
     */
    async checkBluetoothStatus(): Promise<{
        isEnabled: boolean;
        hasPermission: boolean;
        canAdvertise: boolean;
    }> {
        try {
            if (!this.bleManager) {
                return { isEnabled: false, hasPermission: false, canAdvertise: false };
            }

            const state = await this.bleManager.state();
            const isEnabled = state === 'PoweredOn';
            
            let hasPermission = false;
            let canAdvertise = false;

            if (isEnabled) {
                try {
                    hasPermission = await this.bleManager.requestPermissions();
                    canAdvertise = await this.bleManager.canAdvertise();
                } catch (error) {
                    logger.warn('Failed to check BLE permissions', 'BLEDeviceManager.checkBluetoothStatus', error);
                }
            }

            const status = { isEnabled, hasPermission, canAdvertise };
            logger.debug('Bluetooth status checked', 'BLEDeviceManager.checkBluetoothStatus', status);
            
            return status;

        } catch (error) {
            logger.error('Failed to check Bluetooth status', 'BLEDeviceManager.checkBluetoothStatus', error);
            return { isEnabled: false, hasPermission: false, canAdvertise: false };
        }
    }

    /**
     * Start scanning for devices
     * @param onDeviceFound - Callback when device is discovered
     * @param timeout - Scan timeout in ms
     * @returns Success status
     */
    async startScanning(
        onDeviceFound: (device: any) => void,
        timeout: number = BLUETOOTH_CONSTANTS.DISCOVERY_TIMEOUT
    ): Promise<boolean> {
        try {
            if (!this.bleManager) {
                throw new Error('BLE manager not initialized');
            }

            if (this.isScanning) {
                logger.warn('Already scanning for devices', 'BLEDeviceManager.startScanning');
                return true;
            }

            logger.debug('Starting BLE device scan', 'BLEDeviceManager.startScanning', { timeout });

            this.isScanning = true;
            this.discoveredDevices.clear();

            await this.bleManager.startDeviceScan(
                [BLUETOOTH_CONSTANTS.SERVICE_UUID],
                { allowDuplicates: false },
                (error: any, device: any) => {
                    this.handleDeviceDiscovery(error, device, onDeviceFound);
                }
            );

            // Auto-stop scanning after timeout
            setTimeout(async () => {
                if (this.isScanning) {
                    await this.stopScanning();
                }
            }, timeout);

            logger.info('BLE device scanning started', 'BLEDeviceManager.startScanning');
            return true;

        } catch (error) {
            logger.error('Failed to start BLE scanning', 'BLEDeviceManager.startScanning', error);
            this.isScanning = false;
            return false;
        }
    }

    /**
     * Stop scanning for devices
     * @returns Success status
     */
    async stopScanning(): Promise<boolean> {
        try {
            if (!this.bleManager || !this.isScanning) {
                return true;
            }

            await this.bleManager.stopDeviceScan();
            this.isScanning = false;

            logger.info('BLE device scanning stopped', 'BLEDeviceManager.stopScanning', {
                devicesFound: this.discoveredDevices.size
            });

            return true;

        } catch (error) {
            logger.error('Failed to stop BLE scanning', 'BLEDeviceManager.stopScanning', error);
            return false;
        }
    }

    /**
     * Start advertising (merchant mode)
     * @returns Success status
     */
    async startAdvertising(): Promise<boolean> {
        try {
            if (!this.bleManager) {
                throw new Error('BLE manager not initialized');
            }

            if (this.isAdvertising) {
                logger.warn('Already advertising', 'BLEDeviceManager.startAdvertising');
                return true;
            }

            const advertisingOptions = {
                serviceUUID: BLUETOOTH_CONSTANTS.SERVICE_UUID,
                localName: 'Valkyrie-Merchant',
                includeDeviceName: true,
                includeTxPowerLevel: true
            };

            await this.bleManager.startAdvertising(advertisingOptions);
            this.isAdvertising = true;

            logger.info('BLE advertising started', 'BLEDeviceManager.startAdvertising', advertisingOptions);
            return true;

        } catch (error) {
            logger.error('Failed to start BLE advertising', 'BLEDeviceManager.startAdvertising', error);
            return false;
        }
    }

    /**
     * Stop advertising
     * @returns Success status
     */
    async stopAdvertising(): Promise<boolean> {
        try {
            if (!this.bleManager || !this.isAdvertising) {
                return true;
            }

            await this.bleManager.stopAdvertising();
            this.isAdvertising = false;

            logger.info('BLE advertising stopped', 'BLEDeviceManager.stopAdvertising');
            return true;

        } catch (error) {
            logger.error('Failed to stop BLE advertising', 'BLEDeviceManager.stopAdvertising', error);
            return false;
        }
    }

    /**
     * Get discovered devices
     * @returns Array of discovered devices
     */
    getDiscoveredDevices(): any[] {
        return Array.from(this.discoveredDevices.values());
    }

    /**
     * Get BLE manager instance
     * @returns BLE manager or null
     */
    getBLEManager(): BLEManager | null {
        return this.bleManager;
    }

    /**
     * Check if currently scanning
     */
    isCurrentlyScanning(): boolean {
        return this.isScanning;
    }

    /**
     * Check if currently advertising
     */
    isCurrentlyAdvertising(): boolean {
        return this.isAdvertising;
    }

    /**
     * Cleanup BLE device manager
     */
    async cleanup(): Promise<void> {
        try {
            await this.stopScanning();
            await this.stopAdvertising();
            this.discoveredDevices.clear();
            
            logger.info('BLE device manager cleaned up', 'BLEDeviceManager.cleanup');
        } catch (error) {
            logger.error('Failed to cleanup BLE device manager', 'BLEDeviceManager.cleanup', error);
        }
    }

    // Private helper methods

    /**
     * Handle device discovery during scanning
     */
    private handleDeviceDiscovery(error: any, device: any, onDeviceFound: (device: any) => void): void {
        if (error) {
            logger.error('Device discovery error', 'BLEDeviceManager.handleDeviceDiscovery', error);
            return;
        }

        if (device && device.id) {
            // Check if device is already discovered
            if (this.discoveredDevices.has(device.id)) {
                return;
            }

            // Filter devices by service UUID if needed
            if (device.serviceUUIDs && !device.serviceUUIDs.includes(BLUETOOTH_CONSTANTS.SERVICE_UUID)) {
                return;
            }

            this.discoveredDevices.set(device.id, device);
            
            logger.debug('New device discovered', 'BLEDeviceManager.handleDeviceDiscovery', {
                id: device.id,
                name: device.name || 'Unknown',
                rssi: device.rssi
            });

            onDeviceFound(device);
        }
    }

    /**
     * Create mock BLE manager for development
     */
    private createMockBLEManager(): BLEManager {
        return {
            state: async () => {
                logger.debug('Mock BLE state check', 'BLEDeviceManager.createMockBLEManager');
                return 'PoweredOn';
            },
            requestPermissions: async () => {
                logger.debug('Mock BLE permissions requested', 'BLEDeviceManager.createMockBLEManager');
                return true;
            },
            canAdvertise: async () => {
                logger.debug('Mock BLE advertising capability checked', 'BLEDeviceManager.createMockBLEManager');
                return true;
            },
            startAdvertising: async (options: any) => {
                logger.debug('Mock BLE advertising started', 'BLEDeviceManager.createMockBLEManager', options);
            },
            stopAdvertising: async () => {
                logger.debug('Mock BLE advertising stopped', 'BLEDeviceManager.createMockBLEManager');
            },
            startDeviceScan: async (uuids: string[] | null, options: any, callback: (error: any, device: any) => void) => {
                logger.debug('Mock BLE scanning started', 'BLEDeviceManager.createMockBLEManager', { uuids, options });
                
                // Simulate device discovery after a delay
                setTimeout(() => {
                    const mockDevice = {
                        id: 'mock-merchant-device',
                        name: 'Mock Merchant',
                        rssi: -50,
                        serviceUUIDs: [BLUETOOTH_CONSTANTS.SERVICE_UUID]
                    };
                    callback(null, mockDevice);
                }, 1000);
            },
            stopDeviceScan: async () => {
                logger.debug('Mock BLE scanning stopped', 'BLEDeviceManager.createMockBLEManager');
            },
            connectToDevice: async (deviceId: string, options?: any) => {
                logger.debug('Mock BLE device connection', 'BLEDeviceManager.createMockBLEManager', { deviceId, options });
                return this.createMockBLEDevice(deviceId);
            },
            stopMonitoringCharacteristicForService: async (serviceUUID: string, characteristicUUID: string) => {
                logger.debug('Mock BLE monitoring stopped', 'BLEDeviceManager.createMockBLEManager', {
                    serviceUUID,
                    characteristicUUID
                });
            }
        };
    }

    /**
     * Create mock BLE device for development
     */
    private createMockBLEDevice(deviceId: string): BLEDevice {
        return {
            discoverAllServicesAndCharacteristics: async () => {
                logger.debug('Mock BLE discovery completed', 'BLEDeviceManager.createMockBLEDevice', { deviceId });
            },
            services: async () => {
                logger.debug('Mock BLE services queried', 'BLEDeviceManager.createMockBLEDevice', { deviceId });
                return [];
            },
            characteristicsForService: async (serviceUUID: string) => {
                logger.debug('Mock BLE characteristics queried', 'BLEDeviceManager.createMockBLEDevice', {
                    deviceId,
                    serviceUUID
                });
                return [];
            },
            writeCharacteristicWithResponseForService: async (serviceUUID: string, characteristicUUID: string, data: Uint8Array) => {
                logger.debug('Mock BLE write completed', 'BLEDeviceManager.createMockBLEDevice', {
                    deviceId,
                    serviceUUID,
                    characteristicUUID,
                    dataLength: data.length
                });
            },
            cancelConnection: async () => {
                logger.debug('Mock BLE disconnection completed', 'BLEDeviceManager.createMockBLEDevice', { deviceId });
            }
        };
    }
}

export default BLEDeviceManager;

