import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, TransactionStatus } from '../types/wallet';
import { STORAGE_KEYS } from '@constants/index';
import { CardanoWalletService } from './CardanoWalletService';
import { NetworkService } from './NetworkService';
import { ErrorHandler, ErrorType, ErrorSeverity } from './ErrorHandler';

/**
 * Service quản lý giao dịch offline và hàng chờ
 * Xử lý ký transaction offline, lưu vào queue và sync khi có mạng
 */
export class OfflineTransactionService {
    private static instance: OfflineTransactionService;
    private offlineQueue: Transaction[] = [];
    private walletService: CardanoWalletService;
    private syncInterval?: NodeJS.Timeout;

    constructor() {
        this.walletService = CardanoWalletService.getInstance();
    }

    static getInstance(): OfflineTransactionService {
        if (!OfflineTransactionService.instance) {
            OfflineTransactionService.instance = new OfflineTransactionService();
        }
        return OfflineTransactionService.instance;
    }

    /**
     * Khởi tạo service và load offline queue
     * @returns Success status
     */
    async initialize(): Promise<boolean> {
        try {
            await this.loadOfflineQueue();
            this.startAutoSync();

            console.log('Offline transaction service initialized');
            return true;

        } catch (error) {
            console.error('Failed to initialize offline service:', error);
            return false;
        }
    }

    /**
     * Tạo và ký transaction offline
     * @param fromAddress - Địa chỉ gửi
     * @param toAddress - Địa chỉ nhận
     * @param amount - Số lượng ADA (lovelace)
     * @param accountIndex - Index của account
     * @param metadata - Metadata tùy chọn
     * @returns Signed transaction
     */
    async createOfflineTransaction(
        fromAddress: string,
        toAddress: string,
        amount: string,
        accountIndex: number = 0,
        metadata?: any
    ): Promise<{ transaction: Transaction; signedTx: string }> {
        try {
            // Tạo transaction
            const transaction = await this.walletService.buildTransaction(
                fromAddress,
                toAddress,
                amount,
                metadata
            );

            // Mark as offline
            transaction.isOffline = true;
            transaction.status = TransactionStatus.OFFLINE_SIGNED;

            // Ký transaction offline
            const signedTx = await this.walletService.signTransaction(transaction, accountIndex);

            // Thêm vào offline queue
            await this.addToOfflineQueue(transaction);

            console.log('Offline transaction created:', transaction.id);

            return { transaction, signedTx };

        } catch (error) {
            throw new Error(`Failed to create offline transaction: ${error}`);
        }
    }

    /**
     * Thêm transaction vào offline queue
     * @param transaction - Transaction cần thêm
     * @returns Success status
     */
    async addToOfflineQueue(transaction: Transaction): Promise<boolean> {
        try {
            // Kiểm tra duplicate
            const existingIndex = this.offlineQueue.findIndex(tx => tx.id === transaction.id);

            if (existingIndex >= 0) {
                // Update existing transaction
                this.offlineQueue[existingIndex] = transaction;
            } else {
                // Add new transaction
                this.offlineQueue.push(transaction);
            }

            // Save to storage
            await this.saveOfflineQueue();

            console.log('Transaction added to offline queue:', transaction.id);
            return true;

        } catch (error) {
            console.error('Failed to add transaction to queue:', error);
            return false;
        }
    }

    /**
     * Xóa transaction khỏi offline queue
     * @param transactionId - ID của transaction
     * @returns Success status
     */
    async removeFromOfflineQueue(transactionId: string): Promise<boolean> {
        try {
            const initialLength = this.offlineQueue.length;
            this.offlineQueue = this.offlineQueue.filter(tx => tx.id !== transactionId);

            if (this.offlineQueue.length < initialLength) {
                await this.saveOfflineQueue();
                console.log('Transaction removed from offline queue:', transactionId);
                return true;
            }

            return false;

        } catch (error) {
            console.error('Failed to remove transaction from queue:', error);
            return false;
        }
    }

    /**
     * Lấy danh sách transaction trong offline queue
     * @param status - Filter theo status (tùy chọn)
     * @returns Danh sách transactions
     */
    getOfflineQueue(status?: TransactionStatus): Transaction[] {
        if (status) {
            return this.offlineQueue.filter(tx => tx.status === status);
        }

        return [...this.offlineQueue];
    }

    /**
     * Đếm số transaction pending trong queue
     * @returns Số lượng pending transactions
     */
    getPendingCount(): number {
        return this.offlineQueue.filter(tx =>
            tx.status === TransactionStatus.OFFLINE_SIGNED ||
            tx.status === TransactionStatus.QUEUED
        ).length;
    }

    /**
     * Kiểm tra có transaction nào ready để sync không
     * @returns true nếu có transaction ready
     */
    hasTransactionsToSync(): boolean {
        return this.offlineQueue.some(tx =>
            tx.status === TransactionStatus.OFFLINE_SIGNED ||
            tx.status === TransactionStatus.QUEUED
        );
    }

