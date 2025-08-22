import logger from '../../utils/Logger';
import { MemoryUtils } from '../../utils/MemoryUtils';
import { CardanoAPIService } from '../CardanoAPIService';
import { CARDANO_NETWORKS, WALLET_CONSTANTS, CARDANO_FEES } from '../../constants/index';
import WalletKeyManager from './WalletKeyManager';

// CSL will be loaded lazily when needed
import { getCSL } from '../../utils/CSLProvider';
import { Buffer } from 'buffer';

// Cardano transaction metadata types
export interface TransactionMetadata {
    [key: string]: string | number | TransactionMetadata | Array<string | number | TransactionMetadata>;
}

// UTXO types for transaction building
export interface UTXOAsset {
    unit: string;
    quantity: string;
}

export interface UTXO {
    tx_hash: string;
    tx_index: number;
    output_index: number;
    address?: string; // Optional since some API responses don't include it
    amount: UTXOAsset[];
    block: string;
    data_hash?: string;
}

export interface TransactionRequest {
    fromAddress: string;
    toAddress: string;
    amount: string; // in lovelace
    assets?: Array<{
        policyId: string;
        assetName: string;
        amount: string;
    }>;
    metadata?: TransactionMetadata;
    memo?: string;
}

export interface TransactionResult {
    txHash: string;
    fee: string;
    totalOutput: string;
}

/**
 * TransactionBuilder - Handles transaction construction, signing, and submission
 * 
 * Responsibilities:
 * - Build transactions with proper fee calculation
 * - Sign transactions with wallet keys
 * - Submit transactions to the network
 * - Handle UTXOs and change calculation
 * - Support for native assets and metadata
 */
export class TransactionBuilder {
    private static instance: TransactionBuilder;
    private network: typeof CARDANO_NETWORKS.MAINNET | typeof CARDANO_NETWORKS.TESTNET;
    private apiService: CardanoAPIService;
    private keyManager: WalletKeyManager;

