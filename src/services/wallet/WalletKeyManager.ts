import * as bip39 from 'bip39';
import logger from '../../utils/Logger';
import { MemoryUtils } from '../../utils/MemoryUtils';
import { CARDANO_NETWORKS, CARDANO_DERIVATION, MNEMONIC_CONSTANTS, hardenIndex } from '../../constants/index';
import { WalletAccount } from '../../types/wallet';

// CSL will be loaded lazily when needed
import { getCSL } from '../../utils/CSLProvider';

// Use centralized hardened derivation function (imported from constants)
// const harden = hardenIndex; // Already imported

/**
 * WalletKeyManager - Manages cryptographic keys, mnemonics, and address generation
 * 
 * Responsibilities:
 * - Mnemonic generation and validation
 * - Root key derivation and management  
 * - Address generation and derivation
 * - Account creation
 * - Secure memory cleanup
 */
export class WalletKeyManager {
    private static instance: WalletKeyManager;
    private network: typeof CARDANO_NETWORKS.MAINNET | typeof CARDANO_NETWORKS.TESTNET;
    private rootKey?: any;

    private constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
    }

    public static getInstance(networkType: 'mainnet' | 'testnet' = 'testnet'): WalletKeyManager {
        if (!WalletKeyManager.instance) {
            WalletKeyManager.instance = new WalletKeyManager(networkType);
        }
        return WalletKeyManager.instance;
    }

    /**
     * Generate a new mnemonic phrase
     * @param strength - Mnemonic strength (128 = 12 words, 256 = 24 words)
     * @returns Generated mnemonic phrase
     */
    static generateMnemonic(strength: 128 | 256 = 128): string {
        return bip39.generateMnemonic(strength);
    }

    /**
     * Initialize wallet from mnemonic phrase
     * @param mnemonic - BIP39 mnemonic phrase
     * @returns Success status
     */
    async initializeFromMnemonic(mnemonic: string): Promise<boolean> {
        try {
            // Load CSL library lazily
            const { Bip32PrivateKey } = await getCSL();
            
            // Validate mnemonic
            if (!bip39.validateMnemonic(mnemonic)) {
                throw new Error('Invalid mnemonic phrase');
            }

            // Derive entropy from mnemonic (BIP39) and create root key from entropy
            const entropyHex = bip39.mnemonicToEntropy(mnemonic);
            const entropyBytes = Buffer.from(entropyHex, 'hex');

            // Create root key using Cardano's key derivation
            this.rootKey = Bip32PrivateKey.from_bip39_entropy(
                entropyBytes,
                Buffer.from('')
            );

            logger.debug('Wallet initialized from mnemonic successfully', 'WalletKeyManager.initializeFromMnemonic');
            return true;
        } catch (error) {
            logger.error('Failed to initialize wallet from mnemonic', 'WalletKeyManager.initializeFromMnemonic', error);
            return false;
        }
    }

    /**
     * Create a new wallet account
     * @param accountIndex - Account index (0, 1, 2...)
     * @param name - Account name
     * @returns WalletAccount object
     */
    async createAccount(accountIndex: number = 0, name: string = `Account ${accountIndex + 1}`): Promise<WalletAccount> {
        if (!this.rootKey) {
            throw new Error('Wallet not initialized. Call initializeFromMnemonic first.');
        }

        try {
            // Derive account key following Cardano derivation path: m/1852'/1815'/accountIndex'
            const accountKey = this.rootKey
                .derive(hardenIndex(CARDANO_DERIVATION.PURPOSE)) // Purpose: BIP44
                .derive(hardenIndex(CARDANO_DERIVATION.COIN_TYPE)) // Coin type: Cardano
                .derive(hardenIndex(accountIndex)); // Account

            // Generate first receiving address (external, index 0)
            const firstAddress = await this.generateAddress(accountKey, 0, 0);

            logger.debug('Account created successfully', 'WalletKeyManager.createAccount', { 
                accountIndex, 
                name,
                address: firstAddress 
            });

            return {
                id: `account-${accountIndex}`,
                name,
                address: firstAddress, // Primary address
                balance: '0',
                stakeAddress: await this.generateStakeAddress(accountIndex),
                isActive: true,
                createdAt: new Date(),
                // Extended properties for wallet management
                accountIndex,
                addresses: [firstAddress],
                derivationPath: `m/1852'/1815'/${accountIndex}'`
            } as WalletAccount & {
                accountIndex: number;
                addresses: string[];
                derivationPath: string;
            };
        } catch (error) {
            logger.error('Failed to create account', 'WalletKeyManager.createAccount', error);
            throw new Error(`Failed to create account: ${error}`);
        }
    }

    /**
     * Generate a new address for an account
     * @param accountIndex - Account index
     * @param addressIndex - Address index
     * @param isChange - Whether this is a change address (internal=1, external=0)
     * @returns Cardano address string
     */
    async generateNewAddress(accountIndex: number, addressIndex: number, isChange: boolean = false): Promise<string> {
        if (!this.rootKey) {
            throw new Error('Wallet not initialized');
        }

        try {
            // Derive account key
            const accountKey = this.rootKey
                .derive(hardenIndex(CARDANO_DERIVATION.PURPOSE))
                .derive(hardenIndex(CARDANO_DERIVATION.COIN_TYPE))
                .derive(hardenIndex(accountIndex));

            // Generate address
            const changeIndex = isChange ? CARDANO_DERIVATION.INTERNAL_CHAIN : CARDANO_DERIVATION.EXTERNAL_CHAIN;
            const address = await this.generateAddress(accountKey, changeIndex, addressIndex);

            logger.debug('New address generated', 'WalletKeyManager.generateNewAddress', {
                accountIndex,
                addressIndex,
                isChange,
                address
            });

            return address;
        } catch (error) {
            logger.error('Failed to generate new address', 'WalletKeyManager.generateNewAddress', error);
            throw new Error(`Failed to generate address: ${error}`);
        }
    }

    /**
     * Get payment signing key for transaction signing
     * @param accountIndex - Account index
     * @param addressIndex - Address index  
     * @param isChange - Whether this is a change address
     * @returns Payment private key
     */
    async getPaymentSigningKey(accountIndex: number, addressIndex: number = 0, isChange: boolean = false): Promise<any> {
        // Load CSL library lazily  
        await getCSL();
        
        if (!this.rootKey) {
            throw new Error('Wallet not initialized');
        }

        try {
            const accountKey = this.rootKey
                .derive(hardenIndex(CARDANO_DERIVATION.PURPOSE))
                .derive(hardenIndex(CARDANO_DERIVATION.COIN_TYPE))
                .derive(hardenIndex(accountIndex));

            const changeIndex = isChange ? CARDANO_DERIVATION.INTERNAL_CHAIN : CARDANO_DERIVATION.EXTERNAL_CHAIN;
            const paymentKey = accountKey
                .derive(changeIndex)
                .derive(addressIndex);

            return paymentKey;
        } catch (error) {
            logger.error('Failed to get payment signing key', 'WalletKeyManager.getPaymentSigningKey', error);
            throw new Error(`Failed to get signing key: ${error}`);
        }
    }

    /**
     * Get stake signing key for delegation transactions
     * @param accountIndex - Account index
     * @returns Stake private key
     */
    async getStakeSigningKey(accountIndex: number): Promise<any> {
        // Load CSL library lazily
        await getCSL();
        
        if (!this.rootKey) {
            throw new Error('Wallet not initialized');
        }

        try {
            const stakeKey = this.rootKey
                .derive(hardenIndex(CARDANO_DERIVATION.PURPOSE))
                .derive(hardenIndex(CARDANO_DERIVATION.COIN_TYPE))
                .derive(hardenIndex(accountIndex))
                .derive(CARDANO_DERIVATION.STAKING_CHAIN) // Stake key derivation
                .derive(CARDANO_DERIVATION.STAKING_KEY_INDEX);

            return stakeKey;
        } catch (error) {
            logger.error('Failed to get stake signing key', 'WalletKeyManager.getStakeSigningKey', error);
            throw new Error(`Failed to get stake signing key: ${error}`);
        }
    }

    /**
     * Clear sensitive cryptographic data from memory
     */
    clearSensitiveData(): void {
        try {
            if (this.rootKey) {
                MemoryUtils.secureCleanup(this.rootKey);
                this.rootKey = undefined;
            }

            // Force garbage collection if available
            if (typeof global !== 'undefined' && global.gc) {
                global.gc();
            }

            logger.debug('Sensitive cryptographic data cleared from memory', 'WalletKeyManager.clearSensitiveData');
        } catch (error) {
            logger.warn('Failed to clear sensitive data', 'WalletKeyManager.clearSensitiveData', error);
        }
    }

    /**
     * Check if wallet is initialized
     */
    isInitialized(): boolean {
        return !!this.rootKey;
    }

    /**
     * Get current network
     */
    getNetwork(): typeof CARDANO_NETWORKS.MAINNET | typeof CARDANO_NETWORKS.TESTNET {
        return this.network;
    }

    /**
     * Set network (will clear existing keys for security)
     */
    setNetwork(networkType: 'mainnet' | 'testnet'): void {
        // Clear existing keys when switching networks for security
        this.clearSensitiveData();
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
        
        logger.info('Network changed', 'WalletKeyManager.setNetwork', { networkType });
    }

    // Private helper methods

    /**
     * Harden derivation index (add 0x80000000)
     */
    private harden(index: number): number {
        return index | 0x80000000;
    }

    /**
     * Generate Cardano address from account key and derivation path
     */
    private async generateAddress(accountKey: any, changeIndex: number, addressIndex: number): Promise<string> {
        try {
            // Load CSL library lazily
            const { StakeCredential, BaseAddress } = await getCSL();
            
            // Derive payment key
            const paymentKey = accountKey
                .derive(changeIndex)
                .derive(addressIndex);

            // Derive stake key (always use index 0 for stake key)
            const stakeKey = accountKey
                .derive(CARDANO_DERIVATION.STAKING_CHAIN) // Stake key derivation
                .derive(CARDANO_DERIVATION.STAKING_KEY_INDEX);

            // Create payment and stake credentials
            const paymentKeyHash = paymentKey.to_public().to_raw_key().hash();
            const stakeKeyHash = stakeKey.to_public().to_raw_key().hash();

            const paymentCredential = StakeCredential.from_keyhash(paymentKeyHash);
            const stakeCredential = StakeCredential.from_keyhash(stakeKeyHash);

            // Create base address
            const baseAddress = BaseAddress.new(
                this.network.networkId,
                paymentCredential,
                stakeCredential
            );

            return baseAddress.to_address().to_bech32();
        } catch (error) {
            logger.error('Failed to generate address', 'WalletKeyManager.generateAddress', error);
            throw new Error(`Address generation failed: ${error}`);
        }
    }

    /**
     * Generate stake address for account
     * @param accountIndex - Account index for derivation
     * @returns Stake address (reward address)
     */
    private async generateStakeAddress(accountIndex: number): Promise<string> {
        try {
            // Load CSL library lazily
            const { StakeCredential, RewardAddress } = await getCSL();
            
            if (!this.rootKey) {
                throw new Error('Root key not initialized');
            }

            // Derive stake account key using path: m/1852'/1815'/<account>'/2/0
            const stakeAccountKey = this.rootKey
                .derive(hardenIndex(CARDANO_DERIVATION.PURPOSE))    // purpose: multi-account hierarchy
                .derive(hardenIndex(CARDANO_DERIVATION.COIN_TYPE))    // coin type: ADA
                .derive(hardenIndex(accountIndex)) // account
                .derive(CARDANO_DERIVATION.STAKING_CHAIN)               // chain: staking key
                .derive(CARDANO_DERIVATION.STAKING_KEY_INDEX);              // address_index: first staking key

            const stakePrivateKey = stakeAccountKey.to_raw_key();
            const stakePublicKey = stakePrivateKey.to_public();
            const stakeKeyHash = stakePublicKey.hash();

            // Create stake credential
            const stakeCredential = StakeCredential.from_keyhash(stakeKeyHash);

            // Create reward address (stake address)
            const rewardAddress = RewardAddress.new(
                this.network.networkId,
                stakeCredential
            );

            const stakeAddr = rewardAddress.to_address().to_bech32();

            logger.debug('Generated stake address', 'WalletKeyManager.generateStakeAddress', {
                accountIndex,
                stakeAddress: stakeAddr,
                derivationPath: `m/1852'/1815'/${accountIndex}'/2/0`
            });

            return stakeAddr;

        } catch (error) {
            logger.error('Failed to generate stake address', 'WalletKeyManager.generateStakeAddress', {
                accountIndex,
                error
            });
            throw new Error(`Stake address generation failed: ${error}`);
        }
    }
}

export default WalletKeyManager;
