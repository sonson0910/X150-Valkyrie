/**
 * CardanoWalletService - LEGACY WRAPPER
 * 
 * This file maintains backward compatibility with existing code while
 * using the new modular architecture internally.
 * 
 * The new architecture splits wallet functionality into:
 * - WalletKeyManager: Key and address management
 * - TransactionBuilder: Transaction construction and signing
 * - AccountManager: Account and balance management
 * - WalletService: Main facade coordinating all modules
 * 
 * @deprecated Use WalletService directly for new code
 */

import logger from '../utils/Logger';
import WalletService from './wallet/WalletService';
import { TransactionRequest } from './wallet/TransactionBuilder';
import { WalletAccount, Transaction } from '../types/wallet';

/**
 * Service chính để quản lý ví Cardano
 * 
 * @deprecated This class is now a wrapper around the new modular architecture.
 * Use WalletService directly for new code.
 */
export class CardanoWalletService {
    private static instance: CardanoWalletService;
    private walletService: WalletService;
    private networkType: 'mainnet' | 'testnet';

    public static getInstance(networkType: 'mainnet' | 'testnet' = 'testnet'): CardanoWalletService {
        if (!CardanoWalletService.instance) {
            CardanoWalletService.instance = new CardanoWalletService(networkType);
        }
        return CardanoWalletService.instance;
    }

    private constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
        this.networkType = networkType;
        this.walletService = WalletService.getInstance(networkType);
        
