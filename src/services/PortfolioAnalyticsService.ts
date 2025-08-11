import { CardanoAPIService } from './CardanoAPIService';
import { NFTManagementService } from './NFTManagementService';
import { DeFiStakingService } from './DeFiStakingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PortfolioAsset {
    id: string;
    assetId: string;
    name: string;
    symbol: string;
    type: 'ada' | 'nft' | 'token' | 'lp_token';
    quantity: string;
    price: number;
    value: number;
    change24h: number;
    change7d: number;
    change30d: number;
    allocation: number;
    lastUpdated: Date;
}

export interface PortfolioSummary {
    totalValue: number;
    totalChange24h: number;
    totalChange7d: number;
    totalChange30d: number;
    adaValue: number;
    nftValue: number;
    tokenValue: number;
    lpValue: number;
    stakingValue: number;
    rewardsValue: number;
    lastUpdated: Date;
}

export interface PortfolioPerformance {
    date: Date;
    value: number;
    change: number;
    changePercent: number;
}

export interface TransactionAnalytics {
    totalTransactions: number;
    totalVolume: number;
    averageTransactionSize: number;
    mostFrequentRecipients: Array<{ address: string; count: number; volume: number }>;
    transactionTrends: Array<{ date: Date; count: number; volume: number }>;
    feesPaid: number;
    rewardsEarned: number;
}

export interface StakingAnalytics {
    totalStaked: number;
    totalRewards: number;
    averageAPY: number;
    topPools: Array<{ poolId: string; name: string; amount: number; rewards: number; apy: number }>;
    stakingHistory: Array<{ date: Date; staked: number; rewards: number }>;
}

export interface NFTCollectionAnalytics {
    totalNFTs: number;
    totalValue: number;
    averageValue: number;
    topCollections: Array<{ policyId: string; name: string; count: number; value: number }>;
    recentMints: Array<{ assetId: string; name: string; value: number; date: Date }>;
    floorPrices: Array<{ policyId: string; floorPrice: number; lastUpdated: Date }>;
}

export interface RiskMetrics {
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    beta: number;
    correlation: number;
}

/**
 * Service quản lý Portfolio và Analytics
 * Cung cấp insights về hiệu suất, phân tích rủi ro, và báo cáo chi tiết
 */
export class PortfolioAnalyticsService {
    private static instance: PortfolioAnalyticsService;
    private cardanoAPI: CardanoAPIService;
    private nftService: NFTManagementService;
    private stakingService: DeFiStakingService;

    constructor() {
        this.cardanoAPI = CardanoAPIService.getInstance();
        this.nftService = NFTManagementService.getInstance();
        this.stakingService = DeFiStakingService.getInstance();
    }

    static getInstance(): PortfolioAnalyticsService {
        if (!PortfolioAnalyticsService.instance) {
            PortfolioAnalyticsService.instance = new PortfolioAnalyticsService();
        }
        return PortfolioAnalyticsService.instance;
    }

    /**
     * Lấy portfolio summary
     */
    async getPortfolioSummary(address: string): Promise<PortfolioSummary> {
        try {
            console.log('Getting portfolio summary for address:', address);

            // Get all assets
            const [adaBalance, nfts, tokens, stakingPositions, liquidityPositions] = await Promise.all([
                this.getADABalance(address),
                this.nftService.getAddressNFTs(address),
                this.getTokenBalances(address),
                this.stakingService.getStakingPositions(address),
                this.stakingService.getLiquidityPositions(address)
            ]);

            // Calculate values
            const adaValue = adaBalance * this.getADAPrice();
            const nftValue = this.calculateNFTValue(nfts);
            const tokenValue = this.calculateTokenValue(tokens);
            const lpValue = this.calculateLiquidityValue(liquidityPositions);
            const stakingValue = this.calculateStakingValue(stakingPositions);
            const rewardsValue = await this.calculateTotalRewards(address);

            const totalValue = adaValue + nftValue + tokenValue + lpValue + stakingValue + rewardsValue;

            // Calculate changes (simplified for now)
            const totalChange24h = await this.calculatePortfolioChange(address, 1);
            const totalChange7d = await this.calculatePortfolioChange(address, 7);
            const totalChange30d = await this.calculatePortfolioChange(address, 30);

            const summary: PortfolioSummary = {
                totalValue,
                totalChange24h,
                totalChange7d,
                totalChange30d,
                adaValue,
                nftValue,
                tokenValue,
                lpValue,
                stakingValue,
                rewardsValue,
                lastUpdated: new Date()
            };

            // Cache summary
            await this.cachePortfolioSummary(address, summary);

            return summary;

        } catch (error) {
            console.error('Failed to get portfolio summary:', error);
            throw new Error(`Failed to get portfolio summary: ${error}`);
        }
    }

