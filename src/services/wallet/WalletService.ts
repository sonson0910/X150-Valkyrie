import logger from '../../utils/Logger';
import { WalletAccount, Transaction } from '../../types/wallet';
import WalletKeyManager from './WalletKeyManager';
import TransactionBuilder, { TransactionRequest, TransactionResult } from './TransactionBuilder';
import AccountManager from './AccountManager';

/**
 * WalletService - Main wallet service facade
 * 
 * This service acts as a coordinator between the three specialized modules:
 * - WalletKeyManager: Handles keys, mnemonics, and address generation
 * - TransactionBuilder: Handles transaction construction, signing, and submission  
 * - AccountManager: Handles account management, balances, and history
 * 
 * This design follows the Single Responsibility Principle and makes the code
 * more maintainable, testable, and easier to understand.
 */
export class WalletService {
    private static instance: WalletService;
    private keyManager: WalletKeyManager;
    private transactionBuilder: TransactionBuilder;
    private accountManager: AccountManager;
    private networkType: 'mainnet' | 'testnet';

    private constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
        this.networkType = networkType;
        this.keyManager = WalletKeyManager.getInstance(networkType);
        this.transactionBuilder = TransactionBuilder.getInstance(networkType);
        this.accountManager = AccountManager.getInstance(networkType);
    }

    public static getInstance(networkType: 'mainnet' | 'testnet' = 'testnet'): WalletService {
        if (!WalletService.instance) {
            WalletService.instance = new WalletService(networkType);
        }
        return WalletService.instance;
    }

    // =============================================================================
    // WALLET INITIALIZATION
    // =============================================================================

    /**
     * Initialize wallet from mnemonic phrase
     * @param mnemonic - BIP39 mnemonic phrase
     * @returns Success status
     */
    async initializeFromMnemonic(mnemonic: string): Promise<boolean> {
        try {
            logger.info('Initializing wallet from mnemonic', 'WalletService.initializeFromMnemonic');
            
            const success = await this.keyManager.initializeFromMnemonic(mnemonic);
            
            if (success) {
                logger.info('Wallet initialized successfully', 'WalletService.initializeFromMnemonic');
            }
            
            return success;
        } catch (error) {
            logger.error('Failed to initialize wallet', 'WalletService.initializeFromMnemonic', error);
            return false;
        }
    }

    /**
     * Generate new mnemonic phrase
     * @param strength - Mnemonic strength (128 = 12 words, 256 = 24 words)
     * @returns Generated mnemonic phrase
     */
    static generateMnemonic(strength: 128 | 256 = 128): string {
        return WalletKeyManager.generateMnemonic(strength);
    }

    /**
     * Check if wallet is initialized
     */
    isInitialized(): boolean {
        return this.keyManager.isInitialized();
    }

    // =============================================================================
    // ACCOUNT MANAGEMENT
    // =============================================================================

    /**
     * Create a new account
     * @param accountIndex - Account index (default: 0)
     * @param name - Account name
     * @returns Created account
     */
    async createAccount(accountIndex: number = 0, name?: string): Promise<WalletAccount> {
        return await this.accountManager.createAccount(accountIndex, name);
    }

    /**
     * Get account by index
     * @param accountIndex - Account index
     * @returns Account or null
     */
    getAccount(accountIndex: number): WalletAccount | null {
        return this.accountManager.getAccount(accountIndex);
    }

    /**
     * Get all accounts
     * @returns Array of all accounts
     */
    getAllAccounts(): WalletAccount[] {
        return this.accountManager.getAllAccounts();
    }

    /**
     * Get account balance
     * @param accountIndex - Account index (default: 0)
     * @returns Balance in lovelace
     */
    async getBalance(accountIndex: number = 0): Promise<string> {
        return await this.accountManager.getAccountBalance(accountIndex);
    }

    /**
     * Update account balance
     * @param accountIndex - Account index
     * @returns Updated balance
     */
    async updateBalance(accountIndex: number = 0): Promise<string> {
        return await this.accountManager.updateAccountBalance(accountIndex);
    }

    /**
     * Get primary address for account
     * @param accountIndex - Account index (default: 0)
     * @returns Primary address
     */
    getPrimaryAddress(accountIndex: number = 0): string | null {
        return this.accountManager.getPrimaryAddress(accountIndex);
    }

    /**
     * Generate new address for account
     * @param accountIndex - Account index
     * @param isChange - Whether this is a change address
     * @returns New address
     */
    async generateNewAddress(accountIndex: number = 0, isChange: boolean = false): Promise<string> {
        return await this.accountManager.generateNewAddress(accountIndex, isChange);
    }

    // =============================================================================
    // TRANSACTION MANAGEMENT
    // =============================================================================

    /**
     * Build a transaction (unsigned)
     * @param request - Transaction details
     * @returns Transaction body CBOR hex
     */
    async buildTransaction(request: TransactionRequest): Promise<string> {
        return await this.transactionBuilder.buildTransaction(request);
    }

    /**
     * Sign a transaction
     * @param txBodyHex - Transaction body CBOR hex
     * @param accountIndex - Account index for signing
     * @param addressIndex - Address index for signing
     * @returns Signed transaction CBOR hex
     */
    async signTransaction(
        txBodyHex: string, 
        accountIndex: number = 0, 
        addressIndex: number = 0
    ): Promise<string> {
        return await this.transactionBuilder.signTransaction(txBodyHex, accountIndex, addressIndex);
    }

    /**
     * Submit a signed transaction
     * @param signedTxHex - Signed transaction CBOR hex
     * @returns Transaction result
     */
    async submitTransaction(signedTxHex: string): Promise<TransactionResult> {
        return await this.transactionBuilder.submitTransaction(signedTxHex);
    }

    /**
     * Create, sign and submit transaction in one operation
     * @param request - Transaction request
     * @param accountIndex - Account index for signing
     * @param addressIndex - Address index for signing
     * @returns Transaction result
     */
    async createAndSubmitTransaction(
        request: TransactionRequest,
        accountIndex: number = 0,
        addressIndex: number = 0
    ): Promise<TransactionResult> {
        return await this.transactionBuilder.createAndSubmitTransaction(request, accountIndex, addressIndex);
    }

    /**
     * Estimate transaction fee
     * @param request - Transaction request
     * @returns Estimated fee in lovelace
     */
    async estimateFee(request: TransactionRequest): Promise<string> {
        return await this.transactionBuilder.estimateFee(request);
    }

    // =============================================================================
    // TRANSACTION HISTORY
    // =============================================================================

    /**
     * Get transaction history for account
     * @param accountIndex - Account index
     * @param limit - Maximum transactions to return
     * @returns Array of transactions
     */
    async getTransactionHistory(accountIndex: number = 0, limit: number = 50): Promise<Transaction[]> {
        return await this.accountManager.getTransactionHistory(accountIndex, limit);
    }

    /**
     * Get UTXOs for account
     * @param accountIndex - Account index
     * @returns Array of UTXOs
     */
    async getUTXOs(accountIndex: number = 0): Promise<any[]> {
        return await this.accountManager.getAccountUTXOs(accountIndex);
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Create QR code data for receiving payments
     * @param accountIndex - Account index
     * @param amount - Optional amount in ADA
     * @param message - Optional message
     * @returns QR code URI
     */
    createReceiveQRData(accountIndex: number = 0, amount?: string, message?: string): string {
        return this.accountManager.createReceiveQRData(accountIndex, amount, message);
    }

    /**
     * Update account name
     * @param accountIndex - Account index
     * @param newName - New name
     */
    updateAccountName(accountIndex: number, newName: string): void {
        this.accountManager.updateAccountName(accountIndex, newName);
    }

    /**
     * Set account active status
     * @param accountIndex - Account index
     * @param isActive - Active status
     */
    setAccountActive(accountIndex: number, isActive: boolean): void {
        this.accountManager.setAccountActive(accountIndex, isActive);
    }

    /**
     * Clear sensitive data from memory
     */
    clearSensitiveData(): void {
        this.keyManager.clearSensitiveData();
        logger.info('Sensitive wallet data cleared', 'WalletService.clearSensitiveData');
    }

    /**
     * Set network (switches all modules to new network)
     * @param networkType - Network type
     */
    setNetwork(networkType: 'mainnet' | 'testnet'): void {
        this.networkType = networkType;
        this.keyManager.setNetwork(networkType);
        this.transactionBuilder.setNetwork(networkType);
        this.accountManager.setNetwork(networkType);
        
        logger.info('Wallet service network changed', 'WalletService.setNetwork', { networkType });
    }

    /**
     * Get current network
     */
    getNetwork(): 'mainnet' | 'testnet' {
        return this.networkType;
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
        return {
            isInitialized: this.isInitialized(),
            network: this.networkType,
            accountCount: this.accountManager.getAccountCount(),
            hasAccounts: this.accountManager.getAccountCount() > 0
        };
    }

    // =============================================================================
    // LEGACY COMPATIBILITY METHODS
    // =============================================================================

    /**
     * Legacy method - for backward compatibility with existing code
     * @deprecated Use getBalance instead
     */
    async getWalletBalance(): Promise<string> {
        logger.warn('getWalletBalance is deprecated, use getBalance instead', 'WalletService.getWalletBalance');
        return await this.getBalance(0);
    }

    /**
     * Legacy method - for backward compatibility with existing code
     * @deprecated Use getPrimaryAddress instead
     */
    getWalletAddress(): string | null {
        logger.warn('getWalletAddress is deprecated, use getPrimaryAddress instead', 'WalletService.getWalletAddress');
        return this.getPrimaryAddress(0);
    }
}

export default WalletService;

// Export the old class name for backward compatibility
export { WalletService as CardanoWalletService };

