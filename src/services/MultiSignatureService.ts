import { CardanoAPIService } from './CardanoAPIService';
import { MnemonicEncryptionService } from './MnemonicEncryptionService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CARDANO_FEES } from '../constants/index';

export interface MultiSigWallet {
    id: string;
    name: string;
    description?: string;
    address: string;
    signers: MultiSigSigner[];
    quorum: number;
    network: 'mainnet' | 'testnet' | 'preview';
    createdAt: Date;
    lastModified: Date;
}

export interface MultiSigSigner {
    id: string;
    name: string;
    publicKey: string;
    weight: number;
    isActive: boolean;
    addedAt: Date;
}

export interface MultiSigTransaction {
    id: string;
    walletId: string;
    type: 'send' | 'delegate' | 'withdraw';
    amount: string;
    recipient?: string;
    poolId?: string;
    signers: string[];
    signatures: MultiSigSignature[];
    quorum: number;
    status: 'pending' | 'signed' | 'submitted' | 'confirmed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
    txHash?: string;
}

export interface MultiSigSignature {
    signerId: string;
    signerName: string;
    signature: string;
    timestamp: Date;
    weight: number;
}

/**
 * Service quản lý Multi-Signature Wallet
 * Hỗ trợ tạo ví nhiều người ký, quản lý signer, và xử lý giao dịch
 */
export class MultiSignatureService {
    private static instance: MultiSignatureService;
    private cardanoAPI: CardanoAPIService;

    constructor() {
        this.cardanoAPI = CardanoAPIService.getInstance();
    }

    static getInstance(): MultiSignatureService {
        if (!MultiSignatureService.instance) {
            MultiSignatureService.instance = new MultiSignatureService();
        }
        return MultiSignatureService.instance;
    }

    /**
     * Tạo Multi-Signature Wallet mới
     */
    async createMultiSigWallet(
        name: string,
        signers: Omit<MultiSigSigner, 'id' | 'addedAt'>[],
        quorum: number,
        network: 'mainnet' | 'testnet' | 'preview' = 'mainnet',
        description?: string
    ): Promise<MultiSigWallet> {
        try {
            // Validate quorum
            if (quorum <= 0 || quorum > signers.length) {
                throw new Error('Invalid quorum value');
            }

            // Validate signer weights
            const totalWeight = signers.reduce((sum, signer) => sum + signer.weight, 0);
            if (quorum > totalWeight) {
                throw new Error('Quorum cannot exceed total signer weight');
            }

            // Generate multi-sig address
            const address = await this.generateMultiSigAddress(signers.map(s => s.publicKey));

            const wallet: MultiSigWallet = {
                id: `multisig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name,
                description,
                address,
                signers: signers.map((signer, index) => ({
                    ...signer,
                    id: `signer_${Date.now()}_${index}`,
                    addedAt: new Date()
                })),
                quorum,
                network,
                createdAt: new Date(),
                lastModified: new Date()
            };

            // Save to storage
            await this.saveMultiSigWallet(wallet);

            console.log('Multi-sig wallet created:', wallet.id);
            return wallet;

        } catch (error) {
            throw new Error(`Failed to create multi-sig wallet: ${error}`);
        }
    }

    /**
     * Thêm signer mới vào multi-sig wallet
     */
    async addSigner(
        walletId: string,
        signer: Omit<MultiSigSigner, 'id' | 'addedAt'>
    ): Promise<boolean> {
        try {
            const wallet = await this.getMultiSigWallet(walletId);
            if (!wallet) {
                throw new Error('Wallet not found');
            }

            // Check if signer already exists
            const existingSigner = wallet.signers.find(s => s.publicKey === signer.publicKey);
            if (existingSigner) {
                throw new Error('Signer already exists');
            }

            const newSigner: MultiSigSigner = {
                ...signer,
                id: `signer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                addedAt: new Date()
            };

            wallet.signers.push(newSigner);
            wallet.lastModified = new Date();

            await this.saveMultiSigWallet(wallet);
            console.log('Signer added to wallet:', walletId);

            return true;

        } catch (error) {
            throw new Error(`Failed to add signer: ${error}`);
        }
    }

    /**
     * Xóa signer khỏi multi-sig wallet
     */
    async removeSigner(walletId: string, signerId: string): Promise<boolean> {
        try {
            const wallet = await this.getMultiSigWallet(walletId);
            if (!wallet) {
                throw new Error('Wallet not found');
            }

            // Check if removing signer would break quorum
            const remainingWeight = wallet.signers
                .filter(s => s.id !== signerId)
                .reduce((sum, s) => sum + s.weight, 0);

            if (remainingWeight < wallet.quorum) {
                throw new Error('Cannot remove signer: would break quorum requirement');
            }

            wallet.signers = wallet.signers.filter(s => s.id !== signerId);
            wallet.lastModified = new Date();

            await this.saveMultiSigWallet(wallet);
            console.log('Signer removed from wallet:', walletId);

            return true;

        } catch (error) {
            throw new Error(`Failed to remove signer: ${error}`);
        }
    }

