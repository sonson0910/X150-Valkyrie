import logger from '../../utils/Logger';
import AssetPriceService from './AssetPriceService';
import PortfolioCalculationService, { PortfolioSummary, PortfolioAsset, PortfolioPerformance, AssetAllocation } from './PortfolioCalculationService';
import AnalyticsEngineService, { TransactionAnalytics, StakingAnalytics, NFTCollectionAnalytics, DeFiAnalytics, RiskMetrics } from './AnalyticsEngineService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ComprehensivePortfolioReport {
    summary: PortfolioSummary;
    assets: PortfolioAsset[];
    performance: PortfolioPerformance[];
    allocation: AssetAllocation[];
    transactionAnalytics: TransactionAnalytics;
    stakingAnalytics: StakingAnalytics;
    nftAnalytics: NFTCollectionAnalytics;
    defiAnalytics: DeFiAnalytics;
    riskMetrics: RiskMetrics;
    generatedAt: Date;
}

export interface PortfolioInsights {
    topPerformingAssets: Array<{ symbol: string; change: number; value: number }>;
    underperformingAssets: Array<{ symbol: string; change: number; value: number }>;
    riskAlerts: Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }>;
    opportunities: Array<{ type: string; description: string; potentialGain: number }>;
    recommendations: Array<{ category: string; action: string; reasoning: string; priority: number }>;
}

export interface PortfolioComparisonData {
    portfolioValue: number;
    marketAverage: number;
    outperformance: number;
    volatilityComparison: number;
    riskAdjustedReturns: number;
}

/**
 * PortfolioService - Main orchestrator for comprehensive portfolio management and analytics
 * 
 * This service coordinates all portfolio-related modules:
 * - AssetPriceService: Real-time and historical price data
 * - PortfolioCalculationService: Portfolio value calculations and allocations
 * - AnalyticsEngineService: Advanced analytics and insights
 * 
 * Responsibilities:
 * - Generate comprehensive portfolio reports
 * - Provide portfolio insights and recommendations
 * - Cache and manage portfolio data
 * - Coordinate real-time updates
 * - Export portfolio data
 * - Performance benchmarking
 */
export class PortfolioService {
    private static instance: PortfolioService;
    private priceService: AssetPriceService;
    private calculationService: PortfolioCalculationService;
    private analyticsService: AnalyticsEngineService;
    private lastReportCache: Map<string, ComprehensivePortfolioReport> = new Map();
    private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

    private constructor() {
        this.priceService = AssetPriceService.getInstance();
        this.calculationService = PortfolioCalculationService.getInstance();
        this.analyticsService = AnalyticsEngineService.getInstance();
    }

    public static getInstance(): PortfolioService {
        if (!PortfolioService.instance) {
            PortfolioService.instance = new PortfolioService();
        }
        return PortfolioService.instance;
    }

    /**
     * Generate comprehensive portfolio report
     * @param address - Wallet address
     * @param includeAnalytics - Whether to include detailed analytics
     * @returns Complete portfolio report
     */
    async generateComprehensiveReport(address: string, includeAnalytics: boolean = true): Promise<ComprehensivePortfolioReport> {
        try {
            logger.info('Generating comprehensive portfolio report', 'PortfolioService.generateComprehensiveReport', {
                address,
                includeAnalytics
            });

            // Check cache first
            const cached = this.lastReportCache.get(address);
            if (cached && this.isCacheValid(cached.generatedAt)) {
                logger.debug('Returning cached portfolio report', 'PortfolioService.generateComprehensiveReport', { address });
                return cached;
            }

            // Generate all components in parallel for performance
            const [
                summary,
                assets,
                performance,
                allocation,
                transactionAnalytics,
                stakingAnalytics,
                nftAnalytics,
                defiAnalytics,
                riskMetrics
            ] = await Promise.all([
                this.calculationService.calculatePortfolioSummary(address),
                this.calculationService.getPortfolioAssets(address),
                this.calculationService.calculatePortfolioPerformance(address, 30),
                this.calculationService.getAssetAllocation(address),
                includeAnalytics ? this.analyticsService.generateTransactionAnalytics(address) : Promise.resolve({} as TransactionAnalytics),
                includeAnalytics ? this.analyticsService.generateStakingAnalytics(address) : Promise.resolve({} as StakingAnalytics),
                includeAnalytics ? this.analyticsService.generateNFTAnalytics(address) : Promise.resolve({} as NFTCollectionAnalytics),
                includeAnalytics ? this.analyticsService.generateDeFiAnalytics(address) : Promise.resolve({} as DeFiAnalytics),
                includeAnalytics ? this.analyticsService.calculateRiskMetrics(address) : Promise.resolve({} as RiskMetrics)
            ]);

            const report: ComprehensivePortfolioReport = {
                summary,
                assets,
                performance,
                allocation,
                transactionAnalytics,
                stakingAnalytics,
                nftAnalytics,
                defiAnalytics,
                riskMetrics,
                generatedAt: new Date()
            };

            // Cache the report
            this.lastReportCache.set(address, report);
            await this.cacheReportToStorage(address, report);

            logger.info('Comprehensive portfolio report generated', 'PortfolioService.generateComprehensiveReport', {
                address,
                totalValue: summary.totalValue,
                assetCount: assets.length,
                includeAnalytics
            });

            return report;

        } catch (error) {
            logger.error('Failed to generate comprehensive portfolio report', 'PortfolioService.generateComprehensiveReport', {
                address,
                includeAnalytics,
                error
            });
            throw new Error(`Portfolio report generation failed: ${error}`);
        }
    }

