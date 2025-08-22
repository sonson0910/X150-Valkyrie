import { CardanoAPIService } from './CardanoAPIService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/Logger';
import { CARDANO_FEES, DEFI_CONSTANTS } from '../constants/index';

// DeFi Transaction Types
export interface DelegationTransaction {
    type: 'delegation';
    address: string;
    poolId: string;
    amount: string;
    certificate?: any; // CSL Certificate type
    cborHex?: string;
}

export interface WithdrawalTransaction {
    type: 'withdrawal';
    address: string;
    poolId: string;
}

export interface VoteTransaction {
    type: 'vote';
    proposalId: string;
    address: string;
    vote: string;
    votingPower: string;
}

export interface LiquidityTransaction {
    type: 'addLiquidity';
    address: string;
    poolId: string;
    tokenA: string;
    tokenB: string;
    amountA: string;
    amountB: string;
}

export interface ClaimRewardsTransaction {
    type: 'claimRewards';
    address: string;
    poolId: string;
    rewards: string;
}

export type DeFiTransaction = DelegationTransaction | WithdrawalTransaction | VoteTransaction | LiquidityTransaction | ClaimRewardsTransaction;

export interface StakingPool {
    id: string;
    poolId: string;
    ticker: string;
    name: string;
    description?: string;
    website?: string;
    pledge: string;
    margin: number;
    cost: string;
    saturation: number;
    apy: number;
    totalStake: string;
    delegators: number;
    isActive: boolean;
    lastUpdated: Date;
}

export interface StakingPosition {
    id: string;
    poolId: string;
    poolName: string;
    address: string;
    amount: string;
    rewards: string;
    startDate: Date;
    lastRewardDate: Date;
    status: 'active' | 'inactive' | 'pending';
}

export interface LiquidityPool {
    id: string;
    name: string;
    tokenA: string;
    tokenB: string;
    reserveA: string;
    reserveB: string;
    totalLiquidity: string;
    apy: number;
    volume24h: string;
    fees24h: string;
    isActive: boolean;
}

export interface LiquidityPosition {
    id: string;
    poolId: string;
    poolName: string;
    address: string;
    liquidityTokens: string;
    tokenAAmount: string;
    tokenBAmount: string;
    share: number;
    rewards: string;
    startDate: Date;
}

export interface GovernanceProposal {
    id: string;
    title: string;
    description: string;
    category: 'parameter_change' | 'treasury' | 'constitutional' | 'info';
    votingStart: Date;
    votingEnd: Date;
    status: 'active' | 'passed' | 'rejected' | 'expired';
    yesVotes: number;
    noVotes: number;
    abstainVotes: number;
    totalVotes: number;
    quorum: number;
}

export interface GovernanceVote {
    id: string;
    proposalId: string;
    address: string;
    vote: 'yes' | 'no' | 'abstain';
    votingPower: string;
    timestamp: Date;
    transactionHash: string;
}

/**
 * Service quản lý DeFi và Staking trên Cardano
 * Hỗ trợ ADA staking, liquidity pools, yield farming, và governance
 */
export class DeFiStakingService {
    private static instance: DeFiStakingService;
    private cardanoAPI: CardanoAPIService;

    constructor() {
        this.cardanoAPI = CardanoAPIService.getInstance();
    }

    static getInstance(): DeFiStakingService {
        if (!DeFiStakingService.instance) {
            DeFiStakingService.instance = new DeFiStakingService();
        }
        return DeFiStakingService.instance;
    }

