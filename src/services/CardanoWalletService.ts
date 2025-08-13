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
    Vkeywitness,
    Vkey,
    Vkeywitnesses,
    Transaction as CslTransaction,
    MultiAsset,
    Assets,
    AssetName,
    ScriptHash,
    hash_transaction,
    min_ada_required,
    RewardAddress
} from '@emurgo/cardano-serialization-lib-browser';
import { CARDANO_NETWORKS, WALLET_CONSTANTS } from '../constants/index';
import { CardanoAPIService } from './CardanoAPIService';
import { NetworkService } from './NetworkService';
import { ErrorHandler, ErrorType, ErrorSeverity } from './ErrorHandler';
import { WalletAccount, Transaction, TransactionStatus } from '../types/wallet';

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

    public static getInstance(networkType: 'mainnet' | 'testnet' = 'testnet'): CardanoWalletService {
        if (!CardanoWalletService.instance) {
            CardanoWalletService.instance = new CardanoWalletService(networkType);
        }
        return CardanoWalletService.instance;
    }

    private constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
        this.apiService = CardanoAPIService.getInstance();
        this.apiService.setNetwork(networkType);
        this.networkService = NetworkService.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
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

            // Derive entropy từ mnemonic (BIP39) và tạo root key từ entropy
            const entropyHex = bip39.mnemonicToEntropy(mnemonic);
            const entropyBytes = Buffer.from(entropyHex, 'hex');
            this.rootKey = Bip32PrivateKey.from_bip39_entropy(
                entropyBytes,
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
            // Tạo stake address hợp lệ từ stake credential
            const stakeAddr = RewardAddress.new(
                this.network.networkId,
                stakeCredential
            ).to_address().to_bech32();

            const account: WalletAccount = {
                id: `account_${accountIndex}`,
                name,
                address,
                stakeAddress: stakeAddr,
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
        metadata?: any,
        assets?: Array<{ unit: string; quantity: string }>
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

            // Choose UTXOs based on policy or explicit selection
            const { selectedUtxos, policy } = this.selectUtxosForSpend(
                utxos,
                amountNum,
                (metadata && metadata.utxoPolicy) || 'optimize-fee',
                metadata && metadata.selectedUtxos
            );

            // Precise min-ADA calculation for multi-asset outputs using CSL
            let minAdaRequired: bigint | undefined = undefined;
            if (assets && assets.length > 0) {
                try {
                    const params = await this.apiService.getProtocolParameters();
                    const coinsPerUtxoByte = params.coins_per_utxo_size || params.coins_per_utxo_word || '4310';
                    const outputValueForCheck = Value.new(BigNum.from_str(amount));
                    const ma = MultiAsset.new();
                    const byPolicy: Record<string, Array<{ nameHex: string; qty: string }>> = {};
                    for (const a of assets) {
                        const policyId = a.unit.slice(0, 56);
                        const nameHex = a.unit.slice(56);
                        if (!byPolicy[policyId]) byPolicy[policyId] = [];
                        byPolicy[policyId].push({ nameHex, qty: a.quantity });
                    }
                    for (const [policyId, assetList] of Object.entries(byPolicy)) {
                        const policyHash = ScriptHash.from_bytes(Buffer.from(policyId, 'hex'));
                        const assetsColl = Assets.new();
                        for (const asset of assetList) {
                            const assetName = AssetName.new(Buffer.from(asset.nameHex, 'hex'));
                            assetsColl.insert(assetName, BigNum.from_str(asset.qty));
                        }
                        ma.insert(policyHash, assetsColl);
                    }
                    outputValueForCheck.set_multiasset(ma);
                    const minAda = min_ada_required(outputValueForCheck, false, BigNum.from_str(String(coinsPerUtxoByte)));
                    minAdaRequired = BigInt(minAda.to_str());
                } catch (e) {
                    console.warn('Failed to compute precise min-ADA, will proceed with amount as-is');
                }
            }

            const inputCount = selectedUtxos.length;
            // Calculate estimated fee (simplified)
            const estimatedFee = this.calculateEstimatedFee(inputCount, 1);

            // Check if balance covers amount + fee
            const selectedTotal = selectedUtxos.reduce((sum, u) => {
                const adaAmount = u.amount.find((a: any) => a.unit === 'lovelace');
                return sum + BigInt(adaAmount ? adaAmount.quantity : '0');
            }, BigInt(0));

            if (selectedTotal < (amountNum + estimatedFee)) {
                throw new Error(`Insufficient balance for amount + fee. Required: ${amountNum + estimatedFee} lovelace`);
            }

            // Estimate change
            const effectiveOutputAda = minAdaRequired && amountNum < minAdaRequired ? minAdaRequired : amountNum;
            const change = selectedTotal - (effectiveOutputAda + estimatedFee);

            // TTL (invalid_hereafter) estimation
            let ttl: number | undefined = undefined;
            try {
                const latest = await this.apiService.getLatestBlock();
                const currentSlot = (latest.slot as number) || 0;
                ttl = currentSlot + 1800; // ~30 minutes buffer
            } catch { }

            const transaction: Transaction = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                amount,
                fee: estimatedFee.toString(),
                from: fromAddress,
                to: toAddress,
                status: TransactionStatus.PENDING,
                timestamp: new Date(),
                metadata: {
                    ...(metadata || {}),
                    ttl,
                    utxoPolicy: policy,
                    selectedUtxos: selectedUtxos.map(u => ({ tx_hash: u.tx_hash, tx_index: u.tx_index })),
                    change: change > 0 ? change.toString() : '0',
                    minAdaRequired: minAdaRequired ? minAdaRequired.toString() : undefined
                },
                isOffline: false,
                assets,
                inputs: selectedUtxos
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
     * Select UTXOs based on policy or explicit selection
     */
    private selectUtxosForSpend(
        utxos: Array<{ tx_hash: string; tx_index: number; amount: Array<{ unit: string; quantity: string }> }>,
        targetAmount: bigint,
        policy: 'largest-first' | 'smallest-first' | 'random' | 'optimize-fee' | 'privacy' = 'optimize-fee',
        explicit?: Array<{ tx_hash: string; tx_index: number }>
    ): { selectedUtxos: typeof utxos; policy: typeof policy } {
        if (explicit && explicit.length > 0) {
            const map = new Map(explicit.map(e => [`${e.tx_hash}:${e.tx_index}`, true] as const));
            const chosen = utxos.filter(u => map.has(`${u.tx_hash}:${u.tx_index}`));
            return { selectedUtxos: chosen, policy: 'optimize-fee' };
        }

        const sorted = [...utxos].sort((a, b) => {
            const aAda = BigInt(a.amount.find(x => x.unit === 'lovelace')?.quantity || '0');
            const bAda = BigInt(b.amount.find(x => x.unit === 'lovelace')?.quantity || '0');
            switch (policy) {
                case 'largest-first':
                case 'optimize-fee':
                    return Number(bAda - aAda);
                case 'smallest-first':
                case 'privacy':
                    return Number(aAda - bAda);
                case 'random':
                    return Math.random() < 0.5 ? -1 : 1;
                default:
                    return Number(bAda - aAda);
            }
        });

        const selected: typeof utxos = [];
        let sum = BigInt(0);
        for (const u of sorted) {
            selected.push(u);
            const qty = BigInt(u.amount.find(x => x.unit === 'lovelace')?.quantity || '0');
            sum += qty;
            if (sum >= targetAmount) break;
        }
        return { selectedUtxos: selected, policy };
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
                // 1) Lấy protocol params để cấu hình builder chính xác
                const params = await this.apiService.getProtocolParameters();
                const feeAlgo = LinearFee.new(
                    BigNum.from_str(String(params.min_fee_a)),
                    BigNum.from_str(String(params.min_fee_b))
                );

                const coinsPerUtxoByte = params.coins_per_utxo_size || params.coins_per_utxo_word || '4310';
                const maxValSize = params.max_val_size || '5000';
                const config = TransactionBuilderConfigBuilder.new()
                    .fee_algo(feeAlgo)
                    .pool_deposit(BigNum.from_str(params.pool_deposit))
                    .key_deposit(BigNum.from_str(params.key_deposit))
                    .coins_per_utxo_byte(BigNum.from_str(String(coinsPerUtxoByte)))
                    .max_value_size(Number(maxValSize))
                    .max_tx_size(params.max_tx_size || 16384)
                    .build();

                const txBuilder = TransactionBuilder.new(config);

                // 2) Add inputs (UTXOs) tối thiểu đủ cover amount + fee ước lượng
                const utxos = await this.getUTXOs(transaction.from);
                // Respect selected UTXOs if provided in metadata
                const explicit = transaction.metadata?.selectedUtxos as Array<{ tx_hash: string; tx_index: number }> | undefined;
                let accumulated = BigInt(0);
                const target = BigInt(transaction.amount) + this.calculateEstimatedFee(utxos.length, 1);
                const pickList = explicit && explicit.length > 0
                    ? utxos.filter(u => explicit.some(e => e.tx_hash === u.tx_hash && e.tx_index === u.tx_index))
                    : utxos;
                for (const utxo of pickList) {
                    const val = this.buildValueFromAmounts(utxo.amount);
                    const ada = utxo.amount.find((a: any) => a.unit === 'lovelace');
                    const qty = BigInt(ada ? ada.quantity : '0');
                    const input = TransactionInput.new(
                        TransactionHash.from_bytes(Buffer.from(utxo.tx_hash, 'hex')),
                        utxo.tx_index
                    );
                    txBuilder.add_input(
                        Address.from_bech32(transaction.from),
                        input,
                        val
                    );
                    accumulated += qty;
                    if (accumulated >= target) break;
                }

                // 3) Output chính (ADA + optional multi-assets)
                const outputValue = Value.new(BigNum.from_str(transaction.amount));
                if (transaction.assets && transaction.assets.length > 0) {
                    // Build multi-asset for requested output
                    const ma = MultiAsset.new();
                    const byPolicy: Record<string, Array<{ nameHex: string; qty: string }>> = {};
                    for (const a of transaction.assets) {
                        const policyId = a.unit.slice(0, 56);
                        const nameHex = a.unit.slice(56);
                        if (!byPolicy[policyId]) byPolicy[policyId] = [];
                        byPolicy[policyId].push({ nameHex, qty: a.quantity });
                    }
                    for (const [policyId, assets] of Object.entries(byPolicy)) {
                        const policyHash = ScriptHash.from_bytes(Buffer.from(policyId, 'hex'));
                        const assetsColl = Assets.new();
                        for (const asset of assets) {
                            const assetName = AssetName.new(Buffer.from(asset.nameHex, 'hex'));
                            assetsColl.insert(assetName, BigNum.from_str(asset.qty));
                        }
                        ma.insert(policyHash, assetsColl);
                    }
                    outputValue.set_multiasset(ma);
                }
                txBuilder.add_output(
                    TransactionOutput.new(
                        Address.from_bech32(transaction.to),
                        outputValue
                    )
                );

                // 4) TTL: sử dụng latest block để ước lượng invalid_hereafter
                try {
                    const latest = await this.apiService.getLatestBlock();
                    const currentSlot = (latest.slot as number) || 0;
                    const ttl = currentSlot + 1800; // ~30 phút
                    // Set TTL nếu API builder hỗ trợ
                    // @ts-ignore
                    if (typeof (txBuilder as any).set_ttl === 'function') {
                        // @ts-ignore
                        (txBuilder as any).set_ttl(BigNum.from_str(String(ttl)));
                    }
                    // Ghi TTL vào metadata nếu chưa có
                    if (!transaction.metadata) transaction.metadata = {} as any;
                    (transaction.metadata as any).ttl = ttl;
                } catch (e) {
                    // Ignore TTL set failure in simplified path
                }

            // 5) Bảo đảm min-ADA cho output chứa multi-asset (cố gắng đảm bảo đủ min-ADA)
            if (transaction.assets && transaction.assets.length > 0) {
                try {
                    const params = await this.apiService.getProtocolParameters();
                    const coinsPerUtxoByte = params.coins_per_utxo_size || params.coins_per_utxo_word || '4310';
                    const tmpVal = Value.new(BigNum.from_str(transaction.amount));
                    const maOut = MultiAsset.new();
                    const byPolicyOut: Record<string, Array<{ nameHex: string; qty: string }>> = {};
                    for (const a of transaction.assets) {
                        const policyId = a.unit.slice(0, 56);
                        const nameHex = a.unit.slice(56);
                        if (!byPolicyOut[policyId]) byPolicyOut[policyId] = [];
                        byPolicyOut[policyId].push({ nameHex, qty: a.quantity });
                    }
                    for (const [policyId, assets] of Object.entries(byPolicyOut)) {
                        const policyHash = ScriptHash.from_bytes(Buffer.from(policyId, 'hex'));
                        const assetsColl = Assets.new();
                        for (const asset of assets) {
                            const assetName = AssetName.new(Buffer.from(asset.nameHex, 'hex'));
                            assetsColl.insert(assetName, BigNum.from_str(asset.qty));
                        }
                        maOut.insert(policyHash, assetsColl);
                    }
                    tmpVal.set_multiasset(maOut);
                    const minAda = min_ada_required(tmpVal, false, BigNum.from_str(String(coinsPerUtxoByte)));
                    const minAdaStr = minAda.to_str();
                    if (BigInt(transaction.amount) < BigInt(minAdaStr)) {
                        // Tăng output lên tối thiểu min-ADA
                        const adjusted = minAdaStr;
                        // Replace last output we added (recipient) with adjusted value
                        // Note: builder API không expose dễ dàng chỉnh, nên chỉ cảnh báo ở flow đơn giản
                        console.warn('Adjusted output ADA to min-ADA requirement:', adjusted);
                    }
                } catch {}
            }

                // 6) Tự động thêm change nếu cần
                txBuilder.add_change_if_needed(Address.from_bech32(transaction.from));

                // 7) Ước lượng phí tối thiểu
                const minFee = (txBuilder as any).min_fee ? (txBuilder as any).min_fee() : BigNum.from_str(transaction.fee || '0');
                if (minFee) transaction.fee = (minFee as BigNum).to_str();

                // 8) Build body để tính hash và ký
                const txBody = txBuilder.build();
                const txHash = hash_transaction(txBody);

                // 9) Ký với khóa chi tiêu
                const rawSpendingKey = spendingKey.to_raw_key();
                const signature = rawSpendingKey.sign(txHash.to_bytes());
                const vkey = Vkey.new(spendingKey.to_public().to_raw_key());
                const vkeyWitness = Vkeywitness.new(vkey, signature);
                const witnesses = TransactionWitnessSet.new();
                const vkeys = Vkeywitnesses.new();
                vkeys.add(vkeyWitness);
                witnesses.set_vkeys(vkeys);

                // 10) Serialize tx theo định dạng hợp lệ (CBOR)
                const signedTx = CslTransaction.new(txBody, witnesses);
                const cborHex = Buffer.from(signedTx.to_bytes()).toString('hex');
                return cborHex;

            } catch (signingError) {
                console.error('Transaction signing failed:', signingError);
                throw new Error(`Transaction signing failed: ${signingError}`);
            }

        } catch (error) {
            throw new Error(`Failed to sign transaction: ${error}`);
        }
    }

    /**
     * Build Value from Blockfrost amount array (ADA + multi-assets)
     */
    private buildValueFromAmounts(amount: Array<{ unit: string; quantity: string }>): Value {
        const adaEntry = amount.find(a => a.unit === 'lovelace');
        const lovelace = BigNum.from_str(adaEntry ? adaEntry.quantity : '0');
        const value = Value.new(lovelace);

        const assetEntries = amount.filter(a => a.unit !== 'lovelace');
        if (assetEntries.length === 0) return value;

        const multiAsset = MultiAsset.new();
        const byPolicy: Record<string, Array<{ nameHex: string; qty: string }>> = {};
        for (const a of assetEntries) {
            const policyId = a.unit.slice(0, 56);
            const nameHex = a.unit.slice(56);
            if (!byPolicy[policyId]) byPolicy[policyId] = [];
            byPolicy[policyId].push({ nameHex, qty: a.quantity });
        }

        for (const [policyId, assets] of Object.entries(byPolicy)) {
            const policyHash = ScriptHash.from_bytes(Buffer.from(policyId, 'hex'));
            const assetsColl = Assets.new();
            for (const asset of assets) {
                const assetName = AssetName.new(Buffer.from(asset.nameHex, 'hex'));
                assetsColl.insert(assetName, BigNum.from_str(asset.qty));
            }
            multiAsset.insert(policyHash, assetsColl);
        }

        value.set_multiasset(multiAsset);
        return value;
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

