import logger from '../../utils/Logger';
import AssetPriceService from './AssetPriceService';
import { CardanoAPIService } from '../CardanoAPIService';
import { NFTManagementService } from '../NFTManagementService';
import { DeFiStakingService } from '../DeFiStakingService';

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

export interface AssetAllocation {
    type: string;
    value: number;
    percentage: number;
    assets: PortfolioAsset[];
}

/**
 * PortfolioCalculationService - Handles all portfolio value calculations and allocations
 * 
 * Responsibilities:
 * - Portfolio value calculations
 * - Asset allocation analysis
 * - Performance calculations
 * - Historical portfolio values
 * - Portfolio composition analysis
 * - Asset value estimations
 */
export class PortfolioCalculationService {
    private static instance: PortfolioCalculationService;
    private priceService: AssetPriceService;
    private cardanoAPI: CardanoAPIService;
    private nftService: NFTManagementService;
    private stakingService: DeFiStakingService;

    private constructor() {
        this.priceService = AssetPriceService.getInstance();
        this.cardanoAPI = CardanoAPIService.getInstance();
        this.nftService = NFTManagementService.getInstance();
        this.stakingService = DeFiStakingService.getInstance();
    }

    public static getInstance(): PortfolioCalculationService {
        if (!PortfolioCalculationService.instance) {
            PortfolioCalculationService.instance = new PortfolioCalculationService();
        }
        return PortfolioCalculationService.instance;
    }

    /**
     * Calculate complete portfolio summary
     * @param address - Wallet address
     * @returns Portfolio summary with all values
     */
    async calculatePortfolioSummary(address: string): Promise<PortfolioSummary> {
        try {
            logger.debug('Calculating portfolio summary', 'PortfolioCalculationService.calculatePortfolioSummary', { address });

            // Get portfolio assets
            const assets = await this.getPortfolioAssets(address);
            
            // Calculate individual values
            const adaValue = await this.calculateADAValue(address);
            const nftValue = await this.calculateNFTValue(address);
            const tokenValue = await this.calculateTokenValue(address);
            const lpValue = await this.calculateLiquidityValue(address);
            const stakingValue = await this.calculateStakingValue(address);
            const rewardsValue = await this.calculateRewardsValue(address);

            const totalValue = adaValue + nftValue + tokenValue + lpValue + stakingValue + rewardsValue;

            // Calculate percentage changes
            const totalChange24h = await this.calculatePortfolioChange(assets, 1);
            const totalChange7d = await this.calculatePortfolioChange(assets, 7);
            const totalChange30d = await this.calculatePortfolioChange(assets, 30);

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

            logger.info('Portfolio summary calculated', 'PortfolioCalculationService.calculatePortfolioSummary', {
                address,
                totalValue,
                totalChange24h
            });

            return summary;

        } catch (error) {
            logger.error('Failed to calculate portfolio summary', 'PortfolioCalculationService.calculatePortfolioSummary', {
                address,
                error
            });
            throw new Error(`Portfolio calculation failed: ${error}`);
        }
    }