    /**
     * Lấy danh sách staking pools
     */
    async getStakingPools(limit: number = 50, offset: number = 0): Promise<StakingPool[]> {
        try {
            // Get from Cardano API
            const pools = await this.cardanoAPI.getStakingPools(limit, offset);

            // Convert to StakingPool format
            const stakingPools: StakingPool[] = pools.map(pool => ({
                id: `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                poolId: pool.pool_id,
                ticker: pool.ticker || 'UNKNOWN',
                name: pool.name || 'Unknown Pool',
                description: pool.description,
                website: pool.website,
                pledge: pool.pledge,
                margin: pool.margin || 0,
                cost: pool.cost,
                saturation: pool.saturation || 0,
                apy: pool.apy || 0,
                totalStake: pool.total_stake,
                delegators: pool.delegators || 0,
                isActive: pool.active || true,
                lastUpdated: new Date()
            }));

            return stakingPools;

        } catch (error) {
            console.error('Failed to get staking pools:', error);
            return [];
        }
    }

    /**
     * Tìm kiếm staking pool
     */
    async searchStakingPools(query: string): Promise<StakingPool[]> {
        try {
            const allPools = await this.getStakingPools(DEFI_CONSTANTS.MAX_POOL_SEARCH_RESULTS, 0);

            return allPools.filter(pool =>
                pool.name.toLowerCase().includes(query.toLowerCase()) ||
                pool.ticker.toLowerCase().includes(query.toLowerCase()) ||
                pool.description?.toLowerCase().includes(query.toLowerCase())
            );

        } catch (error) {
            console.error('Failed to search staking pools:', error);
            return [];
        }
    }

    /**
     * Lấy thông tin chi tiết staking pool
     */
    async getStakingPoolDetails(poolId: string): Promise<StakingPool | null> {
        try {
            const pool = await this.cardanoAPI.getStakingPool(poolId);
            if (!pool) {
                return null;
            }

            const stakingPool: StakingPool = {
                id: `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                poolId: pool.pool_id,
                ticker: pool.ticker || 'UNKNOWN',
                name: pool.name || 'Unknown Pool',
                description: pool.description,
                website: pool.website,
                pledge: pool.pledge,
                margin: pool.margin || 0,
                cost: pool.cost,
                saturation: pool.saturation || 0,
                apy: pool.apy || 0,
                totalStake: pool.total_stake,
                delegators: pool.delegators || 0,
                isActive: pool.active || true,
                lastUpdated: new Date()
            };

            return stakingPool;

        } catch (error) {
            console.error('Failed to get staking pool details:', error);
            return null;
        }
    }

    /**
     * Delegate ADA vào staking pool
     */
    async delegateToPool(
        address: string,
        poolId: string,
        amount: string
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            console.log('Delegating to pool:', { address, poolId, amount });

            // Build delegation transaction
            const delegationTx = await this.buildDelegationTransaction(address, poolId, amount);

            // Sign transaction
            const signedTx = await this.signDelegationTransaction(delegationTx);

            // Submit to network
            const result = await this.submitDelegationTransaction(signedTx);

            if (result.success) {
                // Create staking position
                const position: StakingPosition = {
                    id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    poolId,
                    poolName: 'Unknown Pool', // Will be updated later
                    address,
                    amount,
                    rewards: '0',
                    startDate: new Date(),
                    lastRewardDate: new Date(),
                    status: 'pending'
                };

                // Save staking position
                await this.saveStakingPosition(position);

                console.log('Delegation successful');
                return {
                    success: true,
                    txHash: result.txHash
                };
            }

            return { success: false, error: result.error };

        } catch (error) {
            console.error('Delegation failed:', error);
            return {
                success: false,
                error: `Failed to delegate: ${error}`
            };
        }
    }

    /**
     * Withdraw delegation từ staking pool
     */
    async withdrawDelegation(
        address: string,
        poolId: string
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            console.log('Withdrawing delegation:', { address, poolId });

            // Build withdrawal transaction
            const withdrawalTx = await this.buildWithdrawalTransaction(address, poolId);

            // Sign transaction
            const signedTx = await this.signWithdrawalTransaction(withdrawalTx);

            // Submit to network
            const result = await this.submitWithdrawalTransaction(signedTx);

            if (result.success) {
                // Update staking position status
                await this.updateStakingPositionStatus(address, poolId, 'inactive');

                console.log('Withdrawal successful');
                return {
                    success: true,
                    txHash: result.txHash
                };
            }

            return { success: false, error: result.error };

        } catch (error) {
            console.error('Withdrawal failed:', error);
            return {
                success: false,
                error: `Failed to withdraw: ${error}`
            };
        }
    }