    /**
     * Generate portfolio insights and recommendations
     * @param address - Wallet address
     * @returns Portfolio insights
     */
    async generatePortfolioInsights(address: string): Promise<PortfolioInsights> {
        try {
            logger.debug('Generating portfolio insights', 'PortfolioService.generatePortfolioInsights', { address });

            const report = await this.generateComprehensiveReport(address, true);

            // Analyze top and underperforming assets
            const topPerformingAssets = this.identifyTopPerformingAssets(report.assets);
            const underperformingAssets = this.identifyUnderperformingAssets(report.assets);

            // Generate risk alerts
            const riskAlerts = this.generateRiskAlerts(report.riskMetrics, report.allocation);

            // Identify opportunities
            const opportunities = this.identifyOpportunities(report);

            // Generate recommendations
            const recommendations = this.generateRecommendations(report);

            const insights: PortfolioInsights = {
                topPerformingAssets,
                underperformingAssets,
                riskAlerts,
                opportunities,
                recommendations
            };

            logger.info('Portfolio insights generated', 'PortfolioService.generatePortfolioInsights', {
                address,
                riskAlertCount: riskAlerts.length,
                opportunityCount: opportunities.length,
                recommendationCount: recommendations.length
            });

            return insights;

        } catch (error) {
            logger.error('Failed to generate portfolio insights', 'PortfolioService.generatePortfolioInsights', {
                address,
                error
            });
            throw new Error(`Portfolio insights generation failed: ${error}`);
        }
    }

    /**
     * Get portfolio summary (quick access)
     * @param address - Wallet address
     * @returns Portfolio summary
     */
    async getPortfolioSummary(address: string): Promise<PortfolioSummary> {
        try {
            // Try cache first
            const cached = this.lastReportCache.get(address);
            if (cached && this.isCacheValid(cached.generatedAt)) {
                return cached.summary;
            }

            // Generate fresh summary
            return await this.calculationService.calculatePortfolioSummary(address);

        } catch (error) {
            logger.error('Failed to get portfolio summary', 'PortfolioService.getPortfolioSummary', {
                address,
                error
            });
            throw new Error(`Portfolio summary retrieval failed: ${error}`);
        }
    }

    /**
     * Get portfolio assets (quick access)
     * @param address - Wallet address
     * @returns Portfolio assets
     */
    async getPortfolioAssets(address: string): Promise<PortfolioAsset[]> {
        try {
            // Try cache first
            const cached = this.lastReportCache.get(address);
            if (cached && this.isCacheValid(cached.generatedAt)) {
                return cached.assets;
            }

            // Generate fresh assets
            return await this.calculationService.getPortfolioAssets(address);

        } catch (error) {
            logger.error('Failed to get portfolio assets', 'PortfolioService.getPortfolioAssets', {
                address,
                error
            });
            throw new Error(`Portfolio assets retrieval failed: ${error}`);
        }
    }