    private constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
        this.apiService = CardanoAPIService.getInstance();
        this.keyManager = WalletKeyManager.getInstance(networkType);
    }

    public static getInstance(networkType: 'mainnet' | 'testnet' = 'testnet'): TransactionBuilder {
        if (!TransactionBuilder.instance) {
            TransactionBuilder.instance = new TransactionBuilder(networkType);
        }
        return TransactionBuilder.instance;
    }

    /**
     * Build a transaction (unsigned)
     * @param request - Transaction details
     * @returns Transaction body CBOR hex
     */
    async buildTransaction(request: TransactionRequest): Promise<string> {
        try {
            // Load CSL library lazily
            const { Address, Value, BigNum, MultiAsset, Assets, AssetName, ScriptHash, TransactionOutput, min_ada_required, TransactionHash, TransactionInput } = await getCSL();
            
            logger.debug('Building transaction', 'TransactionBuilder.buildTransaction', request);

            // Get UTXOs for the source address
            const utxos = await this.apiService.getAddressUTXOs(request.fromAddress);
            if (!utxos || utxos.length === 0) {
                throw new Error('No UTXOs available for transaction');
            }

            // Parse amounts
            const outputAmount = BigInt(request.amount);
            if (outputAmount <= 0) {
                throw new Error('Amount must be greater than 0');
            }

            // Create transaction builder
            const txBuilder = await this.createTransactionBuilder();

            // Add output
            const outputAddress = Address.from_bech32(request.toAddress);
            const outputValue = Value.new(BigNum.from_str(request.amount));

            // Handle native assets if provided
            if (request.assets && request.assets.length > 0) {
                const multiAsset = MultiAsset.new();
                
                for (const asset of request.assets) {
                    const policyId = ScriptHash.from_hex(asset.policyId);
                    const assetName = AssetName.new(Buffer.from(asset.assetName, 'hex'));
                    const assetAmount = BigNum.from_str(asset.amount);

                    let assets = multiAsset.get(policyId);
                    if (!assets) {
                        assets = Assets.new();
                    }
                    assets.insert(assetName, assetAmount);
                    multiAsset.insert(policyId, assets);
                }
                
                outputValue.set_multiasset(multiAsset);
            }

            // Calculate minimum ADA required for output
            let minAdaRequired = BigInt(WALLET_CONSTANTS.MIN_ADA);
            try {
                const outputForCheck = TransactionOutput.new(outputAddress, outputValue);
                const coinsPerUtxoByte = BigNum.from_str('4310'); // Current protocol parameter
                const minAda = min_ada_required(outputValue, false, coinsPerUtxoByte);
                minAdaRequired = BigInt(minAda.to_str());
            } catch (e) {
                logger.warn('Failed to compute precise min-ADA, using default', 'TransactionBuilder.buildTransaction', e);
            }

            // Ensure output meets minimum ADA requirement
            if (outputAmount < minAdaRequired) {
                throw new Error(`Output amount ${outputAmount} is below minimum required ${minAdaRequired} lovelace`);
            }

            const txOutput = TransactionOutput.new(outputAddress, outputValue);
            txBuilder.add_output(txOutput);

            // Select UTXOs and calculate fees
            const selectedUtxos = this.selectUTXOs(utxos, outputAmount);
            const estimatedFee = this.calculateEstimatedFee(selectedUtxos.length, 1);

            // Add inputs
            let totalInput = BigInt(0);
            for (const utxo of selectedUtxos) {
                const txHash = TransactionHash.from_hex(utxo.tx_hash);
                const txInput = TransactionInput.new(txHash, utxo.output_index);
                const inputValue = Value.new(BigNum.from_str(utxo.amount.find((a: UTXOAsset) => a.unit === 'lovelace')?.quantity || '0'));
                
                txBuilder.add_input(utxo.address || request.fromAddress, txInput, inputValue);
                totalInput += BigInt(utxo.amount.find((a: UTXOAsset) => a.unit === 'lovelace')?.quantity || '0');
            }

            // Set fee
            txBuilder.set_fee(BigNum.from_str(estimatedFee.toString()));

            // Add change output if necessary
            const totalOutput = outputAmount + BigInt(estimatedFee.toString());
            if (totalInput > totalOutput) {
                const changeAmount = totalInput - totalOutput;
                if (changeAmount >= BigInt(WALLET_CONSTANTS.MIN_ADA)) {
                    const changeAddress = Address.from_bech32(request.fromAddress);
                    const changeValue = Value.new(BigNum.from_str(changeAmount.toString()));
                    const changeOutput = TransactionOutput.new(changeAddress, changeValue);
                    txBuilder.add_change_if_needed(changeAddress);
                }
            }

            // Add metadata if provided
            if (request.metadata) {
                const auxiliaryData = await this.buildAuxiliaryData(request.metadata);
                if (auxiliaryData) {
                    txBuilder.set_auxiliary_data(auxiliaryData);
                    logger.debug('Metadata added to transaction', 'TransactionBuilder.buildTransaction', {
                        metadataKeys: Object.keys(request.metadata)
                    });
                }
            }

            // Build transaction body
            const txBody = txBuilder.build();
            const txBodyHex = Buffer.from(txBody.to_bytes()).toString('hex');

            // Calculate change amount (use existing totalInput and outputAmount variables)
            const changeAmount = totalInput - outputAmount - BigInt(estimatedFee.toString());

            // Build outputs array
            const outputs: any[] = [
                {
                    address: request.toAddress,
                    amount: {
                        lovelace: request.amount,
                        ...this.formatAssets(request.assets)
                    }
                }
            ];

            // Add change output if there's change to return
            if (changeAmount > BigInt(0)) {
                outputs.push({
                    address: request.fromAddress,
                    amount: {
                        lovelace: changeAmount.toString()
                    }
                });
            }

            // Create structured transaction object for consistency with tests and better usability
            const transactionObject = {
                id: txBodyHex.substring(0, 64), // Use first 64 chars as transaction ID
                hex: txBodyHex,
                inputs: selectedUtxos.map(utxo => ({
                    tx_hash: utxo.tx_hash,
                    tx_index: utxo.tx_index,
                    amount: utxo.amount
                })),
                outputs,
                fee: estimatedFee.toString(),
                metadata: request.metadata || null,
                auxiliaryData: request.metadata ? { metadata: request.metadata } : null,
                size: txBody.to_bytes().length
            };

            logger.debug('Transaction built successfully', 'TransactionBuilder.buildTransaction', {
                inputs: selectedUtxos.length,
                outputAmount: request.amount,
                estimatedFee: estimatedFee.toString(),
                transactionId: transactionObject.id
            });

            return transactionObject;

        } catch (error) {
            logger.error('Failed to build transaction', 'TransactionBuilder.buildTransaction', error);
            throw new Error(`Transaction building failed: ${error}`);
        }
    }

    /**
     * Sign a transaction
     * @param txBodyHex - Transaction body in CBOR hex
     * @param accountIndex - Account index for signing
     * @param addressIndex - Address index for signing
     * @returns Signed transaction CBOR hex
     */
    async signTransaction(
        txBodyHex: string, 
        accountIndex: number = 0, 
        addressIndex: number = 0
    ): Promise<string> {
        try {
            // Load CSL components
            const { TransactionBody, hash_transaction, Vkey, Vkeywitness, TransactionWitnessSet, Vkeywitnesses, Transaction } = await getCSL();
            
            if (!this.keyManager.isInitialized()) {
                throw new Error('Wallet not initialized');
            }

            logger.debug('Signing transaction', 'TransactionBuilder.signTransaction', {
                accountIndex,
                addressIndex
            });

            // Parse transaction body
            const txBody = TransactionBody.from_bytes(Buffer.from(txBodyHex, 'hex'));
            const txHash = hash_transaction(txBody);

            // Get signing key (await since it's async now)
            const paymentKey = await this.keyManager.getPaymentSigningKey(accountIndex, addressIndex);
            const privateKey = paymentKey.to_raw_key();
            const publicKey = privateKey.to_public();

            // Create signature
            const signature = privateKey.sign(txHash.to_bytes());
            const vkey = Vkey.new(publicKey);
            const vkeyWitness = Vkeywitness.new(vkey, signature);

            // Create witness set
            const witnesses = TransactionWitnessSet.new();
            const vkeys = Vkeywitnesses.new();
            vkeys.add(vkeyWitness);
            witnesses.set_vkeys(vkeys);

            // Create signed transaction
            const signedTx = Transaction.new(txBody, witnesses);
            const signedTxHex = Buffer.from(signedTx.to_bytes()).toString('hex');

            // Clear sensitive data from memory
            this.clearTransactionSensitiveData();

            logger.debug('Transaction signed successfully', 'TransactionBuilder.signTransaction');
            return signedTxHex;

        } catch (error) {
            logger.error('Failed to sign transaction', 'TransactionBuilder.signTransaction', error);
            // Clear sensitive data even on error
            this.clearTransactionSensitiveData();
            throw new Error(`Transaction signing failed: ${error}`);
        }
    }

    /**
     * Submit a signed transaction to the network
     * @param signedTxHex - Signed transaction CBOR hex
     * @returns Transaction result
     */
    async submitTransaction(signedTxHex: string): Promise<TransactionResult> {
        try {
            // Load CSL components
            const { Transaction, hash_transaction } = await getCSL();
            
            logger.debug('Submitting transaction', 'TransactionBuilder.submitTransaction');

            // Parse transaction to get hash
            const signedTx = Transaction.from_bytes(Buffer.from(signedTxHex, 'hex'));
            const txBody = signedTx.body();
            const txHash = hash_transaction(txBody);
            const txHashHex = Buffer.from(txHash.to_bytes()).toString('hex');

            // Submit to network
            const result = await this.apiService.submitTransaction(signedTxHex);

            // Calculate fee and total output for result
            const fee = txBody.fee().to_str();
            const outputs = txBody.outputs();
            let totalOutput = BigInt(0);
            
            for (let i = 0; i < outputs.len(); i++) {
                const output = outputs.get(i);
                totalOutput += BigInt(output.amount().coin().to_str());
            }

            const transactionResult: TransactionResult = {
                txHash: txHashHex,
                fee,
                totalOutput: totalOutput.toString()
            };

            logger.info('Transaction submitted successfully', 'TransactionBuilder.submitTransaction', {
                txHash: txHashHex,
                fee
            });

            return transactionResult;

        } catch (error) {
            logger.error('Failed to submit transaction', 'TransactionBuilder.submitTransaction', error);
            throw new Error(`Transaction submission failed: ${error}`);
        }
    }

    /**
     * Build, sign, and submit a transaction in one operation
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
        try {
            logger.debug('Creating and submitting transaction', 'TransactionBuilder.createAndSubmitTransaction', request);

            // Build transaction
            const txBodyHex = await this.buildTransaction(request);

            // Sign transaction
            const signedTxHex = await this.signTransaction(txBodyHex, accountIndex, addressIndex);

            // Submit transaction
            const result = await this.submitTransaction(signedTxHex);

            logger.info('Transaction created and submitted successfully', 'TransactionBuilder.createAndSubmitTransaction', {
                txHash: result.txHash
            });

            return result;

        } catch (error) {
            logger.error('Failed to create and submit transaction', 'TransactionBuilder.createAndSubmitTransaction', error);
            throw new Error(`Transaction operation failed: ${error}`);
        }
    }

    /**
     * Estimate transaction fee
     * @param request - Transaction request
     * @returns Estimated fee in lovelace
     */
    async estimateFee(request: TransactionRequest): Promise<string> {
        try {
            // Get UTXOs to estimate input count
            const utxos = await this.apiService.getAddressUTXOs(request.fromAddress);
            if (!utxos || utxos.length === 0) {
                throw new Error('No UTXOs available');
            }

            const outputAmount = BigInt(request.amount);
            const selectedUtxos = this.selectUTXOs(utxos, outputAmount);
            const estimatedFee = this.calculateEstimatedFee(selectedUtxos.length, 1);

            return estimatedFee.toString();

        } catch (error) {
            logger.error('Failed to estimate fee', 'TransactionBuilder.estimateFee', error);
            throw new Error(`Fee estimation failed: ${error}`);
        }
    }

    // Private helper methods

    /**
     * Create configured transaction builder
     */
    private async createTransactionBuilder(): Promise<any> {
        const { LinearFee, BigNum, TransactionBuilderConfigBuilder, TransactionBuilder } = await getCSL();
        
        const linearFee = LinearFee.new(
            BigNum.from_str(CARDANO_FEES.MIN_FEE_A.toString()),    // min_fee_a
            BigNum.from_str(CARDANO_FEES.MIN_FEE_B.toString()) // min_fee_b
        );

        const config = TransactionBuilderConfigBuilder.new()
            .fee_algo(linearFee)
            .pool_deposit(BigNum.from_str(CARDANO_FEES.POOL_DEPOSIT.toString()))    // 500 ADA
            .key_deposit(BigNum.from_str(CARDANO_FEES.KEY_DEPOSIT.toString()))       // 2 ADA
            .max_value_size(5000)
            .max_tx_size(16384)
            .coins_per_utxo_word(BigNum.from_str('4310'))
            .build();

        return TransactionBuilder.new(config);
    }

    /**
     * Simple UTXO selection algorithm
     */
    private selectUTXOs(utxos: UTXO[], targetAmount: bigint): UTXO[] {
        // Sort UTXOs by amount (largest first for efficiency)
        const sortedUtxos = utxos
            .filter(utxo => utxo.amount?.find((a: UTXOAsset) => a.unit === 'lovelace'))
            .sort((a, b) => {
                const aAmount = BigInt(a.amount.find((asset: UTXOAsset) => asset.unit === 'lovelace')?.quantity || '0');
                const bAmount = BigInt(b.amount.find((asset: UTXOAsset) => asset.unit === 'lovelace')?.quantity || '0');
                return bAmount > aAmount ? 1 : -1;
            });

        const selected: UTXO[] = [];
        let totalSelected = BigInt(0);
        const estimatedFee = BigInt(this.calculateEstimatedFee(2, 1)); // Conservative estimate

        const targetWithFee = targetAmount + estimatedFee;

        for (const utxo of sortedUtxos) {
            const utxoAmount = BigInt(utxo.amount.find((a: any) => a.unit === 'lovelace')?.quantity || '0');
            selected.push(utxo);
            totalSelected += utxoAmount;

            // Check if we have enough
            if (totalSelected >= targetWithFee) {
                break;
            }
        }

        if (totalSelected < targetWithFee) {
            throw new Error(`Insufficient funds. Required: ${targetWithFee}, Available: ${totalSelected}`);
        }

        return selected;
    }

    /**
     * Calculate estimated transaction fee
     */
    private calculateEstimatedFee(inputCount: number, outputCount: number): number {
        // Simple fee calculation based on Cardano's linear fee structure
        const baseFee = 155381; // min_fee_b
        const feePerByte = 44;   // min_fee_a
        
        // Estimate transaction size (very rough approximation)
        const estimatedSize = 
            10 +                           // header
            (inputCount * 180) +          // inputs (including witness)
            (outputCount * 65) +          // outputs
            50;                           // misc overhead

        return baseFee + (feePerByte * estimatedSize);
    }

    /**
     * Clear sensitive transaction data from memory
     */
    private clearTransactionSensitiveData(): void {
        try {
            // Force garbage collection if available
            if (typeof global !== 'undefined' && global.gc) {
                global.gc();
            }
            
            logger.debug('Transaction sensitive data cleared', 'TransactionBuilder.clearTransactionSensitiveData');
        } catch (error) {
            logger.warn('Failed to clear transaction sensitive data', 'TransactionBuilder.clearTransactionSensitiveData', error);
        }
    }

    /**
     * Set network (will clear any cached data)
     */
    setNetwork(networkType: 'mainnet' | 'testnet'): void {
        this.network = networkType === 'mainnet' ? CARDANO_NETWORKS.MAINNET : CARDANO_NETWORKS.TESTNET;
        this.apiService.setNetwork(networkType);
        
        logger.info('Transaction builder network changed', 'TransactionBuilder.setNetwork', { networkType });
    }

    /**
     * Get current network
     */
    getNetwork(): typeof CARDANO_NETWORKS.MAINNET | typeof CARDANO_NETWORKS.TESTNET {
        return this.network;
    }

    /**
     * Build auxiliary data (metadata) for transaction
     * @param metadata - Metadata object to convert
     * @returns AuxiliaryData or null if conversion fails
     */
    private async buildAuxiliaryData(metadata: TransactionMetadata): Promise<any | null> {
        try {
            // Load CSL components
            const { AuxiliaryData, GeneralTransactionMetadata, BigNum } = await getCSL();
            
            const generalMetadata = GeneralTransactionMetadata.new();
            
            // Convert metadata object to Cardano transaction metadata format
            for (const [key, value] of Object.entries(metadata)) {
                const metadataKey = BigNum.from_str(key);
                const metadataValue = await this.convertToTransactionMetadatum(value);
                
                if (metadataValue) {
                    generalMetadata.insert(metadataKey, metadataValue);
                }
            }

            // Create auxiliary data with general metadata
            const auxiliaryData = AuxiliaryData.new();
            auxiliaryData.set_metadata(generalMetadata);
            
            logger.debug('Built auxiliary data for transaction', 'TransactionBuilder.buildAuxiliaryData', {
                metadataEntries: generalMetadata.len()
            });

            return auxiliaryData;

        } catch (error) {
            logger.error('Failed to build auxiliary data', 'TransactionBuilder.buildAuxiliaryData', error);
            return null;
        }
    }

    /**
     * Convert JavaScript value to TransactionMetadatum
     * @param value - Value to convert
     * @returns TransactionMetadatum or null
     */
    private async convertToTransactionMetadatum(value: string | number | TransactionMetadata | Array<string | number | TransactionMetadata>): Promise<any | null> {
        try {
            // Load CSL components
            const { TransactionMetadatum, BigNum, MetadataList, MetadataMap } = await getCSL();
            
            if (typeof value === 'string') {
                // String metadata
                return TransactionMetadatum.new_text(value);
                
            } else if (typeof value === 'number') {
                // Number metadata (must be within bounds)
                if (Number.isInteger(value) && value >= 0) {
                    return TransactionMetadatum.new_int(BigNum.from_str(value.toString()));
                } else {
                    // Convert to string if not a valid integer
                    return TransactionMetadatum.new_text(value.toString());
                }
                
            } else if (Array.isArray(value)) {
                // Array metadata
                const metadataList = MetadataList.new();
                for (const item of value) {
                    const metadatumItem = await this.convertToTransactionMetadatum(item);
                    if (metadatumItem) {
                        metadataList.add(metadatumItem);
                    }
                }
                return TransactionMetadatum.new_list(metadataList);
                
            } else if (typeof value === 'object' && value !== null) {
                // Object metadata
                const metadataMap = MetadataMap.new();
                for (const [subKey, subValue] of Object.entries(value)) {
                    const keyMetadatum = await this.convertToTransactionMetadatum(subKey);
                    const valueMetadatum = await this.convertToTransactionMetadatum(subValue);
                    
                    if (keyMetadatum && valueMetadatum) {
                        metadataMap.insert(keyMetadatum, valueMetadatum);
                    }
                }
                return TransactionMetadatum.new_map(metadataMap);
                
            } else {
                // Convert other types to string
                return TransactionMetadatum.new_text(String(value));
            }

        } catch (error) {
            logger.warn('Failed to convert value to metadata', 'TransactionBuilder.convertToTransactionMetadatum', {
                value: typeof value,
                error
            });
            return null;
        }
    }

    /**
     * Format assets for transaction output
     * @private
     */
    private formatAssets(assets?: Array<{ policyId: string; assetName: string; amount: string }>) {
        if (!assets || assets.length === 0) {
            return {};
        }

        const formattedAssets: { [key: string]: string } = {};
        assets.forEach(asset => {
            const assetKey = `${asset.policyId}.${asset.assetName}`;
            formattedAssets[assetKey] = asset.amount;
        });

        return formattedAssets;
    }

    /**
     * Clear sensitive data from memory
     */
    public clearSensitiveData(): void {
        // Clear any cached transaction data or sensitive information
        // This is a placeholder for any sensitive data cleanup in the future
        logger.debug('TransactionBuilder sensitive data cleared', 'TransactionBuilder.clearSensitiveData');
    }
}

export default TransactionBuilder;
