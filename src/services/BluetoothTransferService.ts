/**
 * BluetoothTransferService - LEGACY WRAPPER
 * 
 * This file maintains backward compatibility with existing code while
 * using the new modular Bluetooth architecture internally.
 * 
 * The new architecture splits Bluetooth functionality into:
 * - BLEDeviceManager: Device discovery and BLE hardware management
 * - BLEConnectionManager: Device connection management
 * - BLEDataTransfer: Frame-based data transfer with encryption
 * - BluetoothTransactionService: Main service orchestrating transaction transfers
 * 
 * @deprecated Use BluetoothTransactionService directly for new code
 */

import logger from '../utils/Logger';
import BluetoothTransactionService, { MerchantDevice, TransferResult } from './bluetooth/BluetoothTransactionService';
import { BluetoothTransaction, Transaction, TransactionStatus } from '../types/wallet';

/**
 * Service xử lý truyền giao dịch qua Bluetooth khi offline
 * 
 * @deprecated This class is now a wrapper around the new modular architecture.
 * Use BluetoothTransactionService directly for new code.
 */
export class BluetoothTransferService {
    private static instance: BluetoothTransferService;
    private bluetoothService: BluetoothTransactionService;

    static getInstance(): BluetoothTransferService {
        if (!BluetoothTransferService.instance) {
            BluetoothTransferService.instance = new BluetoothTransferService();
        }
        return BluetoothTransferService.instance;
    }

    private constructor() {
        this.bluetoothService = BluetoothTransactionService.getInstance();
        
        logger.warn('BluetoothTransferService is deprecated. Use BluetoothTransactionService directly for new code.', 'BluetoothTransferService.constructor');
    }

    // =============================================================================
    // LEGACY API - All methods delegate to BluetoothTransactionService
    // =============================================================================

    /**
     * Khởi tạo Bluetooth service
     * @returns Success status
     */
    async initialize(): Promise<boolean> {
        return await this.bluetoothService.initialize();
    }

    /**
     * Kiểm tra Bluetooth có available không
     * @returns Bluetooth status
     */
    async checkBluetoothStatus(): Promise<{
        isEnabled: boolean;
        hasPermission: boolean;
        canAdvertise: boolean;
    }> {
        const status = await this.bluetoothService.checkBluetoothStatus();
        return {
            isEnabled: status.isEnabled,
            hasPermission: status.hasPermission,
            canAdvertise: status.canAdvertise
        };
    }

    /**
     * Bắt đầu quét tìm merchant (customer mode)
     * @param onMerchantFound - Callback khi tìm thấy merchant
     * @returns Success status
     */
    async startScanForMerchants(
        onMerchantFound: (merchant: any) => void
    ): Promise<boolean> {
        // Convert new MerchantDevice format to legacy format
        const legacyCallback = (merchant: MerchantDevice) => {
            const legacyMerchant = {
                id: merchant.id,
                name: merchant.name,
                rssi: merchant.rssi,
                // Add any other legacy fields if needed
            };
            onMerchantFound(legacyMerchant);
        };

        return await this.bluetoothService.startScanForMerchants(legacyCallback);
    }

    /**
     * Dừng quét tìm merchant
     * @returns Success status
     */
    async stopScanForMerchants(): Promise<boolean> {
        return await this.bluetoothService.stopScanForMerchants();
    }

    /**
     * Bắt đầu merchant mode (advertising)
     * @returns Success status
     */
    async startMerchantMode(): Promise<boolean> {
        return await this.bluetoothService.startMerchantMode();
    }

    /**
     * Dừng merchant mode
     * @returns Success status
     */
    async stopMerchantMode(): Promise<boolean> {
        return await this.bluetoothService.stopMerchantMode();
    }

    /**
     * Kết nối với merchant
     * @param merchantId - ID của merchant
     * @returns Success status
     */
    async connectToMerchant(merchantId: string): Promise<boolean> {
        return await this.bluetoothService.connectToMerchant(merchantId);
    }

    /**
     * Gửi transaction tới merchant (customer side)
     * @param merchantId - ID của merchant
     * @param signedTx - Signed transaction data
     * @param metadata - Transaction metadata
     * @returns Transfer result
     */
    async sendTransactionToMerchant(
        merchantId: string,
        signedTx: string,
        metadata: {
            amount: string;
            recipient: string;
            fee?: string;
            memo?: string;
        }
    ): Promise<{ success: boolean; merchantConfirmation?: string }> {
        const result = await this.bluetoothService.sendTransactionToMerchant(
            merchantId,
            signedTx,
            metadata
        );

        return {
            success: result.success,
            merchantConfirmation: result.merchantConfirmation
        };
    }

    /**
     * Nhận transaction từ customer (merchant side)
     * @param onTransactionReceived - Callback khi nhận được transaction
     * @returns Success status
     */
    async startListeningForTransactions(
        onTransactionReceived: (transaction: BluetoothTransaction) => void
    ): Promise<boolean> {
        return await this.bluetoothService.startListeningForTransactions(onTransactionReceived);
    }

    /**
     * Dừng lắng nghe transaction
     * @returns Success status
     */
    async stopListeningForTransactions(): Promise<boolean> {
        return await this.bluetoothService.stopListeningForTransactions();
    }

    /**
     * Lấy danh sách merchant đã discover
     * @returns Array of discovered merchants
     */
    getDiscoveredMerchants(): any[] {
        const merchants = this.bluetoothService.getDiscoveredMerchants();
        
        // Convert to legacy format
        return merchants.map(merchant => ({
            id: merchant.id,
            name: merchant.name,
            rssi: merchant.rssi,
            isConnected: merchant.isConnected,
            lastSeen: merchant.lastSeen
        }));
    }

    /**
     * Ngắt kết nối với device
     * @param deviceId - ID của device
     * @returns Success status
     */
    async disconnectDevice(deviceId: string): Promise<boolean> {
        return await this.bluetoothService.disconnectFromMerchant(deviceId);
    }

    /**
     * Cleanup Bluetooth service
     * @returns Success status
     */
    async cleanup(): Promise<boolean> {
        return await this.bluetoothService.cleanup();
    }

    // =============================================================================
    // MIGRATION HELPERS
    // =============================================================================

    /**
     * Get access to the new BluetoothTransactionService for migration
     * @returns BluetoothTransactionService instance
     */
    getBluetoothTransactionService(): BluetoothTransactionService {
        logger.info('Accessing new BluetoothTransactionService for migration', 'BluetoothTransferService.getBluetoothTransactionService');
        return this.bluetoothService;
    }

    /**
     * Get service status (enhanced method not in legacy API)
     * @returns Enhanced service status
     */
    getServiceStatus(): {
        isInitialized: boolean;
        isScanning: boolean;
        isAdvertising: boolean;
        connectedDevices: number;
        activeTransactions: number;
        activeSessions: number;
    } {
        return this.bluetoothService.getServiceStatus();
    }

    /**
     * Get active transactions (enhanced method not in legacy API)
     * @returns Array of active transaction info
     */
    getActiveTransactions(): Array<{
        sessionId: string;
        transactionId: string;
        amount: string;
        recipient: string;
        status: string;
        startTime: Date;
        progress?: {
            totalFrames: number;
            completedFrames: number;
            progressPercentage: number;
        };
    }> {
        return this.bluetoothService.getActiveTransactions();
    }

    /**
     * Cancel active transaction (enhanced method not in legacy API)
     * @param sessionId - Session identifier
     * @returns Success status
     */
    async cancelTransaction(sessionId: string): Promise<boolean> {
        return await this.bluetoothService.cancelTransaction(sessionId);
    }
}

export default BluetoothTransferService;