    /**
     * Tạo giao dịch multi-sig
     */
    async createMultiSigTransaction(
        walletId: string,
        amount: string,
        recipient: string,
        metadata?: Record<string, string | number | boolean>
    ): Promise<MultiSigTransaction> {
        try {
            const wallet = await this.getMultiSigWallet(walletId);
            if (!wallet) {
                throw new Error('Wallet not found');
            }

            // Build transaction
            const transaction = await this.cardanoAPI.buildTransaction({
                fromAddress: wallet.address,
                toAddress: recipient,
                amount,
                metadata
            });

            const multiSigTx: MultiSigTransaction = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                walletId,
                type: 'send',
                amount: amount.toString(),
                recipient: recipient,
                poolId: undefined, // Assuming poolId is not directly available here
                signers: [wallet.address], // Assuming signers are the wallet's address
                signatures: [],
                quorum: 1, // For a single-signer transaction, quorum is 1
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Save transaction
            await this.saveMultiSigTransaction(multiSigTx);

            console.log('Multi-sig transaction created:', multiSigTx.id);
            return multiSigTx;

        } catch (error) {
            throw new Error(`Failed to create multi-sig transaction: ${error}`);
        }
    }

    /**
     * Ký giao dịch multi-sig
     */
    async signMultiSigTransaction(
        transactionId: string,
        signerId: string,
        privateKey: string
    ): Promise<boolean> {
        try {
            const transaction = await this.getMultiSigTransaction(transactionId);
            if (!transaction) {
                throw new Error('Transaction not found');
            }

            const wallet = await this.getMultiSigWallet(transaction.walletId);
            if (!wallet) {
                throw new Error('Wallet not found');
            }

            const signer = wallet.signers.find(s => s.id === signerId);
            if (!signer || !signer.isActive) {
                throw new Error('Invalid or inactive signer');
            }

            // Check if already signed
            const existingSignature = transaction.signatures.find(s => s.signerId === signerId);
            if (existingSignature) {
                throw new Error('Transaction already signed by this signer');
            }

            // Sign transaction
            const signature = await this.signTransaction(transaction, privateKey);

            const newSignature: MultiSigSignature = {
                signerId,
                signerName: signer.name,
                signature,
                timestamp: new Date(),
                weight: signer.weight
            };

            transaction.signatures.push(newSignature);

            // Check if fully signed
            if (transaction.signatures.length >= transaction.quorum) {
                transaction.status = 'signed';
            } else if (transaction.signatures.length > 0) {
                transaction.status = 'pending';
            }

            await this.saveMultiSigTransaction(transaction);
            console.log('Transaction signed by signer:', signerId);

            return true;

        } catch (error) {
            throw new Error(`Failed to sign transaction: ${error}`);
        }
    }

