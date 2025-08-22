import logger from '../../utils/Logger';
import { CardanoAPIService } from '../CardanoAPIService';
import { CARDANO_NETWORKS } from '../../constants/index';
import { WalletAccount, Transaction, TransactionStatus } from '../../types/wallet';
import WalletKeyManager from './WalletKeyManager';

// Extended WalletAccount interface for internal wallet management
interface ExtendedWalletAccount extends WalletAccount {
    accountIndex: number;
    addresses: string[];
    derivationPath: string;
}

/**
 * AccountManager - Manages wallet accounts, balances, and transaction history
 * 
 * Responsibilities:
 * - Account balance tracking and updates
 * - Transaction history management
 * - UTXO management and tracking
 * - Address management per account
 * - Account metadata and settings
 */
export class AccountManager {
    private static instance: AccountManager;
    private network: typeof CARDANO_NETWORKS.MAINNET | typeof CARDANO_NETWORKS.TESTNET;
    private apiService: CardanoAPIService;
    private keyManager: WalletKeyManager;
    private accounts: Map<number, ExtendedWalletAccount> = new Map();

    private constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
        this.apiService = CardanoAPIService.getInstance();
        this.keyManager = WalletKeyManager.getInstance(networkType);
    }

    public static getInstance(networkType: 'mainnet' | 'testnet' = 'testnet'): AccountManager {
        if (!AccountManager.instance) {
            AccountManager.instance = new AccountManager(networkType);
        }
        return AccountManager.instance;
    }

    /**
     * Create and register a new account
     * @param accountIndex - Account index
     * @param name - Account name
     * @returns Created account
     */
    async createAccount(accountIndex: number = 0, name?: string): Promise<WalletAccount> {
        try {
            logger.debug('Creating account', 'AccountManager.createAccount', { accountIndex, name });

            // Create account using key manager
            const baseAccount = await this.keyManager.createAccount(accountIndex, name);

            // Cast to extended account for internal management
            const account = baseAccount as ExtendedWalletAccount;

            // Store account in memory
            this.accounts.set(accountIndex, account);

            // Initialize balance
            await this.updateAccountBalance(accountIndex);

            logger.info('Account created successfully', 'AccountManager.createAccount', {
                accountIndex,
                name: account.name,
                primaryAddress: account.addresses[0]
            });

            return account;

        } catch (error) {
            logger.error('Failed to create account', 'AccountManager.createAccount', error);
            throw new Error(`Account creation failed: ${error}`);
        }
    }

    /**
     * Get account by index
     * @param accountIndex - Account index
     * @returns Account or null if not found
     */
    getAccount(accountIndex: number): WalletAccount | null {
        const account = this.accounts.get(accountIndex);
        return account ? account as WalletAccount : null;
    }

    /**
     * Get all accounts
     * @returns Array of all accounts
     */
    getAllAccounts(): WalletAccount[] {
        return Array.from(this.accounts.values()).map(account => account as WalletAccount);
    }

    /**
     * Update account balance
     * @param accountIndex - Account index
     * @returns Updated balance in lovelace
     */
    async updateAccountBalance(accountIndex: number): Promise<string> {
        try {
            const account = this.accounts.get(accountIndex);
            if (!account) {
                throw new Error(`Account ${accountIndex} not found`);
            }

            logger.debug('Updating account balance', 'AccountManager.updateAccountBalance', { accountIndex });

            let totalBalance = BigInt(0);

            // Sum balance from all addresses in the account
            for (const address of account.addresses) {
                try {
                    const addressInfo = await this.apiService.getAddressInfo(address);
                    const amounts = Array.isArray(addressInfo?.amount) ? addressInfo.amount : [];
                    const adaAmount = amounts.find((a: any) => a.unit === 'lovelace');
                    
                    if (adaAmount) {
                        totalBalance += BigInt(adaAmount.quantity);
                    }
                } catch (error) {
                    logger.warn(`Failed to get balance for address ${address}`, 'AccountManager.updateAccountBalance', error);
                }
            }

            // Update account balance
            account.balance = totalBalance.toString();
            this.accounts.set(accountIndex, account);

            logger.debug('Account balance updated', 'AccountManager.updateAccountBalance', {
                accountIndex,
                balance: account.balance
            });

            return account.balance;

        } catch (error) {
            logger.error('Failed to update account balance', 'AccountManager.updateAccountBalance', error);
            throw new Error(`Balance update failed: ${error}`);
        }
    }

    /**
     * Get account balance
     * @param accountIndex - Account index
     * @returns Balance in lovelace
     */
    async getAccountBalance(accountIndex: number): Promise<string> {
        try {
            const account = this.accounts.get(accountIndex);
            if (!account) {
                throw new Error(`Account ${accountIndex} not found`);
            }

            // Return cached balance or fetch fresh
            if (account.balance && account.balance !== '0') {
                return account.balance;
            }

            return await this.updateAccountBalance(accountIndex);

        } catch (error) {
            logger.error('Failed to get account balance', 'AccountManager.getAccountBalance', error);
            return '0';
        }
    }

    /**
     * Get primary address for an account
     * @param accountIndex - Account index
     * @returns Primary address string
     */
    getPrimaryAddress(accountIndex: number): string | null {
        const account = this.accounts.get(accountIndex);
        return account?.addresses[0] || null;
    }

    /**
     * Generate new address for account
     * @param accountIndex - Account index
     * @param isChange - Whether this is a change address
     * @returns New address string
     */
    async generateNewAddress(accountIndex: number, isChange: boolean = false): Promise<string> {
        try {
            const account = this.accounts.get(accountIndex);
            if (!account) {
                throw new Error(`Account ${accountIndex} not found`);
            }

            // Calculate next address index
            const addressIndex = account.addresses.length;

            // Generate new address
            const newAddress = await this.keyManager.generateNewAddress(accountIndex, addressIndex, isChange);

            // Add to account
            account.addresses.push(newAddress);
            this.accounts.set(accountIndex, account);

            logger.info('New address generated', 'AccountManager.generateNewAddress', {
                accountIndex,
                addressIndex,
                isChange,
                address: newAddress
            });

            return newAddress;

        } catch (error) {
            logger.error('Failed to generate new address', 'AccountManager.generateNewAddress', error);
            throw new Error(`Address generation failed: ${error}`);
        }
    }

    /**
     * Get transaction history for account
     * @param accountIndex - Account index
     * @param limit - Maximum number of transactions to return
     * @returns Array of transactions
     */
    async getTransactionHistory(accountIndex: number, limit: number = 50): Promise<Transaction[]> {
        try {
            const account = this.accounts.get(accountIndex);
            if (!account) {
                throw new Error(`Account ${accountIndex} not found`);
            }

            logger.debug('Getting transaction history', 'AccountManager.getTransactionHistory', {
                accountIndex,
                limit
            });

            const transactions: Transaction[] = [];

            // Get transactions for all addresses in the account
            for (const address of account.addresses) {
                try {
                    const addressTxs = await this.apiService.getAddressTransactions(address, 1, 25); // Get recent transactions
                    
                    for (const txItem of addressTxs.slice(0, limit)) {
                        try {
                            const [txDetails, txUTXOs] = await Promise.all([
                                this.apiService.getTransaction(txItem.tx_hash),
                                this.apiService.getTransactionUTXOs(txItem.tx_hash)
                            ]);
                            
                            // Parse transaction details
                            const transaction: Transaction = {
                                id: txItem.tx_hash,
                                hash: txItem.tx_hash,
                                from: address,
                                to: '', // Will be determined from outputs
                                amount: '0',
                                fee: txDetails.fees || '0',
                                timestamp: new Date(txItem.block_time * 1000),
                                status: TransactionStatus.CONFIRMED,
                                metadata: {
                                    blockHeight: txItem.block_height,
                                    confirmations: 0, // Calculate if needed
                                },
                                isOffline: false
                            };

                            // Determine direction and amounts from outputs
                            if (txUTXOs.outputs) {
                                for (const output of txUTXOs.outputs) {
                                    if (account.addresses.includes(output.address)) {
                                        // Incoming transaction
                                        transaction.to = output.address;
                                        transaction.amount = output.amount.find((a: any) => a.unit === 'lovelace')?.quantity || '0';
                                        break;
                                    } else if (output.address === address) {
                                        // Outgoing transaction  
                                        transaction.to = output.address;
                                        transaction.amount = output.amount.find((a: any) => a.unit === 'lovelace')?.quantity || '0';
                                        break;
                                    }
                                }
                            }

                            transactions.push(transaction);

                        } catch (error) {
                            logger.warn(`Failed to get details for tx ${txItem.tx_hash}`, 'AccountManager.getTransactionHistory', error);
                        }
                    }
                } catch (error) {
                    logger.warn(`Failed to get transactions for address ${address}`, 'AccountManager.getTransactionHistory', error);
                }
            }

            // Sort by timestamp (newest first) and limit
            const sortedTransactions = transactions
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, limit);

            logger.debug('Transaction history retrieved', 'AccountManager.getTransactionHistory', {
                accountIndex,
                transactionCount: sortedTransactions.length
            });

            return sortedTransactions;

        } catch (error) {
            logger.error('Failed to get transaction history', 'AccountManager.getTransactionHistory', error);
            return [];
        }
    }

    /**
     * Get UTXOs for account
     * @param accountIndex - Account index
     * @returns Array of UTXOs
     */
    async getAccountUTXOs(accountIndex: number): Promise<any[]> {
        try {
            const account = this.accounts.get(accountIndex);
            if (!account) {
                throw new Error(`Account ${accountIndex} not found`);
            }

            const allUtxos: any[] = [];

            // Get UTXOs for all addresses in the account
            for (const address of account.addresses) {
                try {
                    const utxos = await this.apiService.getAddressUTXOs(address);
                    if (utxos && utxos.length > 0) {
                        allUtxos.push(...utxos.map(utxo => ({ ...utxo, address })));
                    }
                } catch (error) {
                    logger.warn(`Failed to get UTXOs for address ${address}`, 'AccountManager.getAccountUTXOs', error);
                }
            }

            logger.debug('Account UTXOs retrieved', 'AccountManager.getAccountUTXOs', {
                accountIndex,
                utxoCount: allUtxos.length
            });

            return allUtxos;

        } catch (error) {
            logger.error('Failed to get account UTXOs', 'AccountManager.getAccountUTXOs', error);
            return [];
        }
    }

    /**
     * Update account name
     * @param accountIndex - Account index
     * @param newName - New account name
     */
    updateAccountName(accountIndex: number, newName: string): void {
        const account = this.accounts.get(accountIndex);
        if (account) {
            account.name = newName;
            this.accounts.set(accountIndex, account);
            
            logger.info('Account name updated', 'AccountManager.updateAccountName', {
                accountIndex,
                newName
            });
        }
    }

    /**
     * Set account active status
     * @param accountIndex - Account index
     * @param isActive - Active status
     */
    setAccountActive(accountIndex: number, isActive: boolean): void {
        const account = this.accounts.get(accountIndex);
        if (account) {
            account.isActive = isActive;
            this.accounts.set(accountIndex, account);
            
            logger.info('Account active status updated', 'AccountManager.setAccountActive', {
                accountIndex,
                isActive
            });
        }
    }

    /**
     * Create QR code data for receiving payments
     * @param accountIndex - Account index
     * @param amount - Optional amount in ADA
     * @param message - Optional message
     * @returns QR code URI
     */
    createReceiveQRData(accountIndex: number, amount?: string, message?: string): string {
        const address = this.getPrimaryAddress(accountIndex);
        if (!address) {
            throw new Error(`Account ${accountIndex} not found`);
        }

        // Create Cardano URI format
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

        logger.debug('QR code data created', 'AccountManager.createReceiveQRData', {
            accountIndex,
            amount,
            message,
            uri
        });

        return uri;
    }

    /**
     * Clear all account data (useful when switching networks)
     */
    clearAccounts(): void {
        this.accounts.clear();
        logger.info('All accounts cleared', 'AccountManager.clearAccounts');
    }

    /**
     * Set network (will clear account data for security)
     */
    setNetwork(networkType: 'mainnet' | 'testnet'): void {
        // Clear existing accounts when switching networks for security
        this.clearAccounts();
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
        this.apiService.setNetwork(networkType);
        
        logger.info('Account manager network changed', 'AccountManager.setNetwork', { networkType });
    }

    /**
     * Get current network
     */
    getNetwork(): typeof CARDANO_NETWORKS.MAINNET | typeof CARDANO_NETWORKS.TESTNET {
        return this.network;
    }

    /**
     * Get account count
     */
    getAccountCount(): number {
        return this.accounts.size;
    }

    /**
     * Check if account exists
     */
    hasAccount(accountIndex: number): boolean {
        return this.accounts.has(accountIndex);
    }
}

export default AccountManager;
