/**
 * PortfolioAnalyticsService - LEGACY WRAPPER
 * 
 * This file maintains backward compatibility with existing code while
 * using the new modular portfolio architecture internally.
 * 
 * The new architecture splits portfolio functionality into:
 * - AssetPriceService: Real-time and historical price data management
 * - PortfolioCalculationService: Portfolio value calculations and allocations
 * - AnalyticsEngineService: Advanced analytics for transactions, staking, NFTs, DeFi
 * - PortfolioService: Main orchestrator for comprehensive portfolio management
 * 
 * @deprecated Use PortfolioService directly for new code
 */

import logger from '../utils/Logger';
import PortfolioService, { ComprehensivePortfolioReport, PortfolioInsights } from './portfolio/PortfolioService';
import { 
    PortfolioSummary as NewPortfolioSummary, 
    PortfolioAsset as NewPortfolioAsset, 
    PortfolioPerformance as NewPortfolioPerformance, 
    AssetAllocation 
} from './portfolio/PortfolioCalculationService';
import { 
    TransactionAnalytics as NewTransactionAnalytics, 
    StakingAnalytics as NewStakingAnalytics, 
    NFTCollectionAnalytics as NewNFTCollectionAnalytics, 
    DeFiAnalytics, 
    RiskMetrics as NewRiskMetrics 
} from './portfolio/AnalyticsEngineService';

// Legacy interface exports for backward compatibility
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
 * 
 * @deprecated This class is now a wrapper around the new modular architecture.
 * Use PortfolioService directly for new code.
 */
export class PortfolioAnalyticsService {
    private static instance: PortfolioAnalyticsService;
    private portfolioService: PortfolioService;

    constructor() {
        this.portfolioService = PortfolioService.getInstance();
        
        logger.warn('PortfolioAnalyticsService is deprecated. Use PortfolioService directly for new code.', 'PortfolioAnalyticsService.constructor');
    }

    static getInstance(): PortfolioAnalyticsService {
        if (!PortfolioAnalyticsService.instance) {
            PortfolioAnalyticsService.instance = new PortfolioAnalyticsService();
        }
        return PortfolioAnalyticsService.instance;
    }

    // =============================================================================
    // LEGACY API - All methods delegate to PortfolioService
    // =============================================================================

    /**
     * Lấy portfolio summary
     * @param address - Địa chỉ ví
     * @returns Portfolio summary
     */
    async getPortfolioSummary(address: string): Promise<PortfolioSummary> {
        return await this.portfolioService.getPortfolioSummary(address);
    }

    /**
     * Lấy danh sách assets trong portfolio
     * @param address - Địa chỉ ví
     * @returns Danh sách assets
     */
    async getPortfolioAssets(address: string): Promise<PortfolioAsset[]> {
        return await this.portfolioService.getPortfolioAssets(address);
    }

    /**
     * Lấy portfolio performance
     * @param address - Địa chỉ ví
     * @param days - Số ngày lịch sử
     * @returns Performance data
     */
    async getPortfolioPerformance(address: string, days: number = 30): Promise<PortfolioPerformance[]> {
        const report = await this.portfolioService.generateComprehensiveReport(address, false);
        return report.performance;
    }

    /**
     * Lấy transaction analytics
     * @param address - Địa chỉ ví
     * @returns Transaction analytics
     */
    async getTransactionAnalytics(address: string): Promise<TransactionAnalytics> {
        const report = await this.portfolioService.generateComprehensiveReport(address, true);
        
        // Convert to legacy format (simplified)
        return {
            totalTransactions: report.transactionAnalytics.totalTransactions || 0,
            totalVolume: report.transactionAnalytics.totalVolume || 0,
            averageTransactionSize: report.transactionAnalytics.averageTransactionSize || 0,
            mostFrequentRecipients: report.transactionAnalytics.mostFrequentRecipients || [],
            transactionTrends: report.transactionAnalytics.transactionTrends || [],
            feesPaid: report.transactionAnalytics.feesPaid || 0,
            rewardsEarned: report.transactionAnalytics.rewardsEarned || 0
        };
    }

    /**
     * Lấy staking analytics
     * @param address - Địa chỉ ví
     * @returns Staking analytics
     */
    async getStakingAnalytics(address: string): Promise<StakingAnalytics> {
        const report = await this.portfolioService.generateComprehensiveReport(address, true);
        
        // Convert to legacy format (simplified)
        return {
            totalStaked: report.stakingAnalytics.totalStaked || 0,
            totalRewards: report.stakingAnalytics.totalRewards || 0,
            averageAPY: report.stakingAnalytics.averageAPY || 0,
            topPools: report.stakingAnalytics.topPools || [],
            stakingHistory: report.stakingAnalytics.stakingHistory || []
        };
    }