    /**
     * Lấy portfolio assets
     */
    async getPortfolioAssets(address: string): Promise<PortfolioAsset[]> {
        try {
            const [adaBalance, nfts, tokens, stakingPositions, liquidityPositions] = await Promise.all([
                this.getADABalance(address),
                this.nftService.getAddressNFTs(address),
                this.getTokenBalances(address),
                this.stakingService.getStakingPositions(address),
                this.stakingService.getLiquidityPositions(address)
            ]);

            const assets: PortfolioAsset[] = [];

            // Add ADA
            if (adaBalance > 0) {
                const adaPrice = this.getADAPrice();
                assets.push({
                    id: 'ada',
                    assetId: 'ada',
                    name: 'Cardano',
                    symbol: 'ADA',
                    type: 'ada',
                    quantity: adaBalance.toString(),
                    price: adaPrice,
                    value: adaBalance * adaPrice,
                    change24h: this.getADAChange24h(),
                    change7d: this.getADAChange7d(),
                    change30d: this.getADAChange30d(),
                    allocation: 0, // Will be calculated
                    lastUpdated: new Date()
                });
            }

            // Add NFTs
            nfts.forEach(nft => {
                const nftValue = this.estimateNFTValue(nft);
                assets.push({
                    id: nft.id,
                    assetId: nft.assetId,
                    name: nft.metadata?.name || 'Unknown NFT',
                    symbol: 'NFT',
                    type: 'nft',
                    quantity: nft.quantity,
                    price: nftValue,
                    value: nftValue * parseFloat(nft.quantity),
                    change24h: 0, // NFTs don't have daily changes like tokens
                    change7d: 0,
                    change30d: 0,
                    allocation: 0,
                    lastUpdated: new Date()
                });
            });

            // Add tokens
            tokens.forEach(token => {
                const tokenPrice = this.getTokenPrice(token.symbol);
                assets.push({
                    id: token.id,
                    assetId: token.assetId,
                    name: token.name,
                    symbol: token.symbol,
                    type: 'token',
                    quantity: token.quantity,
                    price: tokenPrice,
                    value: tokenPrice * parseFloat(token.quantity),
                    change24h: this.getTokenChange24h(token.symbol),
                    change7d: this.getTokenChange7d(token.symbol),
                    change30d: this.getTokenChange30d(token.symbol),
                    allocation: 0,
                    lastUpdated: new Date()
                });
            });

            // Add staking positions
            stakingPositions.forEach(position => {
                assets.push({
                    id: position.id,
                    assetId: `staking_${position.poolId}`,
                    name: `Staking in ${position.poolName}`,
                    symbol: 'ADA',
                    type: 'ada',
                    quantity: position.amount,
                    price: this.getADAPrice(),
                    value: parseFloat(position.amount) * this.getADAPrice(),
                    change24h: this.getADAChange24h(),
                    change7d: this.getADAChange7d(),
                    change30d: this.getADAChange30d(),
                    allocation: 0,
                    lastUpdated: new Date()
                });
            });

            // Add liquidity positions
            liquidityPositions.forEach(position => {
                const lpValue = this.calculateLiquidityPositionValue(position);
                assets.push({
                    id: position.id,
                    assetId: `lp_${position.poolId}`,
                    name: `LP ${position.poolName}`,
                    symbol: 'LP',
                    type: 'lp_token',
                    quantity: position.liquidityTokens,
                    price: lpValue / parseFloat(position.liquidityTokens || '1'),
                    value: lpValue,
                    change24h: 0, // LP tokens have complex pricing
                    change7d: 0,
                    change30d: 0,
                    allocation: 0,
                    lastUpdated: new Date()
                });
            });

            // Calculate allocations
            const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
            assets.forEach(asset => {
                asset.allocation = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
            });

            return assets;

        } catch (error) {
            console.error('Failed to get portfolio assets:', error);
            throw new Error(`Failed to get portfolio assets: ${error}`);
        }
    }

