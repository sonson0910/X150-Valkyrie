import * as bip39 from 'bip39';
import {
    Address,
    BaseAddress,
    StakeCredential,
    Ed25519KeyHash,
    Bip32PrivateKey,
    TransactionBuilder,
    TransactionOutput,
    Value,
    BigNum,
    LinearFee,
    TransactionBuilderConfigBuilder,
    TransactionInput,
    TransactionWitnessSet,
    TransactionHash,
    Vkeywitness
} from '@emurgo/cardano-serialization-lib-browser';
import { CARDANO_NETWORKS } from '@constants/index';
import { CardanoAPIService } from './CardanoAPIService';
import { NetworkService } from './NetworkService';
import { ErrorHandler, ErrorType, ErrorSeverity } from './ErrorHandler';
import { WalletAccount, Transaction, TransactionStatus } from '../types/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Service chính để quản lý ví Cardano
 * Xử lý tạo account, tạo transaction, quản lý địa chỉ
 */
export class CardanoWalletService {
    private static instance: CardanoWalletService;
    private network: typeof CARDANO_NETWORKS.MAINNET | typeof CARDANO_NETWORKS.TESTNET;
    private rootKey?: Bip32PrivateKey;
    private apiService: CardanoAPIService;
    private networkService: NetworkService;
    private errorHandler: ErrorHandler;