        logger.warn('CardanoWalletService is deprecated. Use WalletService directly for new code.', 'CardanoWalletService.constructor');
    }

    // =============================================================================
    // LEGACY API - All methods delegate to WalletService
    // =============================================================================

    /**
     * Khởi tạo ví từ mnemonic
     * @param mnemonic - Mnemonic phrase (12 hoặc 24 từ)
     * @returns Success status
     */
    async initializeFromMnemonic(mnemonic: string): Promise<boolean> {
        return await this.walletService.initializeFromMnemonic(mnemonic);
    }

    /**
     * Tạo mnemonic mới
     * @param strength - Độ mạnh (128 = 12 từ, 256 = 24 từ)
     * @returns Mnemonic phrase
     */
    static generateMnemonic(strength: 128 | 256 = 128): string {
        return WalletService.generateMnemonic(strength);
    }

    /**
     * Tạo account mới
     * @param accountIndex - Index của account (0, 1, 2...)
     * @param name - Tên account
     * @returns WalletAccount object
     */
    async createAccount(accountIndex: number = 0, name: string = 'Main Account'): Promise<WalletAccount> {
        return await this.walletService.createAccount(accountIndex, name);
    }

    /**
     * Lấy thông tin balance
     * @param address - Địa chỉ Cardano (optional, uses primary address if not provided)
     * @returns Balance in lovelace
     */
    async getBalance(address?: string): Promise<string> {
        if (address) {
            // Legacy behavior - get balance for specific address
            // Find account that contains this address
            const accounts = this.walletService.getAllAccounts();
            for (let i = 0; i < accounts.length; i++) {
                if (accounts[i].address === address) {
                    return await this.walletService.getBalance(i);
                }
            }
            return '0';
        } else {
            // Default to account 0
            return await this.walletService.getBalance(0);
        }
    }

    /**
     * Tạo transaction (chưa sign)
     * @param fromAddress - Địa chỉ gửi
     * @param toAddress - Địa chỉ nhận
     * @param amount - Số lượng ADA (lovelace)
     * @param metadata - Optional metadata
     * @returns Transaction body CBOR hex
     */
    async buildTransaction(
        fromAddress: string,
        toAddress: string,
        amount: string,
        metadata?: any
    ): Promise<string> {
        const request: TransactionRequest = {
            fromAddress,
            toAddress,
            amount,
            metadata
        };

        return await this.walletService.buildTransaction(request);
    }

    /**
     * Ký transaction
     * @param txBodyHex - Transaction body CBOR hex
     * @param fromAddress - Địa chỉ gửi (to determine which account/address to use for signing)
     * @returns Signed transaction CBOR hex
     */
    async signTransaction(txBodyHex: string, fromAddress: string): Promise<string> {
        // Find account and address index for the fromAddress
        const accounts = this.walletService.getAllAccounts();
        let accountIndex = 0;
        let addressIndex = 0;

        for (let i = 0; i < accounts.length; i++) {
            if (accounts[i].address === fromAddress) {
                accountIndex = i;
                addressIndex = 0; // Use primary address index
                break;
            }
        }

        return await this.walletService.signTransaction(txBodyHex, accountIndex, addressIndex);
    }

    /**
     * Submit signed transaction
     * @param signedTxHex - Signed transaction CBOR hex
     * @returns Transaction hash
     */
    async submitTransaction(signedTxHex: string): Promise<string> {
        const result = await this.walletService.submitTransaction(signedTxHex);
        return result.txHash;
    }

    /**
     * Lấy transaction history
     * @param address - Địa chỉ Cardano (optional, uses primary account if not provided)
     * @returns Array of transactions
     */
    async getTransactionHistory(address?: string): Promise<Transaction[]> {
        if (address) {
            // Legacy behavior - get transactions for specific address
            const accounts = this.walletService.getAllAccounts();
            for (let i = 0; i < accounts.length; i++) {
                if (accounts[i].address === address) {
                    return await this.walletService.getTransactionHistory(i);
                }
            }
            return [];
        } else {
            // Default to account 0
            return await this.walletService.getTransactionHistory(0);
        }
    }

    /**
     * Lấy UTXOs của một địa chỉ
     * @param address - Địa chỉ Cardano (optional, uses primary account if not provided)
     * @returns Array of UTXOs
     */
    async getUTXOs(address?: string): Promise<any[]> {
        if (address) {
            // Legacy behavior - get UTXOs for specific address
            const accounts = this.walletService.getAllAccounts();
            for (let i = 0; i < accounts.length; i++) {
                if (accounts[i].address === address) {
                    return await this.walletService.getUTXOs(i);
                }
            }
            return [];
        } else {
            // Default to account 0
            return await this.walletService.getUTXOs(0);
        }
    }

    /**
     * Tạo QR code data cho transaction request
     * @param address - Địa chỉ nhận (optional, uses primary address if not provided)
     * @param amount - Số lượng ADA (optional)
     * @param message - Message (optional)
     * @returns QR code URI
     */
    createQRCode(address?: string, amount?: string, message?: string): string {
        if (address) {
            // Legacy behavior - use provided address
            let uri = `cardano:${address}`;
            const params: string[] = [];

            if (amount) {
                params.push(`amount=${parseFloat(amount) * 1000000}`); // Convert ADA to lovelace
            }

            if (message) {
                params.push(`message=${encodeURIComponent(message)}`);
            }

            if (params.length > 0) {
                uri += `?${params.join('&')}`;
            }

            return uri;
        } else {
            // Use primary account
            return this.walletService.createReceiveQRData(0, amount, message);
        }
    }

    /**
     * Generate new address for receiving payments
     * @param accountIndex - Account index (optional, defaults to 0)
     * @returns New address
     */
    async generateAddress(accountIndex: number = 0): Promise<string> {
        return await this.walletService.generateNewAddress(accountIndex);
    }

    /**
     * Get primary address for account
     * @param accountIndex - Account index (optional, defaults to 0)
     * @returns Primary address
     */
    getAddress(accountIndex: number = 0): string | null {
        return this.walletService.getPrimaryAddress(accountIndex);
    }

    /**
     * Clear sensitive data from memory
     */
    clearSensitiveData(): void {
        this.walletService.clearSensitiveData();
    }

    /**
     * Set network
     * @param networkType - Network type
     */
    setNetwork(networkType: 'mainnet' | 'testnet'): void {
        this.networkType = networkType;
        this.walletService.setNetwork(networkType);
    }

    /**
     * Get current network
     */
    getNetwork(): 'mainnet' | 'testnet' {
        return this.networkType;
    }

    /**
     * Check if wallet is initialized
     */
    isInitialized(): boolean {
        return this.walletService.isInitialized();
    }

    // =============================================================================
    // LEGACY COMPATIBILITY METHODS
    // =============================================================================

    /**
     * Legacy method - get wallet balance (account 0)
     * @deprecated Use getBalance() instead
     */
    async getWalletBalance(): Promise<string> {
        logger.warn('getWalletBalance is deprecated, use getBalance instead', 'CardanoWalletService.getWalletBalance');
        return await this.getBalance();
    }

    /**
     * Legacy method - get wallet address (account 0, primary address)
     * @deprecated Use getAddress() instead
     */
    getWalletAddress(): string | null {
        logger.warn('getWalletAddress is deprecated, use getAddress instead', 'CardanoWalletService.getWalletAddress');
        return this.getAddress(0);
    }

    /**
     * Get wallet status information
     */
    getWalletStatus(): {
        isInitialized: boolean;
        network: string;
        accountCount: number;
        hasAccounts: boolean;
    } {
        return this.walletService.getWalletStatus();
    }

    // =============================================================================
    // MIGRATION HELPERS
    // =============================================================================

    /**
     * Get access to the new WalletService for migration
     * @returns WalletService instance
     */
    getWalletService(): WalletService {
        logger.info('Accessing new WalletService for migration', 'CardanoWalletService.getWalletService');
        return this.walletService;
    }
}

export default CardanoWalletService;