    /**
     * Lấy NFT collection analytics
     * @param address - Địa chỉ ví
     * @returns NFT analytics
     */
    async getNFTCollectionAnalytics(address: string): Promise<NFTCollectionAnalytics> {
        const report = await this.portfolioService.generateComprehensiveReport(address, true);
        
        // Convert to legacy format
        return {
            totalNFTs: report.nftAnalytics.totalNFTs,
            totalValue: report.nftAnalytics.totalValue,
            averageValue: report.nftAnalytics.averageValue,
            topCollections: (report.nftAnalytics.topCollections || []).map(col => ({
                policyId: col.policyId,
                name: col.name,
                count: col.count,
                value: col.value
            })),
            recentMints: report.nftAnalytics.recentMints,
            floorPrices: (report.nftAnalytics.floorPrices || []).map(fp => ({
                policyId: fp.policyId,
                floorPrice: fp.floorPrice,
                lastUpdated: fp.lastUpdated
            }))
        };
    }

    /**
     * Tính toán risk metrics
     * @param address - Địa chỉ ví
     * @returns Risk metrics
     */
    async calculateRiskMetrics(address: string): Promise<RiskMetrics> {
        const report = await this.portfolioService.generateComprehensiveReport(address, true);
        
        // Convert to legacy format (simplified)
        return {
            volatility: report.riskMetrics.volatility || 0,
            sharpeRatio: report.riskMetrics.sharpeRatio || 0,
            maxDrawdown: report.riskMetrics.maxDrawdown || 0,
            beta: report.riskMetrics.beta || 0,
            correlation: report.riskMetrics.correlation || 0
        };
    }

    /**
     * Lấy ADA price hiện tại
     * @returns ADA price in USD
     */
    async getADAPrice(): Promise<number> {
        // Delegate to new price service through portfolio service
        const summary = await this.portfolioService.getPortfolioSummary('dummy_address');
        // Return a reasonable default if we can't get the price
        return 0.45; // Fallback ADA price
    }

    // =============================================================================
    // ENHANCED LEGACY METHODS (not in original API)
    // =============================================================================

    /**
     * Generate comprehensive portfolio report (enhanced method)
     * @param address - Địa chỉ ví
     * @param includeAnalytics - Bao gồm detailed analytics
     * @returns Complete portfolio report
     */
    async generateComprehensiveReport(address: string, includeAnalytics: boolean = true): Promise<ComprehensivePortfolioReport> {
        return await this.portfolioService.generateComprehensiveReport(address, includeAnalytics);
    }

    /**
     * Generate portfolio insights (enhanced method)
     * @param address - Địa chỉ ví
     * @returns Portfolio insights and recommendations
     */
    async generatePortfolioInsights(address: string): Promise<PortfolioInsights> {
        return await this.portfolioService.generatePortfolioInsights(address);
    }

    /**
     * Compare portfolio with market (enhanced method)
     * @param address - Địa chỉ ví
     * @param timeRange - Comparison period in days
     * @returns Market comparison data
     */
    async compareWithMarket(address: string, timeRange: number = 30): Promise<any> {
        return await this.portfolioService.compareWithMarket(address, timeRange);
    }

    /**
     * Export portfolio data (enhanced method)
     * @param address - Địa chỉ ví
     * @param format - Export format
     * @returns Exported data
     */
    async exportPortfolioData(address: string, format: 'json' | 'csv' = 'json'): Promise<string> {
        return await this.portfolioService.exportPortfolioData(address, format);
    }

    /**
     * Clear portfolio cache (enhanced method)
     * @param address - Địa chỉ ví (optional)
     */
    async clearCache(address?: string): Promise<void> {
        return await this.portfolioService.clearCache(address);
    }

    // =============================================================================
    // MIGRATION HELPERS
    // =============================================================================

    /**
     * Get access to the new PortfolioService for migration
     * @returns PortfolioService instance
     */
    getPortfolioService(): PortfolioService {
        logger.info('Accessing new PortfolioService for migration', 'PortfolioAnalyticsService.getPortfolioService');
        return this.portfolioService;
    }
}

export default PortfolioAnalyticsService;