    /**
     * Lấy portfolio performance history
     */
    async getPortfolioPerformance(
        address: string,
        days: number = 30
    ): Promise<PortfolioPerformance[]> {
        try {
            const performance: PortfolioPerformance[] = [];
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

            // Get historical data points
            for (let i = 0; i <= days; i++) {
                const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
                const value = await this.getHistoricalPortfolioValue(address, date);
                const previousValue = i > 0 ? await this.getHistoricalPortfolioValue(address, new Date(date.getTime() - 24 * 60 * 60 * 1000)) : value;

                const change = value - previousValue;
                const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

                performance.push({
                    date,
                    value,
                    change,
                    changePercent
                });
            }

            return performance;

        } catch (error) {
            console.error('Failed to get portfolio performance:', error);
            return [];
        }
    }

    /**
     * Lấy transaction analytics
     */
    async getTransactionAnalytics(address: string): Promise<TransactionAnalytics> {
        try {
            // Get transaction history
            const transactions = await this.cardanoAPI.getAddressTransactions(address);

            // Calculate transaction metrics
            const totalVolume = transactions.reduce((sum, tx) => {
                const amount = (tx as any).amount || '0';
                return sum + parseFloat(amount);
            }, 0);

            const feesPaid = transactions.reduce((sum, tx) => {
                const fee = (tx as any).fee || '0';
                return sum + parseFloat(fee);
            }, 0);

            const transactionCount = transactions.length;

            // Calculate recipient distribution
            const recipientMap = new Map<string, { count: number; volume: number }>();

            transactions.forEach(tx => {
                const to = (tx as any).to;
                if (to && to !== address) {
                    const current = recipientMap.get(to) || { count: 0, volume: 0 };
                    current.count += 1;
                    const amount = (tx as any).amount || '0';
                    current.volume += parseFloat(amount);
                    recipientMap.set(to, current);
                }
            });

            // Calculate daily volume trends
            const dailyVolume = new Map<string, number>();

            transactions.forEach(tx => {
                const timestamp = (tx as any).timestamp || tx.block_time;
                if (timestamp) {
                    const txDate = new Date(timestamp);
                    const dateKey = txDate.toISOString().split('T')[0];

                    const dayTransactions = transactions.filter(t => {
                        const tTimestamp = (t as any).timestamp || t.block_time;
                        if (tTimestamp) {
                            const tDate = new Date(tTimestamp);
                            return tDate.toISOString().split('T')[0] === dateKey;
                        }
                        return false;
                    });

                    const volume = dayTransactions.reduce((sum, t) => {
                        const amount = (t as any).amount || '0';
                        return sum + parseFloat(amount);
                    }, 0);

                    dailyVolume.set(dateKey, volume);
                }
            });

            // Get rewards earned
            const rewardsEarned = await this.calculateTotalRewards(address);

            // Analyze recipients
            const mostFrequentRecipients = Array.from(recipientMap.entries())
                .map(([address, data]) => ({ address, ...data }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            // Calculate transaction trends (last 30 days)
            const trends: Array<{ date: Date; count: number; volume: number }> = [];
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            for (let i = 0; i < 30; i++) {
                const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
                const dateKey = date.toISOString().split('T')[0];
                const count = dailyVolume.get(dateKey) || 0;
                const volume = dailyVolume.get(dateKey) || 0;

                trends.push({ date, count, volume });
            }

            return {
                totalTransactions: transactionCount,
                totalVolume,
                averageTransactionSize: transactionCount > 0 ? totalVolume / transactionCount : 0,
                mostFrequentRecipients,
                transactionTrends: trends,
                feesPaid,
                rewardsEarned
            };

        } catch (error) {
            console.error('Failed to get transaction analytics:', error);
            throw new Error(`Failed to get transaction analytics: ${error}`);
        }
    }

    /**
     * Lấy staking analytics
     */
    async getStakingAnalytics(address: string): Promise<StakingAnalytics> {
        try {
            const stakingPositions = await this.stakingService.getStakingPositions(address);

            const totalStaked = stakingPositions.reduce((sum, pos) => sum + parseFloat(pos.amount), 0);
            const totalRewards = stakingPositions.reduce((sum, pos) => sum + parseFloat(pos.rewards), 0);

            // Calculate average APY
            const totalAPY = stakingPositions.reduce((sum, pos) => sum + 5.5, 0); // Simplified
            const averageAPY = stakingPositions.length > 0 ? totalAPY / stakingPositions.length : 0;

            // Get top pools
            const topPools = stakingPositions
                .map(pos => ({
                    poolId: pos.poolId,
                    name: pos.poolName,
                    amount: parseFloat(pos.amount),
                    rewards: parseFloat(pos.rewards),
                    apy: 5.5 // Simplified
                }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);

            // Generate staking history (simplified)
            const stakingHistory: Array<{ date: Date; staked: number; rewards: number }> = [];
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days

            for (let i = 0; i < 90; i += 7) { // Weekly data points
                const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
                const staked = totalStaked * (0.5 + (i / 90) * 0.5); // Simulate growth
                const rewards = totalRewards * (i / 90); // Simulate reward accumulation

                stakingHistory.push({ date, staked, rewards });
            }

            return {
                totalStaked,
                totalRewards,
                averageAPY,
                topPools,
                stakingHistory
            };

        } catch (error) {
            console.error('Failed to get staking analytics:', error);
            throw new Error(`Failed to get staking analytics: ${error}`);
        }
    }

    /**
     * Lấy NFT collection analytics
     */
    async getNFTCollectionAnalytics(address: string): Promise<NFTCollectionAnalytics> {
        try {
            const nfts = await this.nftService.getAddressNFTs(address);

            const totalNFTs = nfts.length;
            const totalValue = this.calculateNFTValue(nfts);
            const averageValue = totalNFTs > 0 ? totalValue / totalNFTs : 0;

            // Group by policy ID
            const collectionMap = new Map<string, { count: number; value: number }>();
            nfts.forEach(nft => {
                const current = collectionMap.get(nft.policyId) || { count: 0, value: 0 };
                current.count++;
                current.value += this.estimateNFTValue(nft);
                collectionMap.set(nft.policyId, current);
            });

            const topCollections = Array.from(collectionMap.entries())
                .map(([policyId, data]) => ({ policyId, name: `Collection ${policyId.slice(0, 8)}`, ...data }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 10);

            // Get recent mints
            const recentMints = nfts
                .filter(nft => nft.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                .map(nft => ({
                    assetId: nft.assetId,
                    name: nft.metadata?.name || 'Unknown NFT',
                    value: this.estimateNFTValue(nft),
                    date: nft.createdAt
                }))
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 10);

            // Mock floor prices
            const floorPrices = Array.from(collectionMap.keys()).map(policyId => ({
                policyId,
                floorPrice: Math.random() * 100 + 10, // Mock data
                lastUpdated: new Date()
            }));

            return {
                totalNFTs,
                totalValue,
                averageValue,
                topCollections,
                recentMints,
                floorPrices
            };

        } catch (error) {
            console.error('Failed to get NFT collection analytics:', error);
            throw new Error(`Failed to get NFT collection analytics: ${error}`);
        }
    }

    /**
     * Lấy risk metrics
     */
    async getRiskMetrics(address: string): Promise<RiskMetrics> {
        try {
            // Get portfolio performance
            const performance = await this.getPortfolioPerformance(address, 90);

            if (performance.length < 2) {
                return {
                    volatility: 0,
                    sharpeRatio: 0,
                    maxDrawdown: 0,
                    beta: 1,
                    correlation: 0
                };
            }

            // Calculate volatility
            const returns = performance.slice(1).map((p, i) => {
                const prev = performance[i];
                return prev.value > 0 ? (p.value - prev.value) / prev.value : 0;
            });

            const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
            const volatility = Math.sqrt(variance);

            // Calculate Sharpe ratio (simplified)
            const riskFreeRate = 0.02; // 2% annual
            const sharpeRatio = (meanReturn - riskFreeRate / 365) / volatility;

            // Calculate max drawdown
            let maxDrawdown = 0;
            let peak = performance[0].value;

            performance.forEach(p => {
                if (p.value > peak) {
                    peak = p.value;
                }
                const drawdown = (peak - p.value) / peak;
                if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                }
            });

            // Calculate beta (simplified - assuming 1 for now)
            const beta = 1;

            // Calculate correlation with ADA (simplified)
            const correlation = 0.8; // High correlation with ADA

            return {
                volatility,
                sharpeRatio,
                maxDrawdown,
                beta,
                correlation
            };

        } catch (error) {
            console.error('Failed to get risk metrics:', error);
            return {
                volatility: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                beta: 1,
                correlation: 0
            };
        }
    }

    // Private helper methods
    private async getADABalance(address: string): Promise<number> {
        try {
            const balance = await this.cardanoAPI.getAddressBalance(address);
            return parseFloat(balance) / 1000000; // Convert from lovelace to ADA
        } catch (error) {
            console.error('Failed to get ADA balance:', error);
            return 0;
        }
    }

    private async getTokenBalances(address: string): Promise<Array<{ id: string; assetId: string; name: string; symbol: string; quantity: string }>> {
        try {
            const assets = await this.cardanoAPI.getAddressAssets(address);
            return assets
                .filter(asset => asset.quantity !== '1' && asset.asset_name) // Filter out NFTs
                .map(asset => ({
                    id: asset.asset,
                    assetId: asset.asset,
                    name: asset.asset_name || 'Unknown Token',
                    symbol: asset.asset_name || 'UNKNOWN',
                    quantity: asset.quantity
                }));
        } catch (error) {
            console.error('Failed to get token balances:', error);
            return [];
        }
    }

    private getADAPrice(): number {
        // This would integrate with price APIs
        // For now, return mock price
        return 0.65;
    }

    private getADAChange24h(): number {
        return 2.5; // Mock 2.5% change
    }

    private getADAChange7d(): number {
        return -1.2; // Mock -1.2% change
    }

    private getADAChange30d(): number {
        return 8.7; // Mock 8.7% change
    }

    private getTokenPrice(symbol: string): number {
        // This would integrate with price APIs
        // For now, return mock prices
        const prices: { [key: string]: number } = {
            'AGIX': 0.25,
            'MIN': 0.15,
            'SUNDAE': 0.08
        };
        return prices[symbol] || 0.01;
    }

    private getTokenChange24h(symbol: string): number {
        // Mock changes
        return Math.random() * 10 - 5; // -5% to +5%
    }

    private getTokenChange7d(symbol: string): number {
        return Math.random() * 20 - 10; // -10% to +10%
    }

    private getTokenChange30d(symbol: string): number {
        return Math.random() * 40 - 20; // -20% to +20%
    }

    private calculateNFTValue(nfts: any[]): number {
        return nfts.reduce((sum, nft) => sum + this.estimateNFTValue(nft), 0);
    }

    private estimateNFTValue(nft: any): number {
        // This would integrate with NFT pricing APIs
        // For now, return mock values
        return Math.random() * 100 + 10; // $10-$110
    }

    private calculateTokenValue(tokens: any[]): number {
        return tokens.reduce((sum, token) => {
            const price = this.getTokenPrice(token.symbol);
            return sum + (price * parseFloat(token.quantity));
        }, 0);
    }

    private calculateLiquidityValue(positions: any[]): number {
        return positions.reduce((sum, pos) => sum + this.calculateLiquidityPositionValue(pos), 0);
    }

    private calculateLiquidityPositionValue(position: any): number {
        // Simplified calculation
        return parseFloat(position.tokenAAmount || '0') * this.getADAPrice() * 2;
    }

    private calculateStakingValue(positions: any[]): number {
        return positions.reduce((sum, pos) => sum + parseFloat(pos.amount), 0) * this.getADAPrice();
    }

    private async calculateTotalRewards(address: string): Promise<number> {
        try {
            const stakingPositions = await this.stakingService.getStakingPositions(address);
            return stakingPositions.reduce((sum, pos) => sum + parseFloat(pos.rewards || '0'), 0);
        } catch (error) {
            return 0;
        }
    }

    private async calculatePortfolioChange(address: string, days: number): Promise<number> {
        try {
            const currentValue = await this.getPortfolioSummary(address);
            const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const pastValue = await this.getHistoricalPortfolioValue(address, pastDate);

            return pastValue > 0 ? ((currentValue.totalValue - pastValue) / pastValue) * 100 : 0;
        } catch (error) {
            return 0;
        }
    }

    private async getHistoricalPortfolioValue(address: string, date: Date): Promise<number> {
        // This would integrate with historical data APIs
        // For now, return mock data
        const baseValue = 10000; // Base portfolio value
        const timeFactor = (Date.now() - date.getTime()) / (30 * 24 * 60 * 60 * 1000); // Days ago
        return baseValue * (1 + timeFactor * 0.01); // 1% growth per day
    }

    private async cachePortfolioSummary(address: string, summary: PortfolioSummary): Promise<void> {
        try {
            await AsyncStorage.setItem(`portfolio_summary_${address}`, JSON.stringify(summary));
        } catch (error) {
            console.error('Failed to cache portfolio summary:', error);
        }
    }
}