    /**
     * Compare portfolio with market benchmarks
     * @param address - Wallet address
     * @param timeRange - Comparison period in days
     * @returns Comparison data
     */
    async compareWithMarket(address: string, timeRange: number = 30): Promise<PortfolioComparisonData> {
        try {
            logger.debug('Comparing portfolio with market', 'PortfolioService.compareWithMarket', {
                address,
                timeRange
            });

            const [portfolioPerformance, marketData] = await Promise.all([
                this.calculationService.calculatePortfolioPerformance(address, timeRange),
                this.getMarketBenchmarkData(timeRange)
            ]);

            const currentValue = portfolioPerformance[portfolioPerformance.length - 1]?.value || 0;
            const initialValue = portfolioPerformance[0]?.value || 0;
            const portfolioReturn = initialValue > 0 ? ((currentValue - initialValue) / initialValue) * 100 : 0;

            const marketReturn = marketData.return;
            const outperformance = portfolioReturn - marketReturn;

            // Calculate volatility
            const returns = portfolioPerformance.map(p => p.changePercent);
            const portfolioVolatility = this.calculateVolatility(returns);
            const volatilityComparison = portfolioVolatility - marketData.volatility;

            // Risk-adjusted returns (Sharpe ratio comparison)
            const riskFreeRate = 2; // 2% annual
            const portfolioSharpe = portfolioVolatility > 0 ? (portfolioReturn - riskFreeRate) / portfolioVolatility : 0;
            const marketSharpe = marketData.volatility > 0 ? (marketReturn - riskFreeRate) / marketData.volatility : 0;
            const riskAdjustedReturns = portfolioSharpe - marketSharpe;

            const comparison: PortfolioComparisonData = {
                portfolioValue: currentValue,
                marketAverage: marketReturn,
                outperformance,
                volatilityComparison,
                riskAdjustedReturns
            };

            logger.info('Portfolio market comparison completed', 'PortfolioService.compareWithMarket', {
                address,
                outperformance,
                volatilityComparison
            });

            return comparison;

        } catch (error) {
            logger.error('Failed to compare portfolio with market', 'PortfolioService.compareWithMarket', {
                address,
                timeRange,
                error
            });
            throw new Error(`Portfolio market comparison failed: ${error}`);
        }
    }

    /**
     * Export portfolio data
     * @param address - Wallet address
     * @param format - Export format
     * @returns Exported data
     */
    async exportPortfolioData(address: string, format: 'json' | 'csv' = 'json'): Promise<string> {
        try {
            logger.debug('Exporting portfolio data', 'PortfolioService.exportPortfolioData', {
                address,
                format
            });

            const report = await this.generateComprehensiveReport(address, true);

            if (format === 'json') {
                return JSON.stringify(report, null, 2);
            } else if (format === 'csv') {
                return this.convertToCSV(report);
            }

            throw new Error(`Unsupported export format: ${format}`);

        } catch (error) {
            logger.error('Failed to export portfolio data', 'PortfolioService.exportPortfolioData', {
                address,
                format,
                error
            });
            throw new Error(`Portfolio data export failed: ${error}`);
        }
    }

    /**
     * Schedule regular portfolio updates
     * @param address - Wallet address
     * @param intervalMinutes - Update interval in minutes
     */
    schedulePortfolioUpdates(address: string, intervalMinutes: number = 30): void {
        try {
            logger.info('Scheduling portfolio updates', 'PortfolioService.schedulePortfolioUpdates', {
                address,
                intervalMinutes
            });

            setInterval(async () => {
                try {
                    await this.generateComprehensiveReport(address, false);
                    logger.debug('Scheduled portfolio update completed', 'PortfolioService.schedulePortfolioUpdates', { address });
                } catch (error) {
                    logger.warn('Scheduled portfolio update failed', 'PortfolioService.schedulePortfolioUpdates', {
                        address,
                        error
                    });
                }
            }, intervalMinutes * 60 * 1000);

        } catch (error) {
            logger.error('Failed to schedule portfolio updates', 'PortfolioService.schedulePortfolioUpdates', {
                address,
                intervalMinutes,
                error
            });
        }
    }

    /**
     * Clear portfolio cache
     * @param address - Wallet address (optional, clears all if not provided)
     */
    async clearCache(address?: string): Promise<void> {
        try {
            if (address) {
                this.lastReportCache.delete(address);
                await AsyncStorage.removeItem(`portfolio_report_${address}`);
                logger.debug('Portfolio cache cleared for address', 'PortfolioService.clearCache', { address });
            } else {
                this.lastReportCache.clear();
                const keys = await AsyncStorage.getAllKeys();
                const portfolioKeys = keys.filter(key => key.startsWith('portfolio_report_'));
                await AsyncStorage.multiRemove(portfolioKeys);
                logger.info('All portfolio cache cleared', 'PortfolioService.clearCache');
            }

            // Also clear price cache
            await this.priceService.clearCache();

        } catch (error) {
            logger.error('Failed to clear portfolio cache', 'PortfolioService.clearCache', { address, error });
        }
    }

