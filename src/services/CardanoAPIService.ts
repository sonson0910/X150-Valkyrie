import { CARDANO_NETWORKS } from '@constants/index';
import { ConfigurationService } from './ConfigurationService';
import { NetworkService } from './NetworkService';
import { ErrorHandler, ErrorSeverity, ErrorType } from './ErrorHandler';

/**
 * Service tích hợp với Blockfrost API cho Cardano
 * Xử lý giao tiếp với blockchain để lấy balance, submit transaction, etc.
 */
export class CardanoAPIService {
    private static instance: CardanoAPIService;
    private configService: ConfigurationService;
    private networkService: NetworkService;
    private errorHandler: ErrorHandler;
    private currentNetwork: 'mainnet' | 'testnet' = 'testnet';

    private constructor() {
        this.configService = ConfigurationService.getInstance();
        this.networkService = NetworkService.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
    }

    public static getInstance(): CardanoAPIService {
        if (!CardanoAPIService.instance) {
            CardanoAPIService.instance = new CardanoAPIService();
        }
        return CardanoAPIService.instance;
    }

    /**
     * Get Blockfrost project ID for current network
     */
    private getProjectId(network: 'mainnet' | 'testnet'): string {
        try {
            const projectId = this.configService.getApiKey('blockfrost', network);
            if (!projectId) {
                throw new Error(`Blockfrost project ID not configured for ${network}`);
            }
            return projectId;
        } catch (error) {
            this.errorHandler.handleError(
                error as Error,
                'CardanoAPIService.getProjectId',
                ErrorSeverity.HIGH,
                ErrorType.NETWORK
            );
            throw error;
        }
    }

    /**
     * Get base URL for current network
     */
    private getBaseURL(): string {
        return this.currentNetwork === 'mainnet'
            ? 'https://cardano-mainnet.blockfrost.io/api/v0'
            : 'https://cardano-testnet.blockfrost.io/api/v0';
    }

    /**
     * Set current network
     */
    setNetwork(network: 'mainnet' | 'testnet'): void {
        this.currentNetwork = network;
    }

