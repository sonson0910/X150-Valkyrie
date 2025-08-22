import logger from '../../utils/Logger';
import { BLUETOOTH_CONSTANTS } from '../../constants/index';
import BLEDeviceManager, { BLEDevice, BLEManager } from './BLEDeviceManager';

/**
 * BLEConnectionManager - Manages BLE device connections
 * 
 * Responsibilities:
 * - Connect and disconnect BLE devices
 * - Manage active connections
 * - Handle connection state monitoring
 * - Service and characteristic discovery
 * - Connection timeout and retry logic
 */
export class BLEConnectionManager {
    private static instance: BLEConnectionManager;
    private deviceManager: BLEDeviceManager;
    private connectedDevices: Map<string, BLEDevice> = new Map();
    private connectionAttempts: Map<string, number> = new Map();
    private connectionCallbacks: Map<string, {
        resolve: (device: BLEDevice) => void;
        reject: (error: Error) => void;
    }> = new Map();

    private constructor() {
        this.deviceManager = BLEDeviceManager.getInstance();
    }

    public static getInstance(): BLEConnectionManager {
        if (!BLEConnectionManager.instance) {
            BLEConnectionManager.instance = new BLEConnectionManager();
        }
        return BLEConnectionManager.instance;
    }

    /**
     * Connect to a BLE device
     * @param deviceId - Device ID to connect to
     * @param timeout - Connection timeout in ms
     * @returns Connected device
     */
    async connectToDevice(deviceId: string, timeout: number = BLUETOOTH_CONSTANTS.CONNECTION_TIMEOUT): Promise<BLEDevice> {
        try {
            // Check if already connected
            if (this.connectedDevices.has(deviceId)) {
                logger.debug('Device already connected', 'BLEConnectionManager.connectToDevice', { deviceId });
                return this.connectedDevices.get(deviceId)!;
            }

            // Check if connection attempt is in progress
            if (this.connectionCallbacks.has(deviceId)) {
                throw new Error(`Connection to ${deviceId} already in progress`);
            }

            const bleManager = this.deviceManager.getBLEManager();
            if (!bleManager) {
                throw new Error('BLE manager not initialized');
            }

            logger.debug('Attempting to connect to device', 'BLEConnectionManager.connectToDevice', { deviceId, timeout });

            // Set up connection promise with timeout
            const connectionPromise = this.createConnectionPromise(deviceId, timeout);

            // Track connection attempts
            const attempts = this.connectionAttempts.get(deviceId) || 0;
            this.connectionAttempts.set(deviceId, attempts + 1);

            try {
                // Attempt connection
                const device = await bleManager.connectToDevice(deviceId, {
                    requestMTU: 512,
                    refreshGattOnConnection: true,
                    timeout: timeout
                });

                // Discover services and characteristics
                await device.discoverAllServicesAndCharacteristics();

                // Verify required service exists
                await this.verifyRequiredServices(device);

                // Store connected device
                this.connectedDevices.set(deviceId, device);
                this.connectionAttempts.delete(deviceId);

                // Resolve connection promise
                const callbacks = this.connectionCallbacks.get(deviceId);
                if (callbacks) {
                    callbacks.resolve(device);
                    this.connectionCallbacks.delete(deviceId);
                }

                logger.info('Successfully connected to device', 'BLEConnectionManager.connectToDevice', {
                    deviceId,
                    attempts: attempts + 1
                });

                return device;

            } catch (connectionError) {
                this.connectionCallbacks.delete(deviceId);
                
                // Handle retry logic
                if (attempts < 3) {
                    logger.warn(`Connection attempt ${attempts + 1} failed, retrying`, 'BLEConnectionManager.connectToDevice', {
                        deviceId,
                        error: connectionError
                    });
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await this.connectToDevice(deviceId, timeout);
                } else {
                    this.connectionAttempts.delete(deviceId);
                    throw new Error(`Failed to connect to device ${deviceId} after ${attempts + 1} attempts: ${connectionError}`);
                }
            }

            return await connectionPromise;

        } catch (error) {
            logger.error('Failed to connect to device', 'BLEConnectionManager.connectToDevice', {
                deviceId,
                error
            });
            this.connectionCallbacks.delete(deviceId);
            throw error;
        }
    }