    /**
     * Get all portfolio assets with values
     * @param address - Wallet address
     * @returns Array of portfolio assets
     */
    async getPortfolioAssets(address: string): Promise<PortfolioAsset[]> {
        try {
            const assets: PortfolioAsset[] = [];

            // Get ADA balance
            const adaBalance = await this.cardanoAPI.getAddressBalance(address);
            const adaPrice = await this.priceService.getADAPrice();
            const adaPriceData = await this.priceService.getAssetPrice('ADA');

            if (parseFloat(adaBalance) > 0) {
                assets.push({
                    id: 'ada',
                    assetId: 'ada',
                    name: 'Cardano',
                    symbol: 'ADA',
                    type: 'ada',
                    quantity: adaBalance,
                    price: adaPrice,
                    value: parseFloat(adaBalance) * adaPrice,
                    change24h: adaPriceData.change24h,
                    change7d: adaPriceData.change7d,
                    change30d: adaPriceData.change30d,
                    allocation: 0, // Will be calculated later
                    lastUpdated: new Date()
                });
            }

            // Get tokens
            const tokens = await this.cardanoAPI.getAddressAssets(address);
            for (const token of tokens) {
                const priceData = await this.priceService.getAssetPrice(token.symbol);
                const value = parseFloat(token.quantity) * priceData.price;

                assets.push({
                    id: token.assetId,
                    assetId: token.assetId,
                    name: token.name,
                    symbol: token.symbol,
                    type: 'token',
                    quantity: token.quantity,
                    price: priceData.price,
                    value,
                    change24h: priceData.change24h,
                    change7d: priceData.change7d,
                    change30d: priceData.change30d,
                    allocation: 0,
                    lastUpdated: new Date()
                });
            }

            // Get NFTs
            const nfts = await this.nftService.getAddressNFTs(address);
            for (const nft of nfts) {
                const estimatedValue = await this.estimateNFTValue(nft);

                assets.push({
                    id: nft.assetId,
                    assetId: nft.assetId,
                    name: (nft as any).name || 'Unknown NFT',
                    symbol: 'NFT',
                    type: 'nft',
                    quantity: '1',
                    price: estimatedValue,
                    value: estimatedValue,
                    change24h: 0, // NFTs don't have 24h price changes typically
                    change7d: 0,
                    change30d: 0,
                    allocation: 0,
                    lastUpdated: new Date()
                });
            }

            // Get liquidity positions
            const lpPositions = await this.stakingService.getLiquidityPositions(address);
            for (const position of lpPositions) {
                const value = await this.calculateLiquidityPositionValue(position);

                assets.push({
                    id: (position as any).id,
                    assetId: (position as any).id,
                    name: `LP ${(position as any).tokenA}/${(position as any).tokenB}`,
                    symbol: 'LP',
                    type: 'lp_token',
                    quantity: (position as any).lpTokens,
                    price: value / parseFloat((position as any).lpTokens),
                    value,
                    change24h: 0, // LP tokens need special calculation
                    change7d: 0,
                    change30d: 0,
                    allocation: 0,
                    lastUpdated: new Date()
                });
            }

            // Calculate allocations
            const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
            assets.forEach(asset => {
                asset.allocation = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
            });

            logger.debug('Portfolio assets retrieved', 'PortfolioCalculationService.getPortfolioAssets', {
                address,
                assetCount: assets.length,
                totalValue
            });

            return assets;

        } catch (error) {
            logger.error('Failed to get portfolio assets', 'PortfolioCalculationService.getPortfolioAssets', {
                address,
                error
            });
            return [];
        }
    }

    /**
     * Calculate portfolio performance over time
     * @param address - Wallet address
     * @param days - Number of days of history
     * @returns Array of performance data points
     */
    async calculatePortfolioPerformance(address: string, days: number = 30): Promise<PortfolioPerformance[]> {
        try {
            const performance: PortfolioPerformance[] = [];
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

            logger.debug('Calculating portfolio performance', 'PortfolioCalculationService.calculatePortfolioPerformance', {
                address,
                days,
                startDate,
                endDate
            });

            for (let i = 0; i <= days; i++) {
                const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
                const value = await this.getHistoricalPortfolioValue(address, date);
                
                let previousValue = value;
                if (i > 0) {
                    const previousDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
                    previousValue = await this.getHistoricalPortfolioValue(address, previousDate);
                }

                const change = value - previousValue;
                const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

                performance.push({
                    date,
                    value,
                    change,
                    changePercent
                });
            }

            logger.info('Portfolio performance calculated', 'PortfolioCalculationService.calculatePortfolioPerformance', {
                address,
                days,
                dataPoints: performance.length
            });

            return performance;

        } catch (error) {
            logger.error('Failed to calculate portfolio performance', 'PortfolioCalculationService.calculatePortfolioPerformance', {
                address,
                days,
                error
            });
            return [];
        }
    }