    // Private helper methods

    /**
     * Check if cached data is still valid
     */
    private isCacheValid(generatedAt: Date): boolean {
        return (Date.now() - generatedAt.getTime()) < this.CACHE_DURATION;
    }

    /**
     * Identify top performing assets
     */
    private identifyTopPerformingAssets(assets: PortfolioAsset[]): Array<{ symbol: string; change: number; value: number }> {
        return assets
            .filter(asset => asset.change24h > 0)
            .sort((a, b) => b.change24h - a.change24h)
            .slice(0, 5)
            .map(asset => ({
                symbol: asset.symbol,
                change: asset.change24h,
                value: asset.value
            }));
    }

    /**
     * Identify underperforming assets
     */
    private identifyUnderperformingAssets(assets: PortfolioAsset[]): Array<{ symbol: string; change: number; value: number }> {
        return assets
            .filter(asset => asset.change24h < 0)
            .sort((a, b) => a.change24h - b.change24h)
            .slice(0, 5)
            .map(asset => ({
                symbol: asset.symbol,
                change: asset.change24h,
                value: asset.value
            }));
    }

    /**
     * Generate risk alerts
     */
    private generateRiskAlerts(riskMetrics: RiskMetrics, allocation: AssetAllocation[]): Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }> {
        const alerts: Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }> = [];

        // Volatility alerts
        if (riskMetrics.volatility > 50) {
            alerts.push({
                type: 'high_volatility',
                severity: 'high',
                message: `Portfolio volatility is ${riskMetrics.volatility.toFixed(1)}%, which is significantly above average.`
            });
        } else if (riskMetrics.volatility > 30) {
            alerts.push({
                type: 'medium_volatility',
                severity: 'medium',
                message: `Portfolio volatility is ${riskMetrics.volatility.toFixed(1)}%, consider diversification.`
            });
        }

        // Concentration risk
        if (riskMetrics.concentrationRisk > 80) {
            alerts.push({
                type: 'concentration_risk',
                severity: 'high',
                message: 'Portfolio is highly concentrated in few assets. Consider diversifying.'
            });
        }

        // Liquidity risk
        if (riskMetrics.liquidityRisk > 70) {
            alerts.push({
                type: 'liquidity_risk',
                severity: 'medium',
                message: 'Some assets may be difficult to liquidate quickly if needed.'
            });
        }

        // Allocation imbalance
        const largestAllocation = Math.max(...allocation.map(a => a.percentage));
        if (largestAllocation > 70) {
            alerts.push({
                type: 'allocation_imbalance',
                severity: 'medium',
                message: `${largestAllocation.toFixed(1)}% of portfolio is in one asset type. Consider rebalancing.`
            });
        }

        return alerts;
    }

    /**
     * Identify opportunities
     */
    private identifyOpportunities(report: ComprehensivePortfolioReport): Array<{ type: string; description: string; potentialGain: number }> {
        const opportunities: Array<{ type: string; description: string; potentialGain: number }> = [];

        // Staking opportunities
        const adaAllocation = report.allocation.find(a => a.type.includes('ADA'));
        if (adaAllocation && adaAllocation.percentage > 20 && report.stakingAnalytics.totalStaked < adaAllocation.value * 0.8) {
            opportunities.push({
                type: 'staking',
                description: 'Increase ADA staking to earn rewards',
                potentialGain: (adaAllocation.value * 0.8 - report.stakingAnalytics.totalStaked) * 0.055 // 5.5% APY
            });
        }

        // DeFi opportunities
        if (report.defiAnalytics.totalLiquidityProvided < report.summary.totalValue * 0.1) {
            opportunities.push({
                type: 'defi',
                description: 'Consider liquidity providing for additional yield',
                potentialGain: report.summary.totalValue * 0.05 * 0.15 // 15% APY on 5% of portfolio
            });
        }

        // Rebalancing opportunities
        const allocation = report.allocation;
        const imbalanced = allocation.find(a => a.percentage > 60);
        if (imbalanced) {
            opportunities.push({
                type: 'rebalancing',
                description: `Reduce ${imbalanced.type} exposure for better diversification`,
                potentialGain: 0 // Risk reduction, not direct gain
            });
        }

        return opportunities;
    }

    /**
     * Generate recommendations
     */
    private generateRecommendations(report: ComprehensivePortfolioReport): Array<{ category: string; action: string; reasoning: string; priority: number }> {
        const recommendations: Array<{ category: string; action: string; reasoning: string; priority: number }> = [];

        // Risk management recommendations
        if (report.riskMetrics.volatility > 40) {
            recommendations.push({
                category: 'risk_management',
                action: 'Diversify portfolio across more asset types',
                reasoning: 'High volatility indicates concentrated risk',
                priority: 8
            });
        }

        // Yield optimization
        if (report.stakingAnalytics.averageAPY < 5.0) {
            recommendations.push({
                category: 'yield_optimization',
                action: 'Research higher-performing stake pools',
                reasoning: 'Current staking APY is below average',
                priority: 6
            });
        }

        // Transaction efficiency
        if (report.transactionAnalytics.averageTransactionSize < 100) {
            recommendations.push({
                category: 'cost_optimization',
                action: 'Consider batching smaller transactions',
                reasoning: 'Small transactions have higher relative fees',
                priority: 4
            });
        }

        // Portfolio growth
        if (report.summary.totalChange30d < 0) {
            recommendations.push({
                category: 'portfolio_growth',
                action: 'Review asset allocation and consider rebalancing',
                reasoning: 'Portfolio has declined over the past month',
                priority: 7
            });
        }

        // Security
        recommendations.push({
            category: 'security',
            action: 'Regular security review and backup verification',
            reasoning: 'Maintaining security is always important',
            priority: 9
        });

        return recommendations.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get market benchmark data
     */
    private async getMarketBenchmarkData(timeRange: number): Promise<{ return: number; volatility: number }> {
        // Simplified benchmark using ADA performance
        try {
            const adaHistorical = await this.priceService.getHistoricalPrices('ADA', timeRange);
            
            if (adaHistorical.length < 2) {
                return { return: 5, volatility: 25 }; // Default values
            }

            const initialPrice = adaHistorical[0].price;
            const finalPrice = adaHistorical[adaHistorical.length - 1].price;
            const marketReturn = ((finalPrice - initialPrice) / initialPrice) * 100;

            // Calculate volatility
            const returns = [];
            for (let i = 1; i < adaHistorical.length; i++) {
                const dailyReturn = ((adaHistorical[i].price - adaHistorical[i - 1].price) / adaHistorical[i - 1].price) * 100;
                returns.push(dailyReturn);
            }

            const marketVolatility = this.calculateVolatility(returns);

            return { return: marketReturn, volatility: marketVolatility };

        } catch (error) {
            logger.warn('Failed to get market benchmark data, using defaults', 'PortfolioService.getMarketBenchmarkData', error);
            return { return: 5, volatility: 25 }; // Default values
        }
    }

    /**
     * Calculate volatility from returns array
     */
    private calculateVolatility(returns: number[]): number {
        if (returns.length === 0) return 0;

        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    /**
     * Convert portfolio report to CSV format
     */
    private convertToCSV(report: ComprehensivePortfolioReport): string {
        const headers = ['Asset', 'Symbol', 'Type', 'Quantity', 'Price', 'Value', 'Change 24h', 'Allocation'];
        const rows = report.assets.map(asset => [
            asset.name,
            asset.symbol,
            asset.type,
            asset.quantity,
            asset.price.toString(),
            asset.value.toString(),
            `${asset.change24h.toFixed(2)}%`,
            `${asset.allocation.toFixed(2)}%`
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        return csvContent;
    }

    /**
     * Cache report to storage
     */
    private async cacheReportToStorage(address: string, report: ComprehensivePortfolioReport): Promise<void> {
        try {
            // Store only essential data to avoid storage bloat
            const essentialReport = {
                summary: report.summary,
                assets: report.assets,
                generatedAt: report.generatedAt
            };

            await AsyncStorage.setItem(
                `portfolio_report_${address}`,
                JSON.stringify(essentialReport)
            );

        } catch (error) {
            logger.warn('Failed to cache portfolio report to storage', 'PortfolioService.cacheReportToStorage', {
                address,
                error
            });
        }
    }
}

export default PortfolioService;