    /**
     * Claim staking rewards
     */
    async claimStakingRewards(
        address: string,
        poolId: string
    ): Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }> {
        try {
            console.log('Claiming staking rewards:', { address, poolId });

            // Get current rewards
            const rewards = await this.getStakingRewards(address, poolId);
            if (!rewards || parseFloat(rewards) <= 0) {
                return { success: false, error: 'No rewards to claim' };
            }

            // Build claim transaction
            const claimTx = await this.buildClaimRewardsTransaction(address, poolId, rewards);

            // Sign transaction
            const signedTx = await this.signClaimRewardsTransaction(claimTx);

            // Submit to network
            const result = await this.submitClaimRewardsTransaction(signedTx);

            if (result.success) {
                // Reset rewards in position
                await this.resetStakingRewards(address, poolId);

                console.log('Rewards claimed successfully');
                return {
                    success: true,
                    txHash: result.txHash,
                    amount: rewards
                };
            }

            return { success: false, error: result.error };

        } catch (error) {
            console.error('Claim rewards failed:', error);
            return {
                success: false,
                error: `Failed to claim rewards: ${error}`
            };
        }
    }

    /**
     * Lấy danh sách liquidity pools
     */
    async getLiquidityPools(): Promise<LiquidityPool[]> {
        try {
            // This would integrate with actual DEX APIs
            // For now, return mock data
            const mockPools: LiquidityPool[] = [
                {
                    id: 'pool_1',
                    name: 'ADA/AGIX',
                    tokenA: 'ADA',
                    tokenB: 'AGIX',
                    reserveA: '1000000',
                    reserveB: '50000',
                    totalLiquidity: '500000',
                    apy: 15.5,
                    volume24h: '25000',
                    fees24h: '125',
                    isActive: true
                },
                {
                    id: 'pool_2',
                    name: 'ADA/MIN',
                    tokenA: 'ADA',
                    tokenB: 'MIN',
                    reserveA: '2000000',
                    reserveB: '100000',
                    totalLiquidity: '1000000',
                    apy: 12.8,
                    volume24h: '15000',
                    fees24h: '75',
                    isActive: true
                }
            ];

            return mockPools;

        } catch (error) {
            console.error('Failed to get liquidity pools:', error);
            return [];
        }
    }

    /**
     * Add liquidity vào pool
     */
    async addLiquidity(
        poolId: string,
        tokenAAmount: string,
        tokenBAmount: string,
        address: string
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            console.log('Adding liquidity:', { poolId, tokenAAmount, tokenBAmount, address });

            // Build add liquidity transaction
            const addLiquidityTx = await this.buildAddLiquidityTransaction(
                poolId,
                tokenAAmount,
                tokenBAmount,
                address
            );

            // Sign transaction
            const signedTx = await this.signAddLiquidityTransaction(addLiquidityTx);

            // Submit to network
            const result = await this.submitAddLiquidityTransaction(signedTx);

            if (result.success) {
                // Create liquidity position
                const position: LiquidityPosition = {
                    id: `liq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    poolId,
                    poolName: 'Unknown Pool',
                    address,
                    liquidityTokens: '0', // Will be calculated
                    tokenAAmount,
                    tokenBAmount,
                    share: 0, // Will be calculated
                    rewards: '0',
                    startDate: new Date()
                };

                // Save liquidity position
                await this.saveLiquidityPosition(position);

                console.log('Liquidity added successfully');
                return {
                    success: true,
                    txHash: result.txHash
                };
            }

            return { success: false, error: result.error };

        } catch (error) {
            console.error('Add liquidity failed:', error);
            return {
                success: false,
                error: `Failed to add liquidity: ${error}`
            };
        }
    }

    /**
     * Lấy danh sách governance proposals
     */
    async getGovernanceProposals(): Promise<GovernanceProposal[]> {
        try {
            // This would integrate with actual governance APIs
            // For now, return mock data
            const mockProposals: GovernanceProposal[] = [
                {
                    id: 'prop_1',
                    title: 'Increase Treasury Allocation',
                    description: 'Proposal to increase treasury allocation from 20% to 25%',
                    category: 'treasury',
                    votingStart: new Date('2024-01-01'),
                    votingEnd: new Date('2024-01-31'),
                    status: 'active',
                    yesVotes: 1500,
                    noVotes: 300,
                    abstainVotes: 100,
                    totalVotes: 1900,
                    quorum: 1000
                },
                {
                    id: 'prop_2',
                    title: 'Parameter Change: Min Pool Cost',
                    description: 'Reduce minimum pool cost from 340 ADA to 300 ADA',
                    category: 'parameter_change',
                    votingStart: new Date('2024-02-01'),
                    votingEnd: new Date('2024-02-29'),
                    status: 'active',
                    yesVotes: 800,
                    noVotes: 600,
                    abstainVotes: 200,
                    totalVotes: 1600,
                    quorum: 1000
                }
            ];

            return mockProposals;

        } catch (error) {
            console.error('Failed to get governance proposals:', error);
            return [];
        }
    }

    /**
     * Vote cho governance proposal
     */
    async voteOnProposal(
        proposalId: string,
        address: string,
        vote: 'yes' | 'no' | 'abstain',
        votingPower: string
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            console.log('Voting on proposal:', { proposalId, address, vote, votingPower });

            // Build vote transaction
            const voteTx = await this.buildVoteTransaction(proposalId, address, vote, votingPower);

            // Sign transaction
            const signedTx = await this.signVoteTransaction(voteTx);

            // Submit to network
            const result = await this.submitVoteTransaction(signedTx);

            if (result.success) {
                // Create vote record
                const voteRecord: GovernanceVote = {
                    id: `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    proposalId,
                    address,
                    vote,
                    votingPower,
                    timestamp: new Date(),
                    transactionHash: result.txHash!
                };

                // Save vote record
                await this.saveGovernanceVote(voteRecord);

                console.log('Vote submitted successfully');
                return {
                    success: true,
                    txHash: result.txHash
                };
            }

            return { success: false, error: result.error };

        } catch (error) {
            console.error('Vote submission failed:', error);
            return {
                success: false,
                error: `Failed to submit vote: ${error}`
            };
        }
    }

    /**
     * Lấy staking rewards của một địa chỉ
     */
    async getStakingRewards(address: string, poolId: string): Promise<string> {
        try {
            // This would integrate with actual staking reward APIs
            // For now, return mock data
            return '125.50';
        } catch (error) {
            console.error('Failed to get staking rewards:', error);
            return '0';
        }
    }

    /**
     * Lấy staking positions của một địa chỉ
     */
    async getStakingPositions(address: string): Promise<StakingPosition[]> {
        try {
            const positionsData = await AsyncStorage.getItem(`staking_positions_${address}`);
            return positionsData ? JSON.parse(positionsData) : [];
        } catch (error) {
            console.error('Failed to get staking positions:', error);
            return [];
        }
    }

    /**
     * Lấy liquidity positions của một địa chỉ
     */
    async getLiquidityPositions(address: string): Promise<LiquidityPosition[]> {
        try {
            const positionsData = await AsyncStorage.getItem(`liquidity_positions_${address}`);
            return positionsData ? JSON.parse(positionsData) : [];
        } catch (error) {
            console.error('Failed to get liquidity positions:', error);
            return [];
        }
    }

    // Private methods for transaction building and signing
    private async buildDelegationTransaction(address: string, poolId: string, amount: string): Promise<any> {
        try {
            // Use cardano-serialization-lib for proper delegation certificate creation
            const CSL = require('@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib');
            
            // Create delegation certificate
            const stakeCredential = CSL.StakeCredential.from_keyhash(
                CSL.Ed25519KeyHash.from_hex('0'.repeat(56)) // Placeholder key hash
            );
            
            const poolKeyHash = CSL.Ed25519KeyHash.from_hex(poolId);
            const delegationCert = CSL.Certificate.new_stake_delegation(
                CSL.StakeDelegation.new(stakeCredential, poolKeyHash)
            );
            
            return {
                type: 'delegation',
                address,
                poolId,
                amount,
                certificate: delegationCert,
                cborHex: Buffer.from(delegationCert.to_bytes()).toString('hex')
            };
            
        } catch (error) {
            logger.error('Failed to build delegation transaction', 'DeFiStakingService.buildDelegationTransaction', error);
            // Fallback to simple object
            return { type: 'delegation', address, poolId, amount };
        }
    }

    private async buildWithdrawalTransaction(address: string, poolId: string): Promise<any> {
        return { type: 'withdrawal', address, poolId };
    }

    private async buildClaimRewardsTransaction(address: string, poolId: string, amount: string): Promise<any> {
        return { type: 'claim_rewards', address, poolId, amount };
    }

    private async buildAddLiquidityTransaction(poolId: string, tokenAAmount: string, tokenBAmount: string, address: string): Promise<any> {
        return { type: 'add_liquidity', poolId, tokenAAmount, tokenBAmount, address };
    }

    private async buildVoteTransaction(proposalId: string, address: string, vote: string, votingPower: string): Promise<any> {
        return { type: 'vote', proposalId, address, vote, votingPower };
    }

    private async signDelegationTransaction(transaction: DelegationTransaction): Promise<string> {
        try {
            // Connect to CardanoWalletService for real signing when transaction builder is complete
            const { CardanoWalletService } = require('./CardanoWalletService');
            const walletService = CardanoWalletService.getInstance();
            
            // Build transaction request for wallet service
            const txRequest = {
                type: 'delegation',
                certificate: transaction.certificate,
                fee: CARDANO_FEES.DELEGATION_FEE.toString(), // Standard delegation fee
                metadata: {
                    poolId: transaction.poolId,
                    delegationAmount: transaction.amount
                }
            };
            
            // Sign using wallet service
            const signedTx = await walletService.signTransaction(txRequest);
            
            logger.debug('Delegation transaction signed', 'DeFiStakingService.signDelegationTransaction', {
                poolId: transaction.poolId,
                signedTxLength: signedTx.length
            });
            
            return signedTx;
            
        } catch (error) {
            logger.error('Failed to sign delegation transaction', 'DeFiStakingService.signDelegationTransaction', error);
            // Fallback for development
            return `signed_delegation_${Date.now()}`;
        }
    }

    private async signWithdrawalTransaction(transaction: WithdrawalTransaction): Promise<string> {
        return `signed_withdrawal_${Date.now()}`;
    }

    private async signClaimRewardsTransaction(transaction: ClaimRewardsTransaction): Promise<string> {
        return `signed_claim_${Date.now()}`;
    }

    private async signAddLiquidityTransaction(transaction: LiquidityTransaction): Promise<string> {
        return `signed_liquidity_${Date.now()}`;
    }

    private async signVoteTransaction(transaction: VoteTransaction): Promise<string> {
        return `signed_vote_${Date.now()}`;
    }

    private async submitDelegationTransaction(signedTx: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const result = await this.cardanoAPI.submitTransaction(signedTx);

            if (typeof result === 'string') {
                return { success: true, txHash: result };
            } else {
                return { success: false, error: 'Transaction submission failed' };
            }
        } catch (error) {
            return { success: false, error: `Delegation submission failed: ${error}` };
        }
    }

    private async submitWithdrawalTransaction(signedTx: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const result = await this.cardanoAPI.submitTransaction(signedTx);

            if (typeof result === 'string') {
                return { success: true, txHash: result };
            } else {
                return { success: false, error: 'Transaction submission failed' };
            }
        } catch (error) {
            return { success: false, error: `Withdrawal submission failed: ${error}` };
        }
    }

    private async submitClaimRewardsTransaction(signedTx: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const result = await this.cardanoAPI.submitTransaction(signedTx);

            if (typeof result === 'string') {
                return { success: true, txHash: result };
            } else {
                return { success: false, error: 'Transaction submission failed' };
            }
        } catch (error) {
            return { success: false, error: `Claim rewards submission failed: ${error}` };
        }
    }

    private async submitAddLiquidityTransaction(signedTx: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const result = await this.cardanoAPI.submitTransaction(signedTx);

            if (typeof result === 'string') {
                return { success: true, txHash: result };
            } else {
                return { success: false, error: 'Transaction submission failed' };
            }
        } catch (error) {
            return { success: false, error: `Add liquidity submission failed: ${error}` };
        }
    }

    private async submitVoteTransaction(signedTx: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const result = await this.cardanoAPI.submitTransaction(signedTx);

            if (typeof result === 'string') {
                return { success: true, txHash: result };
            } else {
                return { success: false, error: 'Transaction submission failed' };
            }
        } catch (error) {
            return { success: false, error: `Vote submission failed: ${error}` };
        }
    }

    private async saveStakingPosition(position: StakingPosition): Promise<void> {
        try {
            const positions = await this.getStakingPositions(position.address);
            positions.push(position);
            await AsyncStorage.setItem(`staking_positions_${position.address}`, JSON.stringify(positions));
        } catch (error) {
            throw new Error(`Failed to save staking position: ${error}`);
        }
    }

    private async saveLiquidityPosition(position: LiquidityPosition): Promise<void> {
        try {
            const positions = await this.getLiquidityPositions(position.address);
            positions.push(position);
            await AsyncStorage.setItem(`liquidity_positions_${position.address}`, JSON.stringify(positions));
        } catch (error) {
            throw new Error(`Failed to save liquidity position: ${error}`);
        }
    }

    private async saveGovernanceVote(vote: GovernanceVote): Promise<void> {
        try {
            const votesData = await AsyncStorage.getItem('governance_votes');
            const votes = votesData ? JSON.parse(votesData) : [];
            votes.push(vote);
            await AsyncStorage.setItem('governance_votes', JSON.stringify(votes));
        } catch (error) {
            throw new Error(`Failed to save governance vote: ${error}`);
        }
    }

    private async updateStakingPositionStatus(address: string, poolId: string, status: string): Promise<void> {
        try {
            const positions = await this.getStakingPositions(address);
            const position = positions.find(p => p.poolId === poolId);
            if (position) {
                position.status = status as any;
                await AsyncStorage.setItem(`staking_positions_${address}`, JSON.stringify(positions));
            }
        } catch (error) {
            console.error('Failed to update staking position status:', error);
        }
    }

    private async resetStakingRewards(address: string, poolId: string): Promise<void> {
        try {
            const positions = await this.getStakingPositions(address);
            const position = positions.find(p => p.poolId === poolId);
            if (position) {
                position.rewards = '0';
                position.lastRewardDate = new Date();
                await AsyncStorage.setItem(`staking_positions_${address}`, JSON.stringify(positions));
            }
        } catch (error) {
            console.error('Failed to reset staking rewards:', error);
        }
    }
}