    /**
     * Disconnect from a BLE device
     * @param deviceId - Device ID to disconnect from
     * @returns Success status
     */
    async disconnectDevice(deviceId: string): Promise<boolean> {
        try {
            const device = this.connectedDevices.get(deviceId);
            if (!device) {
                logger.debug('Device not connected', 'BLEConnectionManager.disconnectDevice', { deviceId });
                return true;
            }

            logger.debug('Disconnecting from device', 'BLEConnectionManager.disconnectDevice', { deviceId });

            try {
                await device.cancelConnection();
            } catch (disconnectError) {
                logger.warn('Error during device disconnection', 'BLEConnectionManager.disconnectDevice', {
                    deviceId,
                    error: disconnectError
                });
            }

            // Remove from connected devices
            this.connectedDevices.delete(deviceId);
            this.connectionAttempts.delete(deviceId);

            // Cancel any pending connection callbacks
            const callbacks = this.connectionCallbacks.get(deviceId);
            if (callbacks) {
                callbacks.reject(new Error('Connection cancelled'));
                this.connectionCallbacks.delete(deviceId);
            }

            logger.info('Successfully disconnected from device', 'BLEConnectionManager.disconnectDevice', { deviceId });
            return true;

        } catch (error) {
            logger.error('Failed to disconnect from device', 'BLEConnectionManager.disconnectDevice', {
                deviceId,
                error
            });
            return false;
        }
    }

    /**
     * Disconnect from all connected devices
     * @returns Success status
     */
    async disconnectAllDevices(): Promise<boolean> {
        try {
            const deviceIds = Array.from(this.connectedDevices.keys());
            
            logger.debug('Disconnecting from all devices', 'BLEConnectionManager.disconnectAllDevices', {
                deviceCount: deviceIds.length
            });

            const disconnectPromises = deviceIds.map(deviceId => this.disconnectDevice(deviceId));
            await Promise.all(disconnectPromises);

            logger.info('Successfully disconnected from all devices', 'BLEConnectionManager.disconnectAllDevices');
            return true;

        } catch (error) {
            logger.error('Failed to disconnect from all devices', 'BLEConnectionManager.disconnectAllDevices', error);
            return false;
        }
    }

    /**
     * Get connected device by ID
     * @param deviceId - Device ID
     * @returns Connected device or null
     */
    getConnectedDevice(deviceId: string): BLEDevice | null {
        return this.connectedDevices.get(deviceId) || null;
    }

    /**
     * Get all connected devices
     * @returns Array of connected device info
     */
    getConnectedDevices(): Array<{ deviceId: string; device: BLEDevice }> {
        return Array.from(this.connectedDevices.entries()).map(([deviceId, device]) => ({
            deviceId,
            device
        }));
    }

    /**
     * Check if device is connected
     * @param deviceId - Device ID
     * @returns Connection status
     */
    isDeviceConnected(deviceId: string): boolean {
        return this.connectedDevices.has(deviceId);
    }

    /**
     * Get connection count
     * @returns Number of connected devices
     */
    getConnectionCount(): number {
        return this.connectedDevices.size;
    }