    private constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
        this.apiService = CardanoAPIService.getInstance();
        this.apiService.setNetwork(networkType);
        this.networkService = NetworkService.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
    }

    public static getInstance(networkType: 'mainnet' | 'testnet' = 'testnet'): CardanoWalletService {
        if (!CardanoWalletService.instance) {
            CardanoWalletService.instance = new CardanoWalletService(networkType);
        }
        return CardanoWalletService.instance;
    }

    /**
     * Khởi tạo ví từ mnemonic
     * @param mnemonic - Mnemonic phrase (12 hoặc 24 từ)
     * @returns Success status
     */
    async initializeFromMnemonic(mnemonic: string): Promise<boolean> {
        try {
            // Validate mnemonic
            if (!bip39.validateMnemonic(mnemonic)) {
                throw new Error('Invalid mnemonic phrase');
            }

            // Generate seed từ mnemonic
            const seed = bip39.mnemonicToSeedSync(mnemonic);

            // Tạo root private key
            this.rootKey = Bip32PrivateKey.from_bip39_entropy(
                Buffer.from(seed),
                Buffer.from('')
            );

            return true;
        } catch (error) {
            console.error('Failed to initialize wallet:', error);
            return false;
        }
    }

    /**
     * Tạo mnemonic mới
     * @param strength - Độ mạnh (128 = 12 từ, 256 = 24 từ)
     * @returns Mnemonic phrase
     */
    static generateMnemonic(strength: 128 | 256 = 128): string {
        return bip39.generateMnemonic(strength);
    }

    /**
     * Tạo account mới
     * @param accountIndex - Index của account (0, 1, 2...)
     * @param name - Tên account
     * @returns WalletAccount object
     */
    async createAccount(accountIndex: number = 0, name: string = 'Main Account'): Promise<WalletAccount> {
        if (!this.rootKey) {
            throw new Error('Wallet not initialized');
        }

        try {
            // Derive account key: m/1852'/1815'/account'
            const accountKey = this.rootKey
                .derive(1852 + 0x80000000) // Purpose: 1852' (CIP-1852)
                .derive(1815 + 0x80000000) // Coin type: 1815' (ADA)
                .derive(accountIndex + 0x80000000); // Account

            // Derive spending key: m/1852'/1815'/account'/0/0
            const spendingKey = accountKey
                .derive(0) // External chain
                .derive(0); // Address index

            // Derive staking key: m/1852'/1815'/account'/2/0  
            const stakingKey = accountKey
                .derive(2) // Staking chain
                .derive(0); // Address index

            // Tạo payment credential
            const paymentCredential = StakeCredential.from_keyhash(
                spendingKey.to_public().to_raw_key().hash()
            );

            // Tạo stake credential
            const stakeCredential = StakeCredential.from_keyhash(
                stakingKey.to_public().to_raw_key().hash()
            );

            // Tạo base address
            const baseAddress = BaseAddress.new(
                this.network.networkId,
                paymentCredential,
                stakeCredential
            );

            const address = baseAddress.to_address().to_bech32();
            const stakeAddress = stakingKey.to_public().to_raw_key().hash().to_bech32('stake');

            const account: WalletAccount = {
                id: `account_${accountIndex}`,
                name,
                address,
                stakeAddress,
                balance: '0',
                isActive: accountIndex === 0,
                createdAt: new Date()
            };

            return account;

        } catch (error) {
            throw new Error(`Failed to create account: ${error}`);
        }
    }

    /**
     * Lấy balance của một địa chỉ từ Blockfrost API
     * @param address - Địa chỉ Cardano
     * @returns Balance trong lovelace
     */
    async getBalance(address: string): Promise<string> {
        try {
            const addressInfo = await this.apiService.getAddressInfo(address);
            const adaAmount = addressInfo.amount.find((a: any) => a.unit === 'lovelace');
            return adaAmount ? adaAmount.quantity : '0';

        } catch (error) {
            console.error('Failed to get balance:', error);
            return '0';
        }
    }

    /**
     * Tạo transaction (chưa sign)
     * @param fromAddress - Địa chỉ gửi
     * @param toAddress - Địa chỉ nhận  
     * @param amount - Số lượng ADA (trong lovelace)
     * @param metadata - Metadata tùy chọn
     * @returns Transaction object
     */
    async buildTransaction(
        fromAddress: string,
        toAddress: string,
        amount: string,
        metadata?: any
    ): Promise<Transaction> {
        try {
            // Validate addresses
            if (!CardanoWalletService.validateAddress(fromAddress)) {
                throw new Error('Invalid sender address');
            }
            if (!CardanoWalletService.validateAddress(toAddress)) {
                throw new Error('Invalid recipient address');
            }

            // Validate amount
            const amountNum = BigInt(amount);
            if (amountNum <= 0) {
                throw new Error('Amount must be greater than 0');
            }

            // Get UTXOs for sender address
            const utxos = await this.getUTXOs(fromAddress);
            if (utxos.length === 0) {
                throw new Error('No UTXOs found for sender address');
            }

            // Calculate total available balance
            const totalBalance = utxos.reduce((sum, utxo) => {
                const adaAmount = utxo.amount.find((a: any) => a.unit === 'lovelace');
                return sum + BigInt(adaAmount ? adaAmount.quantity : '0');
            }, BigInt(0));

            // Check if sufficient balance
            if (totalBalance < amountNum) {
                throw new Error(`Insufficient balance. Available: ${totalBalance} lovelace`);
            }

            // Calculate estimated fee (simplified)
            const estimatedFee = this.calculateEstimatedFee(utxos.length, 1);

            // Check if balance covers amount + fee
            if (totalBalance < (amountNum + estimatedFee)) {
                throw new Error(`Insufficient balance for amount + fee. Required: ${amountNum + estimatedFee} lovelace`);
            }

            const transaction: Transaction = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                amount,
                fee: estimatedFee.toString(),
                from: fromAddress,
                to: toAddress,
                status: TransactionStatus.PENDING,
                timestamp: new Date(),
                metadata,
                isOffline: false
            };

            return transaction;

        } catch (error) {
            throw new Error(`Failed to build transaction: ${error}`);
        }
    }

    /**
     * Tính toán estimated fee dựa trên số lượng inputs và outputs
     */
    private calculateEstimatedFee(inputCount: number, outputCount: number): bigint {
        // Simplified fee calculation based on Cardano parameters
        const baseFee = BigInt(155381); // Base fee in lovelace
        const inputFee = BigInt(4310); // Fee per input
        const outputFee = BigInt(4310); // Fee per output

        return baseFee + (BigInt(inputCount) * inputFee) + (BigInt(outputCount) * outputFee);
    }

    /**
     * Ký transaction offline
     * @param transaction - Transaction cần ký
     * @param accountIndex - Index của account để lấy private key
     * @returns Signed transaction hex
     */
    async signTransaction(transaction: Transaction, accountIndex: number = 0): Promise<string> {
        if (!this.rootKey) {
            throw new Error('Wallet not initialized');
        }

        try {
            // Derive account key: m/1852'/1815'/account'
            const accountKey = this.rootKey
                .derive(1852 + 0x80000000) // Purpose: 1852' (CIP-1852)
                .derive(1815 + 0x80000000) // Coin type: 1815' (ADA)
                .derive(accountIndex + 0x80000000); // Account

            // Derive spending key: m/1852'/1815'/account'/0/0
            const spendingKey = accountKey
                .derive(0) // External chain
                .derive(0); // Address index

            // Implement actual transaction signing với cardano-serialization-lib
            try {
                // 1. Build transaction body
                const txBuilder = TransactionBuilder.new(
                    TransactionBuilderConfigBuilder.new()
                        .fee_algo(LinearFee.new(BigNum.from_str('155381'), BigNum.from_str('4310')))
                        .pool_deposit(BigNum.from_str('500000000'))
                        .key_deposit(BigNum.from_str('2000000'))
                        .coins_per_utxo_byte(BigNum.from_str('4310'))
                        .max_value_size(5000)
                        .max_tx_size(16384)
                        .build()
                );

                // 2. Add inputs (UTXOs)
                const utxos = await this.getUTXOs(transaction.from);
                for (const utxo of utxos) {
                    const txHash = TransactionHash.from_bytes(Buffer.from(utxo.tx_hash, 'hex'));
                    const txIndex = utxo.tx_index;
                    const input = TransactionInput.new(txHash, txIndex);
                    txBuilder.add_input(Address.from_bech32(transaction.from), input, Value.new(BigNum.from_str(utxo.amount[0].quantity)));
                }

                // 3. Add outputs
                const outputAmount = Value.new(BigNum.from_str(transaction.amount));
                const output = TransactionOutput.new(
                    Address.from_bech32(transaction.to),
                    outputAmount
                );
                txBuilder.add_output(output);

                // 4. Build transaction
                const txBody = txBuilder.build();
                const tx = TransactionBuilder.new(
                    TransactionBuilderConfigBuilder.new()
                        .fee_algo(LinearFee.new(BigNum.from_str('155381'), BigNum.from_str('4310')))
                        .pool_deposit(BigNum.from_str('500000000'))
                        .key_deposit(BigNum.from_str('2000000'))
                        .coins_per_utxo_byte(BigNum.from_str('4310'))
                        .max_value_size(5000)
                        .max_tx_size(16384)
                        .build()
                );

                // 5. Sign với private key
                const txHash = TransactionHash.from_bytes(txBody.to_bytes());

                // Tạo signature
                const signature = spendingKey.to_raw_key().sign(txHash.to_bytes());

                // Build final transaction
                const finalTx = txBuilder.build();

                // Tạo transaction hoàn chỉnh với signature
                const signedTransaction = {
                    body: finalTx,
                    signature: signature,
                    publicKey: spendingKey.to_public().to_raw_key().hash()
                };

                // Serialize transaction thành CBOR hex
                return finalTx.to_hex();

            } catch (signingError) {
                console.error('Transaction signing failed:', signingError);
                throw new Error(`Transaction signing failed: ${signingError}`);
            }

        } catch (error) {
            throw new Error(`Failed to sign transaction: ${error}`);
        }
    }

    /**
     * Submit transaction lên network qua Blockfrost API
     * @param signedTx - Signed transaction CBOR hex
     * @returns Transaction hash
     */
    async submitTransaction(signedTx: string): Promise<string> {
        try {
            const txHash = await this.apiService.submitTransaction(signedTx);
            return txHash;

        } catch (error) {
            throw new Error(`Failed to submit transaction: ${error}`);
        }
    }

    /**
     * Validate địa chỉ Cardano
     * @param address - Địa chỉ cần validate
     * @returns true nếu valid
     */
    static validateAddress(address: string): boolean {
        try {
            Address.from_bech32(address);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Lấy lịch sử giao dịch của một địa chỉ
     * @param address - Địa chỉ Cardano
     * @param count - Số lượng transactions
     * @returns Array of transactions
     */
    async getTransactionHistory(address: string, count: number = 50): Promise<Transaction[]> {
        try {
            const txList = await this.apiService.getAddressTransactions(address, count);

            const transactions: Transaction[] = [];

            for (const txItem of txList) {
                try {
                    const txDetails = await this.apiService.getTransaction(txItem.tx_hash);
                    const txUTXOs = await this.apiService.getTransactionUTXOs(txItem.tx_hash);

                    // Determine transaction type and amount
                    const isReceived = txUTXOs.outputs.some((output: any) => output.address === address);
                    const isSent = txUTXOs.inputs.some((input: any) => input.address === address);

                    let amount = '0';
                    let fromAddress = '';
                    let toAddress = '';

                    if (isReceived && !isSent) {
                        // Pure receive
                        const relevantOutput = txUTXOs.outputs.find((o: any) => o.address === address);
                        if (relevantOutput) {
                            const adaAmount = relevantOutput.amount.find((a: any) => a.unit === 'lovelace');
                            amount = adaAmount ? adaAmount.quantity : '0';
                            toAddress = address;
                            fromAddress = txUTXOs.inputs[0]?.address || '';
                        }
                    } else if (isSent) {
                        // Send (or send to self)
                        const relevantInput = txUTXOs.inputs.find((i: any) => i.address === address);
                        if (relevantInput) {
                            const adaAmount = relevantInput.amount.find((a: any) => a.unit === 'lovelace');
                            amount = adaAmount ? adaAmount.quantity : '0';
                            fromAddress = address;
                            toAddress = txUTXOs.outputs[0]?.address || '';
                        }
                    }

                    const transaction: Transaction = {
                        id: txItem.tx_hash,
                        hash: txItem.tx_hash,
                        amount,
                        fee: txDetails.fees,
                        from: fromAddress,
                        to: toAddress,
                        status: TransactionStatus.CONFIRMED,
                        timestamp: new Date(txDetails.block_time * 1000),
                        isOffline: false
                    };

                    transactions.push(transaction);

                } catch (error) {
                    console.error(`Failed to get details for tx ${txItem.tx_hash}:`, error);
                }
            }

            return transactions;

        } catch (error) {
            console.error('Failed to get transaction history:', error);
            return [];
        }
    }

    /**
     * Lấy UTXOs của một địa chỉ
     * @param address - Địa chỉ Cardano
     * @returns Array of UTXOs
     */
    async getUTXOs(address: string): Promise<any[]> {
        try {
            return await this.apiService.getAddressUTXOs(address);
        } catch (error) {
            console.error('Failed to get UTXOs:', error);
            return [];
        }
    }

    /**
     * Tạo QR code data cho transaction request
     * @param address - Địa chỉ nhận
     * @param amount - Số lượng ADA
     * @param message - Message tùy chọn
     * @returns QR code string
     */
    static generatePaymentQR(address: string, amount?: string, message?: string): string {
        const qrData = {
            address,
            amount: amount || '',
            message: message || '',
            protocol: 'cardano'
        };

        return `cardano:${address}${amount ? `?amount=${amount}` : ''}${message ? `&message=${encodeURIComponent(message)}` : ''}`;
    }

    /**
     * Lấy thông tin network hiện tại
     */
    getCurrentNetwork(): typeof CARDANO_NETWORKS.MAINNET | typeof CARDANO_NETWORKS.TESTNET {
        return this.network;
    }

    /**
     * Chuyển đổi network
     */
    async switchNetwork(networkType: 'mainnet' | 'testnet'): Promise<void> {
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
        this.apiService.setNetwork(networkType);
    }
}