    /**
     * Thực hiện API call với error handling
     * @param endpoint - API endpoint
     * @param options - Fetch options
     * @returns API response
     */
    private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        try {
            const projectId = this.getProjectId(this.currentNetwork);
            const response = await fetch(`${this.getBaseURL()}${endpoint}`, {
                ...options,
                headers: {
                    'project_id': projectId,
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error ${response.status}: ${errorData.message || response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            console.error(`Cardano API call failed for ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Lấy thông tin health của API
     * @returns Health status
     */
    async getHealth(): Promise<{ is_healthy: boolean }> {
        return this.apiCall('/health');
    }

    /**
     * Lấy balance của một địa chỉ
     * @param address - Cardano address
     * @returns Address info với balance
     */
    async getAddressInfo(address: string): Promise<{
        address: string;
        amount: Array<{ unit: string; quantity: string }>;
        stake_address?: string;
        type: string;
        script: boolean;
    }> {
        return this.apiCall(`/addresses/${address}`);
    }

    /**
     * Lấy UTXOs của một địa chỉ
     * @param address - Cardano address
     * @returns Array of UTXOs
     */
    async getAddressUTXOs(address: string): Promise<Array<{
        tx_hash: string;
        tx_index: number;
        output_index: number;
        amount: Array<{ unit: string; quantity: string }>;
        block: string;
        data_hash?: string;
    }>> {
        return this.apiCall(`/addresses/${address}/utxos`);
    }

    /**
     * Lấy lịch sử giao dịch của một địa chỉ
     * @param address - Cardano address
     * @param count - Số lượng transactions (max 100)
     * @param page - Page number
     * @param order - Order (asc/desc)
     * @returns Array of transactions
     */
    async getAddressTransactions(
        address: string,
        count: number = 50,
        page: number = 1,
        order: 'asc' | 'desc' = 'desc'
    ): Promise<Array<{
        tx_hash: string;
        tx_index: number;
        block_height: number;
        block_time: number;
    }>> {
        return this.apiCall(`/addresses/${address}/transactions?count=${count}&page=${page}&order=${order}`);
    }

    /**
     * Lấy chi tiết của một transaction
     * @param txHash - Transaction hash
     * @returns Transaction details
     */
    async getTransaction(txHash: string): Promise<{
        hash: string;
        block: string;
        block_height: number;
        block_time: number;
        slot: number;
        index: number;
        output_amount: Array<{ unit: string; quantity: string }>;
        fees: string;
        deposit: string;
        size: number;
        invalid_before?: string;
        invalid_hereafter?: string;
        utxo_count: number;
        withdrawal_count: number;
        mir_cert_count: number;
        delegation_count: number;
        stake_cert_count: number;
        pool_update_count: number;
        pool_retire_count: number;
        asset_mint_or_burn_count: number;
        redeemer_count: number;
        valid_contract: boolean;
    }> {
        return this.apiCall(`/txs/${txHash}`);
    }

    /**
     * Lấy UTXOs của một transaction
     * @param txHash - Transaction hash
     * @returns Transaction UTXOs
     */
    async getTransactionUTXOs(txHash: string): Promise<{
        hash: string;
        inputs: Array<{
            address: string;
            amount: Array<{ unit: string; quantity: string }>;
            tx_hash: string;
            output_index: number;
            data_hash?: string;
            collateral: boolean;
            reference: boolean;
        }>;
        outputs: Array<{
            address: string;
            amount: Array<{ unit: string; quantity: string }>;
            output_index: number;
            data_hash?: string;
            collateral: boolean;
            reference: boolean;
        }>;
    }> {
        return this.apiCall(`/txs/${txHash}/utxos`);
    }

    /**
     * Submit một transaction lên blockchain
     * @param txData - Signed transaction data (CBOR hex)
     * @returns Transaction hash
     */
    async submitTransaction(txData: string): Promise<string> {
        const response = await this.apiCall<string>('/tx/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/cbor',
            },
            body: txData,
        });

        return response;
    }

    /**
     * Lấy protocol parameters hiện tại
     * @returns Protocol parameters
     */
    async getProtocolParameters(): Promise<{
        epoch: number;
        min_fee_a: number;
        min_fee_b: number;
        pool_deposit: string;
        key_deposit: string;
        min_utxo: string;
        max_tx_size: number;
        max_val_size?: string;
        utxo_cost_per_word?: string;
        coins_per_utxo_word?: string;
        coins_per_utxo_size?: string;
        price_mem?: number;
        price_step?: number;
        max_tx_ex_mem?: string;
        max_tx_ex_steps?: string;
        max_block_ex_mem?: string;
        max_block_ex_steps?: string;
        max_collateral_inputs?: number;
        collateral_percent?: number;
        nonce?: string;
    }> {
        return this.apiCall('/epochs/latest/parameters');
    }

    /**
     * Estimate transaction fee
     * @param txSize - Transaction size in bytes
     * @returns Estimated fee in lovelace
     */
    async estimateTransactionFee(txSize: number): Promise<string> {
        try {
            const params = await this.getProtocolParameters();
            const fee = params.min_fee_a * txSize + params.min_fee_b;
            return fee.toString();

        } catch (error) {
            console.error('Failed to estimate fee:', error);
            // Fallback to default fee
            return '200000'; // 0.2 ADA
        }
    }

    /**
     * Lấy epoch info hiện tại
     * @returns Current epoch info
     */
    async getCurrentEpoch(): Promise<{
        epoch: number;
        start_time: number;
        end_time: number;
        first_block_time: number;
        last_block_time: number;
        block_count: number;
        tx_count: number;
        output: string;
        fees: string;
        active_stake?: string;
    }> {
        return this.apiCall('/epochs/latest');
    }

    /**
     * Lấy thông tin latest block
     * @returns Latest block info
     */
    async getLatestBlock(): Promise<{
        time: number;
        height?: number;
        hash: string;
        slot?: number;
        epoch?: number;
        epoch_slot?: number;
        slot_leader: string;
        size: number;
        tx_count: number;
        output?: string;
        fees?: string;
        block_vrf?: string;
        previous_block?: string;
        next_block?: string;
        confirmations: number;
    }> {
        return this.apiCall('/blocks/latest');
    }

    /**
     * Validate một address
     * @param address - Address to validate
     * @returns Validation result
     */
    async validateAddress(address: string): Promise<{
        address: string;
        is_valid: boolean;
        type?: string;
        stake_address?: string;
    }> {
        try {
            return this.apiCall(`/addresses/${address}/validate`);
        } catch (error) {
            return {
                address,
                is_valid: false,
            };
        }
    }

    /**
     * Convert ADA to lovelace
     * @param ada - Amount in ADA
     * @returns Amount in lovelace
     */
    static adaToLovelace(ada: string | number): string {
        const adaNum = typeof ada === 'string' ? parseFloat(ada) : ada;
        return Math.floor(adaNum * 1000000).toString();
    }

    /**
     * Convert lovelace to ADA
     * @param lovelace - Amount in lovelace
     * @returns Amount in ADA
     */
    static lovelaceToAda(lovelace: string | number): string {
        const lovelaceNum = typeof lovelace === 'string' ? parseInt(lovelace) : lovelace;
        return (lovelaceNum / 1000000).toFixed(6);
    }

    /**
     * Format amount with proper units
     * @param amount - Amount object from API
     * @returns Formatted amounts
     */
    static formatAmount(amount: Array<{ unit: string; quantity: string }>): {
        ada: string;
        assets: Array<{ policyId: string; assetName: string; quantity: string }>;
    } {
        const adaEntry = amount.find(a => a.unit === 'lovelace');
        const ada = adaEntry ? this.lovelaceToAda(adaEntry.quantity) : '0';

        const assets = amount
            .filter(a => a.unit !== 'lovelace')
            .map(a => ({
                policyId: a.unit.slice(0, 56),
                assetName: a.unit.slice(56),
                quantity: a.quantity,
            }));

        return { ada, assets };
    }

    /**
     * Check if API is available
     * @returns true if API is working
     */
    async isAvailable(): Promise<boolean> {
        try {
            const health = await this.getHealth();
            return health.is_healthy;
        } catch {
            return false;
        }
    }

    /**
     * Set API key
     * @param apiKey - Blockfrost API key
     */
    setApiKey(apiKey: string): void {
        // Store in configuration service instead
        this.configService.setApiKey('blockfrost', this.currentNetwork, apiKey);
    }

    /**
     * Get current network
     * @returns Current network
     */
    getNetwork(): 'mainnet' | 'testnet' {
        return this.currentNetwork;
    }

    // DeFi & Staking Methods
    async getStakingPools(limit: number = 10, offset: number = 0): Promise<any[]> {
        try {
            const response = await this.apiCall<any[]>('/pools?count=' + limit + '&page=' + (offset / limit + 1));
            return response || [];
        } catch (error) {
            console.error('Failed to get staking pools:', error);
            return [];
        }
    }

    async getStakingPool(poolId: string): Promise<any> {
        try {
            const response = await this.apiCall<any>(`/pools/${poolId}`);
            return response;
        } catch (error) {
            console.error('Failed to get staking pool:', error);
            return null;
        }
    }

    // NFT Methods
    async getAddressAssets(address: string): Promise<any[]> {
        try {
            const response = await this.apiCall<any[]>(`/addresses/${address}/utxos`);
            return response || [];
        } catch (error) {
            console.error('Failed to get address assets:', error);
            return [];
        }
    }

    async getAsset(assetId: string): Promise<any> {
        try {
            const response = await this.apiCall<any>(`/assets/${assetId}`);
            return response;
        } catch (error) {
            console.error('Failed to get asset:', error);
            return null;
        }
    }

    async getPolicyAssets(policyId: string): Promise<any[]> {
        try {
            const response = await this.apiCall<any[]>(`/assets/policy/${policyId}`);
            return response || [];
        } catch (error) {
            console.error('Failed to get policy assets:', error);
            return [];
        }
    }

    // Portfolio Methods
    async getAddressBalance(address: string): Promise<string> {
        try {
            const response = await this.apiCall<any>(`/addresses/${address}`);
            return (response as any)?.amount || '0';
        } catch (error) {
            console.error('Failed to get address balance:', error);
            return '0';
        }
    }

    // Transaction Building Methods
    async buildTransaction(params: any): Promise<any> {
        try {
            // This would integrate with cardano-serialization-lib
            console.log('Building transaction with params:', params);

            // For now, return a mock transaction structure
            return {
                id: 'tx_' + Date.now(),
                params: params,
                built: true,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to build transaction:', error);
            throw error;
        }
    }
}