    /**
     * Get asset allocation breakdown
     * @param address - Wallet address
     * @returns Asset allocation by type
     */
    async getAssetAllocation(address: string): Promise<AssetAllocation[]> {
        try {
            const assets = await this.getPortfolioAssets(address);
            const allocations: AssetAllocation[] = [];

            // Group by asset type
            const typeGroups = new Map<string, PortfolioAsset[]>();
            assets.forEach(asset => {
                if (!typeGroups.has(asset.type)) {
                    typeGroups.set(asset.type, []);
                }
                typeGroups.get(asset.type)!.push(asset);
            });

            const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);

            // Create allocation objects
            for (const [type, typeAssets] of typeGroups.entries()) {
                const typeValue = typeAssets.reduce((sum, asset) => sum + asset.value, 0);
                const percentage = totalValue > 0 ? (typeValue / totalValue) * 100 : 0;

                allocations.push({
                    type: this.getTypeDisplayName(type),
                    value: typeValue,
                    percentage,
                    assets: typeAssets
                });
            }

            // Sort by value descending
            allocations.sort((a, b) => b.value - a.value);

            logger.debug('Asset allocation calculated', 'PortfolioCalculationService.getAssetAllocation', {
                address,
                allocationCount: allocations.length,
                totalValue
            });

            return allocations;

        } catch (error) {
            logger.error('Failed to get asset allocation', 'PortfolioCalculationService.getAssetAllocation', {
                address,
                error
            });
            return [];
        }
    }

    /**
     * Calculate portfolio value at specific date
     * @param address - Wallet address
     * @param date - Target date
     * @returns Portfolio value at that date
     */
    async getHistoricalPortfolioValue(address: string, date: Date): Promise<number> {
        try {
            // Get current assets (simplified - in reality would need historical balance data)
            const assets = await this.getPortfolioAssets(address);
            let totalValue = 0;

            for (const asset of assets) {
                if (asset.type === 'ada' || asset.type === 'token') {
                    const historicalPrice = await this.priceService.getPriceAtDate(asset.symbol, date);
                    totalValue += parseFloat(asset.quantity) * historicalPrice;
                } else if (asset.type === 'nft') {
                    // NFT values are harder to track historically, use current estimate
                    totalValue += asset.value;
                } else if (asset.type === 'lp_token') {
                    // LP token values also complex historically
                    totalValue += asset.value;
                }
            }

            logger.debug('Historical portfolio value calculated', 'PortfolioCalculationService.getHistoricalPortfolioValue', {
                address,
                date: date.toISOString(),
                value: totalValue
            });

            return totalValue;

        } catch (error) {
            logger.warn('Failed to get historical portfolio value, using estimate', 'PortfolioCalculationService.getHistoricalPortfolioValue', {
                address,
                date,
                error
            });

            // Fallback: estimate based on current value and time factor
            const currentSummary = await this.calculatePortfolioSummary(address);
            const daysSince = (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
            const estimatedGrowthRate = 0.01; // 1% per day average (simplified)
            
            return currentSummary.totalValue / (1 + estimatedGrowthRate * daysSince);
        }
    }

    // Private calculation methods

    /**
     * Calculate ADA value
     */
    private async calculateADAValue(address: string): Promise<number> {
        try {
            const adaBalance = await this.cardanoAPI.getAddressBalance(address);
            const adaPrice = await this.priceService.getADAPrice();
            return parseFloat(adaBalance) * adaPrice;
        } catch (error) {
            logger.warn('Failed to calculate ADA value', 'PortfolioCalculationService.calculateADAValue', { address, error });
            return 0;
        }
    }

    /**
     * Calculate NFT value
     */
    private async calculateNFTValue(address: string): Promise<number> {
        try {
            const nfts = await this.nftService.getAddressNFTs(address);
            let totalValue = 0;

            for (const nft of nfts) {
                totalValue += await this.estimateNFTValue(nft);
            }

            return totalValue;
        } catch (error) {
            logger.warn('Failed to calculate NFT value', 'PortfolioCalculationService.calculateNFTValue', { address, error });
            return 0;
        }
    }

    /**
     * Calculate token value
     */
    private async calculateTokenValue(address: string): Promise<number> {
        try {
            const tokens = await this.cardanoAPI.getAddressAssets(address);
            let totalValue = 0;

            for (const token of tokens) {
                const priceData = await this.priceService.getAssetPrice(token.symbol);
                totalValue += parseFloat(token.quantity) * priceData.price;
            }

            return totalValue;
        } catch (error) {
            logger.warn('Failed to calculate token value', 'PortfolioCalculationService.calculateTokenValue', { address, error });
            return 0;
        }
    }

    /**
     * Calculate liquidity value
     */
    private async calculateLiquidityValue(address: string): Promise<number> {
        try {
            const positions = await this.stakingService.getLiquidityPositions(address);
            let totalValue = 0;

            for (const position of positions) {
                totalValue += await this.calculateLiquidityPositionValue(position);
            }

            return totalValue;
        } catch (error) {
            logger.warn('Failed to calculate liquidity value', 'PortfolioCalculationService.calculateLiquidityValue', { address, error });
            return 0;
        }
    }

    /**
     * Calculate staking value
     */
    private async calculateStakingValue(address: string): Promise<number> {
        try {
            const positions = await this.stakingService.getStakingPositions(address);
            const adaPrice = await this.priceService.getADAPrice();
            
            const totalStaked = positions.reduce((sum, pos) => sum + parseFloat(pos.amount), 0);
            return totalStaked * adaPrice;
        } catch (error) {
            logger.warn('Failed to calculate staking value', 'PortfolioCalculationService.calculateStakingValue', { address, error });
            return 0;
        }
    }

    /**
     * Calculate rewards value
     */
    private async calculateRewardsValue(address: string): Promise<number> {
        try {
            const positions = await this.stakingService.getStakingPositions(address);
            const adaPrice = await this.priceService.getADAPrice();
            
            const totalRewards = positions.reduce((sum, pos) => sum + parseFloat(pos.rewards || '0'), 0);
            return totalRewards * adaPrice;
        } catch (error) {
            logger.warn('Failed to calculate rewards value', 'PortfolioCalculationService.calculateRewardsValue', { address, error });
            return 0;
        }
    }

    /**
     * Calculate portfolio change over time period
     */
    private async calculatePortfolioChange(assets: PortfolioAsset[], days: number): Promise<number> {
        try {
            const currentValue = assets.reduce((sum, asset) => sum + asset.value, 0);
            
            // Simplified calculation using weighted average of asset changes
            let weightedChange = 0;
            let totalWeight = 0;

            for (const asset of assets) {
                let assetChange = 0;
                if (days === 1) assetChange = asset.change24h;
                else if (days === 7) assetChange = asset.change7d;
                else if (days === 30) assetChange = asset.change30d;

                const weight = asset.value;
                weightedChange += assetChange * weight;
                totalWeight += weight;
            }

            return totalWeight > 0 ? weightedChange / totalWeight : 0;

        } catch (error) {
            logger.warn('Failed to calculate portfolio change', 'PortfolioCalculationService.calculatePortfolioChange', { days, error });
            return 0;
        }
    }

    /**
     * Estimate NFT value
     */
    private async estimateNFTValue(nft: any): Promise<number> {
        try {
            // This would integrate with NFT pricing APIs like OpenCNFT, jpg.store, etc.
            // For now, return simplified estimation
            
            // Check if there's floor price data
            if (nft.floorPrice && nft.floorPrice > 0) {
                return nft.floorPrice;
            }

            // Fallback to basic estimation
            const baseValue = 10; // Base value in USD
            const rarityMultiplier = nft.rarity ? (1 + nft.rarity / 100) : 1;
            
            return baseValue * rarityMultiplier;

        } catch (error) {
            logger.warn('Failed to estimate NFT value', 'PortfolioCalculationService.estimateNFTValue', { nft, error });
            return 10; // Default $10
        }
    }

    /**
     * Calculate liquidity position value
     */
    private async calculateLiquidityPositionValue(position: any): Promise<number> {
        try {
            // Get prices for both tokens in the LP
            const tokenAPrice = position.tokenA === 'ADA' 
                ? await this.priceService.getADAPrice()
                : (await this.priceService.getAssetPrice(position.tokenA)).price;

            const tokenBPrice = position.tokenB === 'ADA'
                ? await this.priceService.getADAPrice()
                : (await this.priceService.getAssetPrice(position.tokenB)).price;

            const tokenAValue = parseFloat(position.tokenAAmount || '0') * tokenAPrice;
            const tokenBValue = parseFloat(position.tokenBAmount || '0') * tokenBPrice;

            return tokenAValue + tokenBValue;

        } catch (error) {
            logger.warn('Failed to calculate liquidity position value', 'PortfolioCalculationService.calculateLiquidityPositionValue', { position, error });
            return 0;
        }
    }

    /**
     * Get display name for asset type
     */
    private getTypeDisplayName(type: string): string {
        const displayNames: { [key: string]: string } = {
            'ada': 'Cardano (ADA)',
            'token': 'Native Tokens',
            'nft': 'NFTs',
            'lp_token': 'Liquidity Positions'
        };

        return displayNames[type] || type;
    }
}

export default PortfolioCalculationService;