    /**
     * Sync offline transactions khi có mạng
     * @param isOnline - Network status
     * @returns Sync result
     */
    async syncOfflineTransactions(isOnline: boolean): Promise<{
        success: boolean;
        synced: number;
        failed: number;
        errors: string[];
    }> {
        if (!isOnline) {
            return { success: false, synced: 0, failed: 0, errors: ['Network unavailable'] };
        }

        const result = {
            success: true,
            synced: 0,
            failed: 0,
            errors: [] as string[]
        };

        try {
            const transactionsToSync = this.getOfflineQueue(TransactionStatus.OFFLINE_SIGNED)
                .concat(this.getOfflineQueue(TransactionStatus.QUEUED));

            console.log(`Syncing ${transactionsToSync.length} offline transactions`);

            for (const transaction of transactionsToSync) {
                try {
                    // Mark as pending while submitting
                    transaction.status = TransactionStatus.PENDING;
                    await this.addToOfflineQueue(transaction);

                    // Submit transaction to network
                    const txHash = await this.walletService.submitTransaction(transaction.signedTx || '');

                    if (txHash) {
                        // Update transaction with hash and confirm
                        transaction.hash = txHash;
                        transaction.status = TransactionStatus.CONFIRMED;
                        transaction.isOffline = false;

                        // Remove from offline queue
                        await this.removeFromOfflineQueue(transaction.id);

                        result.synced++;
                        console.log('Transaction synced successfully:', transaction.id, txHash);
                    } else {
                        throw new Error('Transaction submission returned no hash');
                    }

                } catch (error) {
                    transaction.status = TransactionStatus.FAILED;
                    transaction.errorDetails = error instanceof Error ? error.message : String(error);
                    await this.addToOfflineQueue(transaction);

                    result.failed++;
                    result.errors.push(`${transaction.id}: ${error}`);
                    console.error('Failed to sync transaction:', transaction.id, error);
                }
            }

            result.success = result.failed === 0;

        } catch (error) {
            result.success = false;
            result.errors.push(`Sync process failed: ${error}`);
            console.error('Sync process failed:', error);
        }

        return result;
    }

    /**
     * Retry failed transaction
     * @param transactionId - ID của transaction
     * @returns Success status
     */
    async retryTransaction(transactionId: string): Promise<boolean> {
        try {
            const transaction = this.offlineQueue.find(tx => tx.id === transactionId);

            if (!transaction) {
                throw new Error('Transaction not found in queue');
            }

            if (transaction.status !== TransactionStatus.FAILED) {
                throw new Error('Only failed transactions can be retried');
            }

            // Reset status to queued for retry
            transaction.status = TransactionStatus.QUEUED;
            transaction.timestamp = new Date(); // Update timestamp

            await this.addToOfflineQueue(transaction);

            console.log('Transaction marked for retry:', transactionId);
            return true;

        } catch (error) {
            console.error('Failed to retry transaction:', error);
            return false;
        }
    }

    /**
     * Clear failed transactions
     * @returns Success status
     */
    async clearFailedTransactions(): Promise<boolean> {
        try {
            const initialLength = this.offlineQueue.length;
            this.offlineQueue = this.offlineQueue.filter(tx => tx.status !== TransactionStatus.FAILED);

            if (this.offlineQueue.length < initialLength) {
                await this.saveOfflineQueue();
                console.log('Failed transactions cleared');
                return true;
            }

            return false;

        } catch (error) {
            console.error('Failed to clear failed transactions:', error);
            return false;
        }
    }

    /**
     * Load offline queue từ storage
     * @returns Success status
     */
    private async loadOfflineQueue(): Promise<boolean> {
        try {
            const queueData = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);

            if (queueData) {
                const parsedQueue = JSON.parse(queueData);

                // Convert date strings back to Date objects
                this.offlineQueue = parsedQueue.map((tx: any) => ({
                    ...tx,
                    timestamp: new Date(tx.timestamp)
                }));

                console.log(`Loaded ${this.offlineQueue.length} transactions from offline queue`);
            }

            return true;

        } catch (error) {
            console.error('Failed to load offline queue:', error);
            this.offlineQueue = [];
            return false;
        }
    }

    /**
     * Save offline queue to storage
     * @returns Success status
     */
    private async saveOfflineQueue(): Promise<boolean> {
        try {
            await AsyncStorage.setItem(
                STORAGE_KEYS.OFFLINE_QUEUE,
                JSON.stringify(this.offlineQueue)
            );

            return true;

        } catch (error) {
            console.error('Failed to save offline queue:', error);
            return false;
        }
    }

    /**
     * Bắt đầu auto sync transactions
     * @param interval - Sync interval (ms)
     */
    private startAutoSync(interval: number = 30000): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            if (this.hasTransactionsToSync()) {
                // Check actual network status
                try {
                    const networkService = NetworkService.getInstance();
                    const isOnline = networkService.isOnline();

                    if (isOnline) {
                        await this.syncOfflineTransactions(isOnline);
                    }
                } catch (error) {
                    console.error('Failed to check network status:', error);
                }
            }
        }, interval);
    }

    /**
     * Dừng auto sync
     */
    stopAutoSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = undefined;
        }
    }

    /**
     * Cleanup service
     * @returns Success status
     */
    async cleanup(): Promise<boolean> {
        try {
            this.stopAutoSync();
            await this.saveOfflineQueue();

            console.log('Offline transaction service cleaned up');
            return true;

        } catch (error) {
            console.error('Failed to cleanup offline service:', error);
            return false;
        }
    }
}