    /**
     * Check connection health for a device
     * @param deviceId - Device ID
     * @returns Connection health status
     */
    async checkConnectionHealth(deviceId: string): Promise<{
        isConnected: boolean;
        hasRequiredServices: boolean;
        canWrite: boolean;
    }> {
        try {
            const device = this.connectedDevices.get(deviceId);
            if (!device) {
                return { isConnected: false, hasRequiredServices: false, canWrite: false };
            }

            let hasRequiredServices = false;
            let canWrite = false;

            try {
                // Check if required services are available
                const services = await device.services();
                hasRequiredServices = services.some(service => 
                    service.uuid.toLowerCase() === BLUETOOTH_CONSTANTS.SERVICE_UUID.toLowerCase()
                );

                // Check if we can write to the transaction characteristic
                if (hasRequiredServices) {
                    const characteristics = await device.characteristicsForService(BLUETOOTH_CONSTANTS.SERVICE_UUID);
                    canWrite = characteristics.some(char => 
                        char.uuid.toLowerCase() === BLUETOOTH_CONSTANTS.TX_CHARACTERISTIC_UUID.toLowerCase()
                    );
                }
            } catch (error) {
                logger.warn('Error checking connection health', 'BLEConnectionManager.checkConnectionHealth', {
                    deviceId,
                    error
                });
            }

            const health = {
                isConnected: true,
                hasRequiredServices,
                canWrite
            };

            logger.debug('Connection health checked', 'BLEConnectionManager.checkConnectionHealth', {
                deviceId,
                health
            });

            return health;

        } catch (error) {
            logger.error('Failed to check connection health', 'BLEConnectionManager.checkConnectionHealth', {
                deviceId,
                error
            });
            return { isConnected: false, hasRequiredServices: false, canWrite: false };
        }
    }

    /**
     * Cleanup connection manager
     */
    async cleanup(): Promise<void> {
        try {
            // Cancel all pending connection callbacks
            for (const [deviceId, callbacks] of this.connectionCallbacks.entries()) {
                callbacks.reject(new Error('Connection manager cleanup'));
            }
            this.connectionCallbacks.clear();

            // Disconnect all devices
            await this.disconnectAllDevices();

            // Clear connection attempts
            this.connectionAttempts.clear();

            logger.info('BLE connection manager cleaned up', 'BLEConnectionManager.cleanup');

        } catch (error) {
            logger.error('Failed to cleanup BLE connection manager', 'BLEConnectionManager.cleanup', error);
        }
    }

    // Private helper methods

    /**
     * Create connection promise with timeout
     */
    private createConnectionPromise(deviceId: string, timeout: number): Promise<BLEDevice> {
        return new Promise<BLEDevice>((resolve, reject) => {
            // Store callbacks
            this.connectionCallbacks.set(deviceId, { resolve, reject });

            // Set timeout
            setTimeout(() => {
                const callbacks = this.connectionCallbacks.get(deviceId);
                if (callbacks) {
                    this.connectionCallbacks.delete(deviceId);
                    reject(new Error(`Connection timeout after ${timeout}ms`));
                }
            }, timeout);
        });
    }

    /**
     * Verify that device has required services
     */
    private async verifyRequiredServices(device: BLEDevice): Promise<void> {
        try {
            const services = await device.services();
            const hasRequiredService = services.some(service => 
                service.uuid.toLowerCase() === BLUETOOTH_CONSTANTS.SERVICE_UUID.toLowerCase()
            );

            if (!hasRequiredService) {
                throw new Error(`Device does not have required service: ${BLUETOOTH_CONSTANTS.SERVICE_UUID}`);
            }

            // Check for required characteristics
            const characteristics = await device.characteristicsForService(BLUETOOTH_CONSTANTS.SERVICE_UUID);
            const hasRequiredCharacteristic = characteristics.some(char => 
                char.uuid.toLowerCase() === BLUETOOTH_CONSTANTS.TX_CHARACTERISTIC_UUID.toLowerCase()
            );

            if (!hasRequiredCharacteristic) {
                throw new Error(`Device does not have required characteristic: ${BLUETOOTH_CONSTANTS.TX_CHARACTERISTIC_UUID}`);
            }

            logger.debug('Required services verified', 'BLEConnectionManager.verifyRequiredServices', {
                serviceCount: services.length,
                characteristicCount: characteristics.length
            });

        } catch (error) {
            logger.error('Service verification failed', 'BLEConnectionManager.verifyRequiredServices', error);
            throw error;
        }
    }
}

export default BLEConnectionManager;