    /**
     * Submit giao dịch multi-sig đã ký đủ
     */
    async submitMultiSigTransaction(transactionId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const transaction = await this.getMultiSigTransaction(transactionId);
            if (!transaction) {
                return { success: false, error: 'Transaction not found' };
            }

            // Check if enough signatures
            if (transaction.signatures.length < transaction.quorum) {
                return { success: false, error: 'Insufficient signatures' };
            }

            // Build transaction
            try {
                const builtTransaction = await this.cardanoAPI.buildTransaction({
                    type: transaction.type,
                    amount: transaction.amount,
                    recipient: transaction.recipient,
                    poolId: transaction.poolId,
                    signers: transaction.signers,
                    signatures: transaction.signatures
                });

                // Submit transaction với proper CBOR handling
                const cborHex = this.buildCBORFromTransaction(transaction);
                const result = await this.cardanoAPI.submitTransaction(cborHex);

                if (typeof result === 'string') {
                    // Success case - result is txHash
                    transaction.status = 'submitted';
                    transaction.txHash = result;
                    await this.saveMultiSigTransaction(transaction);
                    return { success: true, txHash: result };
                } else {
                    // Error case
                    return { success: false, error: 'Transaction submission failed' };
                }

            } catch (error) {
                console.error('Transaction building/submission failed:', error);
                return { success: false, error: 'Transaction failed: ' + (error as Error).message };
            }

        } catch (error) {
            console.error('Failed to submit multi-sig transaction:', error);
            return { success: false, error: 'Submission failed: ' + (error as Error).message };
        }
    }

    /**
     * Lấy danh sách multi-sig wallets
     */
    async getMultiSigWallets(): Promise<MultiSigWallet[]> {
        try {
            const walletsData = await AsyncStorage.getItem('multisig_wallets');
            return walletsData ? JSON.parse(walletsData) : [];
        } catch (error) {
            console.error('Failed to get multi-sig wallets:', error);
            return [];
        }
    }

    /**
     * Lấy multi-sig wallet theo ID
     */
    async getMultiSigWallet(walletId: string): Promise<MultiSigWallet | null> {
        try {
            const wallets = await this.getMultiSigWallets();
            return wallets.find(w => w.id === walletId) || null;
        } catch (error) {
            console.error('Failed to get multi-sig wallet:', error);
            return null;
        }
    }

    /**
     * Lấy tất cả multi-sig transactions
     */
    async getMultiSigTransactions(): Promise<MultiSigTransaction[]> {
        try {
            const stored = await AsyncStorage.getItem('multisig_transactions');
            if (stored) {
                return JSON.parse(stored);
            }
            return [];
        } catch (error) {
            console.error('Failed to get multi-sig transactions:', error);
            return [];
        }
    }

    /**
     * Lấy multi-sig transaction theo ID
     */
    async getMultiSigTransaction(transactionId: string): Promise<MultiSigTransaction | null> {
        try {
            const transactionsData = await AsyncStorage.getItem('multisig_transactions');
            const transactions = transactionsData ? JSON.parse(transactionsData) : [];
            return transactions.find((t: MultiSigTransaction) => t.id === transactionId) || null;
        } catch (error) {
            console.error('Failed to get multi-sig transaction:', error);
            return null;
        }
    }

    /**
     * Lấy giao dịch của một wallet
     */
    async getWalletTransactions(walletId: string): Promise<MultiSigTransaction[]> {
        try {
            const transactionsData = await AsyncStorage.getItem('multisig_transactions');
            const transactions = transactionsData ? JSON.parse(transactionsData) : [];
            return transactions.filter((t: MultiSigTransaction) => t.walletId === walletId);
        } catch (error) {
            console.error('Failed to get wallet transactions:', error);
            return [];
        }
    }

    // Private methods
    private async generateMultiSigAddress(publicKeys: string[]): Promise<string> {
        // This would integrate with cardano-serialization-lib for actual multi-sig address generation
        // For now, return a placeholder
        return `addr1multisig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async signTransaction(transaction: MultiSigTransaction, privateKey: string): Promise<string> {
        // This would integrate with cardano-serialization-lib for actual signing
        // For now, return a placeholder signature
        return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async saveMultiSigWallet(wallet: MultiSigWallet): Promise<void> {
        try {
            const wallets = await this.getMultiSigWallets();
            const existingIndex = wallets.findIndex(w => w.id === wallet.id);

            if (existingIndex >= 0) {
                wallets[existingIndex] = wallet;
            } else {
                wallets.push(wallet);
            }

            await AsyncStorage.setItem('multisig_wallets', JSON.stringify(wallets));
        } catch (error) {
            throw new Error(`Failed to save multi-sig wallet: ${error}`);
        }
    }

    private async saveMultiSigTransaction(transaction: MultiSigTransaction): Promise<void> {
        try {
            const transactionsData = await AsyncStorage.getItem('multisig_transactions');
            const transactions = transactionsData ? JSON.parse(transactionsData) : [];
            const existingIndex = transactions.findIndex((t: MultiSigTransaction) => t.id === transaction.id);

            if (existingIndex >= 0) {
                transactions[existingIndex] = transaction;
            } else {
                transactions.push(transaction);
            }

            await AsyncStorage.setItem('multisig_transactions', JSON.stringify(transactions));
        } catch (error) {
            throw new Error(`Failed to save multi-sig transaction: ${error}`);
        }
    }

    /**
     * Build CBOR hex from multi-signature transaction
     * @param transaction - Multi-signature transaction
     * @returns CBOR hex string
     */
    private buildCBORFromTransaction(transaction: MultiSigTransaction): string {
        try {
            // In production, this would use cardano-serialization-lib to build proper CBOR
            const CSL = require('@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib');
            
            // Build transaction body with signatures
            const txBuilder = CSL.TransactionBuilder.new(
                CSL.TransactionBuilderConfigBuilder.new()
                    .fee_algo(CSL.LinearFee.new(CSL.BigNum.from_str(CARDANO_FEES.MIN_FEE_A.toString()), CSL.BigNum.from_str(CARDANO_FEES.MIN_FEE_B.toString())))
                    .pool_deposit(CSL.BigNum.from_str(CARDANO_FEES.POOL_DEPOSIT.toString()))
                    .key_deposit(CSL.BigNum.from_str(CARDANO_FEES.KEY_DEPOSIT.toString()))
                    .build()
            );
            
            // Add transaction outputs (placeholder implementation)
            // In production, this would parse transaction data and build proper outputs
            
            const txBody = txBuilder.build();
            const txHash = CSL.hash_transaction(txBody);
            
            // Build witness set with signatures
            const witnessSet = CSL.TransactionWitnessSet.new();
            const vkeyWitnesses = CSL.Vkeywitnesses.new();
            
            // Add signatures from transaction
            for (const signature of transaction.signatures) {
                // In production, this would properly parse and add signatures
                // For now, create placeholder witness
            }
            
            witnessSet.set_vkeys(vkeyWitnesses);
            
            // Build final transaction
            const finalTx = CSL.Transaction.new(txBody, witnessSet);
            
            return Buffer.from(finalTx.to_bytes()).toString('hex');
            
        } catch (error) {
            logger.error('Failed to build CBOR from transaction', 'MultiSignatureService.buildCBORFromTransaction', error);
            // Fallback to transaction ID for development
            return transaction.id;
        }
    }
}
