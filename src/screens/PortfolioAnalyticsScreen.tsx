import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppText } from '../components/ui/AppText';
import { AppButton } from '../components/ui/AppButton';
import { tokens } from '../theme/tokens';
import { 
  PortfolioAnalyticsService, 
  PortfolioSummary, 
  PortfolioAsset, 
  PortfolioPerformance,
  TransactionAnalytics,
  StakingAnalytics,
  NFTCollectionAnalytics,
  RiskMetrics
} from '../services/PortfolioAnalyticsService';
import { CyberpunkCard, CyberpunkButton, LoadingSpinner } from '../components/index';

type PortfolioAnalyticsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PortfolioAnalytics'>;

interface Props {
  navigation: PortfolioAnalyticsScreenNavigationProp;
}

const { width: screenWidth } = Dimensions.get('window');

const PortfolioAnalyticsScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'performance' | 'analytics' | 'risk'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  
  // Portfolio data
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [portfolioPerformance, setPortfolioPerformance] = useState<PortfolioPerformance[]>([]);
  const [transactionAnalytics, setTransactionAnalytics] = useState<TransactionAnalytics | null>(null);
  const [stakingAnalytics, setStakingAnalytics] = useState<StakingAnalytics | null>(null);
  const [nftAnalytics, setNftAnalytics] = useState<NFTCollectionAnalytics | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);

  const portfolioService = PortfolioAnalyticsService.getInstance();

  useEffect(() => {
    loadPortfolioData();
  }, []);

  const loadPortfolioData = async () => {
    try {
      setIsLoading(true);
      const address = 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer';
      
      const [
        summary,
        assets,
        performance,
        txAnalytics,
        stakingData,
        nftData,
        riskData
      ] = await Promise.all([
        portfolioService.getPortfolioSummary(address),
        portfolioService.getPortfolioAssets(address),
        portfolioService.getPortfolioPerformance(address, 30),
        portfolioService.getTransactionAnalytics(address),
        portfolioService.getStakingAnalytics(address),
        portfolioService.getNFTCollectionAnalytics(address),
        portfolioService.getRiskMetrics(address)
      ]);

      setPortfolioSummary(summary);
      setPortfolioAssets(assets);
      setPortfolioPerformance(performance);
      setTransactionAnalytics(txAnalytics);
      setStakingAnalytics(stakingData);
      setNftAnalytics(nftData);
      setRiskMetrics(riskData);
    } catch (error) {
      console.error('Failed to load portfolio data:', error);
      Alert.alert('Error', 'Failed to load portfolio data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  const formatPercentage = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getChangeColor = (value: number): string => {
    return value >= 0 ? CYBERPUNK_COLORS.success : CYBERPUNK_COLORS.error;
  };

  const renderPortfolioOverview = () => (
    <View>
      {portfolioSummary && (
        <>
          {/* Total Value Card */}
          <Card style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>Portfolio Value</Text>
            <Text style={styles.totalValue}>{formatCurrency(portfolioSummary.totalValue)}</Text>
            
            <View style={styles.changeRow}>
              <Text style={[styles.changeText, { color: getChangeColor(portfolioSummary.totalChange24h) }]}>
                24h: {formatPercentage(portfolioSummary.totalChange24h)}
              </Text>
              <Text style={[styles.changeText, { color: getChangeColor(portfolioSummary.totalChange7d) }]}>
                7d: {formatPercentage(portfolioSummary.totalChange7d)}
              </Text>
              <Text style={[styles.changeText, { color: getChangeColor(portfolioSummary.totalChange30d) }]}>
                30d: {formatPercentage(portfolioSummary.totalChange30d)}
              </Text>
            </View>
          </Card>

          {/* Asset Breakdown */}
          <View style={styles.breakdownContainer}>
            <Text style={styles.sectionTitle}>Asset Breakdown</Text>
            
            <View style={styles.breakdownGrid}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>ADA</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(portfolioSummary.adaValue)}</Text>
                <View style={[styles.breakdownBar, { width: `${(portfolioSummary.adaValue / portfolioSummary.totalValue) * 100}%` }]} />
              </View>
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>NFTs</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(portfolioSummary.nftValue)}</Text>
                <View style={[styles.breakdownBar, { width: `${(portfolioSummary.nftValue / portfolioSummary.totalValue) * 100}%` }]} />
              </View>
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Tokens</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(portfolioSummary.tokenValue)}</Text>
                <View style={[styles.breakdownBar, { width: `${(portfolioSummary.tokenValue / portfolioSummary.totalValue) * 100}%` }]} />
              </View>
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Staking</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(portfolioSummary.stakingValue)}</Text>
                <View style={[styles.breakdownBar, { width: `${(portfolioSummary.stakingValue / portfolioSummary.totalValue) * 100}%` }]} />
              </View>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStatsContainer}>
            <Text style={styles.sectionTitle}>Quick Stats</Text>
            
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{formatCurrency(portfolioSummary.rewardsValue)}</Text>
                <Text style={styles.statLabel}>Total Rewards</Text>
              </Card>
              
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{portfolioAssets.length}</Text>
                <Text style={styles.statLabel}>Total Assets</Text>
              </Card>
              
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{formatCurrency(portfolioSummary.lpValue)}</Text>
                <Text style={styles.statLabel}>Liquidity</Text>
              </Card>
            </View>
          </View>
        </>
      )}
    </View>
  );

  const renderAssetsList = () => (
    <View>
      <Text style={styles.sectionTitle}>Portfolio Assets</Text>
      
      {portfolioAssets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No assets found</Text>
        </View>
      ) : (
        <FlatList
          data={portfolioAssets}
          renderItem={({ item: asset }) => (
            <CyberpunkCard key={asset.id} style={styles.assetCard}>
              <View style={styles.assetHeader}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                </View>
                <View style={styles.assetValue}>
                  <Text style={styles.assetValueText}>{formatCurrency(asset.value)}</Text>
                  <Text style={styles.assetAllocation}>{asset.allocation.toFixed(1)}%</Text>
                </View>
              </View>
              
              <View style={styles.assetDetails}>
                <Text style={styles.assetQuantity}>Quantity: {asset.quantity}</Text>
                <Text style={styles.assetPrice}>Price: ${asset.price.toFixed(4)}</Text>
              </View>
              
              <View style={styles.assetChanges}>
                <Text style={[styles.changeText, { color: getChangeColor(asset.change24h) }]}>
                  24h: {formatPercentage(asset.change24h)}
                </Text>
                <Text style={[styles.changeText, { color: getChangeColor(asset.change7d) }]}>
                  7d: {formatPercentage(asset.change7d)}
                </Text>
                <Text style={[styles.changeText, { color: getChangeColor(asset.change30d) }]}>
                  30d: {formatPercentage(asset.change30d)}
                </Text>
              </View>
            </CyberpunkCard>
          )}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderPerformanceChart = () => (
    <View>
      <Text style={styles.sectionTitle}>Performance (30 Days)</Text>
      
      {portfolioPerformance.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No performance data available</Text>
        </View>
      ) : (
        <CyberpunkCard style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Portfolio Value Trend</Text>
            <Text style={styles.chartSubtitle}>
              {new Date(portfolioPerformance[0]?.date).toLocaleDateString()} - {new Date(portfolioPerformance[portfolioPerformance.length - 1]?.date).toLocaleDateString()}
            </Text>
          </View>
          
          {/* Simple bar chart representation */}
          <View style={styles.chartContainer}>
            {portfolioPerformance.slice(-7).map((point, index) => (
              <View key={index} style={styles.chartBar}>
                <View 
                  style={[
                    styles.bar, 
                    { 
                      height: Math.max(20, (point.value / Math.max(...portfolioPerformance.map(p => p.value))) * 100),
                      backgroundColor: point.changePercent >= 0 ? CYBERPUNK_COLORS.success : CYBERPUNK_COLORS.error
                    }
                  ]} 
                />
                <Text style={styles.barLabel}>
                  {new Date(point.date).getDate()}
                </Text>
              </View>
            ))}
          </View>
          
          <View style={styles.chartStats}>
            <View style={styles.chartStat}>
              <Text style={styles.chartStatLabel}>Start Value</Text>
              <Text style={styles.chartStatValue}>
                {formatCurrency(portfolioPerformance[0]?.value || 0)}
              </Text>
            </View>
            <View style={styles.chartStat}>
              <Text style={styles.chartStatLabel}>End Value</Text>
              <Text style={styles.chartStatValue}>
                {formatCurrency(portfolioPerformance[portfolioPerformance.length - 1]?.value || 0)}
              </Text>
            </View>
            <View style={styles.chartStat}>
              <Text style={styles.chartStatLabel}>Total Return</Text>
              <Text style={[
                styles.chartStatValue,
                { color: getChangeColor(portfolioPerformance[portfolioPerformance.length - 1]?.changePercent || 0) }
              ]}>
                {formatPercentage(portfolioPerformance[portfolioPerformance.length - 1]?.changePercent || 0)}
              </Text>
            </View>
          </View>
        </CyberpunkCard>
      )}
    </View>
  );

  const renderAnalytics = () => (
    <View>
      <Text style={styles.sectionTitle}>Transaction Analytics</Text>
      
      {transactionAnalytics && (
        <CyberpunkCard style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <Text style={styles.analyticsTitle}>Transaction Overview</Text>
          </View>
          
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{transactionAnalytics.totalTransactions}</Text>
              <Text style={styles.analyticsLabel}>Total TXs</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{formatCurrency(transactionAnalytics.totalVolume)}</Text>
              <Text style={styles.analyticsLabel}>Total Volume</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{formatCurrency(transactionAnalytics.averageTransactionSize)}</Text>
              <Text style={styles.analyticsLabel}>Avg TX Size</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{formatCurrency(transactionAnalytics.feesPaid)}</Text>
              <Text style={styles.analyticsLabel}>Fees Paid</Text>
            </View>
          </View>
        </CyberpunkCard>
      )}

      {stakingAnalytics && (
        <CyberpunkCard style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <Text style={styles.analyticsTitle}>Staking Analytics</Text>
          </View>
          
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{formatCurrency(stakingAnalytics.totalStaked)}</Text>
              <Text style={styles.analyticsLabel}>Total Staked</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{formatCurrency(stakingAnalytics.totalRewards)}</Text>
              <Text style={styles.analyticsLabel}>Total Rewards</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{stakingAnalytics.averageAPY.toFixed(2)}%</Text>
              <Text style={styles.analyticsLabel}>Avg APY</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{stakingAnalytics.topPools.length}</Text>
              <Text style={styles.analyticsLabel}>Active Pools</Text>
            </View>
          </View>
        </CyberpunkCard>
      )}

      {nftAnalytics && (
        <CyberpunkCard style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <Text style={styles.analyticsTitle}>NFT Collection Analytics</Text>
          </View>
          
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{nftAnalytics.totalNFTs}</Text>
              <Text style={styles.analyticsLabel}>Total NFTs</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{formatCurrency(nftAnalytics.totalValue)}</Text>
              <Text style={styles.analyticsLabel}>Total Value</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{formatCurrency(nftAnalytics.averageValue)}</Text>
              <Text style={styles.analyticsLabel}>Avg Value</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{nftAnalytics.topCollections.length}</Text>
              <Text style={styles.analyticsLabel}>Collections</Text>
            </View>
          </View>
        </CyberpunkCard>
      )}
    </View>
  );

  const renderRiskMetrics = () => (
    <View>
      <Text style={styles.sectionTitle}>Risk Analysis</Text>
      
      {riskMetrics && (
        <CyberpunkCard style={styles.riskCard}>
          <View style={styles.riskHeader}>
            <Text style={styles.riskTitle}>Portfolio Risk Metrics</Text>
          </View>
          
          <View style={styles.riskGrid}>
            <View style={styles.riskItem}>
              <Text style={styles.riskValue}>{(riskMetrics.volatility * 100).toFixed(2)}%</Text>
              <Text style={styles.riskLabel}>Volatility</Text>
              <Text style={styles.riskDescription}>Daily price fluctuations</Text>
            </View>
            
            <View style={styles.riskItem}>
              <Text style={styles.riskValue}>{riskMetrics.sharpeRatio.toFixed(2)}</Text>
              <Text style={styles.riskLabel}>Sharpe Ratio</Text>
              <Text style={styles.riskDescription}>Risk-adjusted returns</Text>
            </View>
            
            <View style={styles.riskItem}>
              <Text style={styles.riskValue}>{(riskMetrics.maxDrawdown * 100).toFixed(2)}%</Text>
              <Text style={styles.riskLabel}>Max Drawdown</Text>
              <Text style={styles.riskDescription}>Largest peak-to-trough decline</Text>
            </View>
            
            <View style={styles.riskItem}>
              <Text style={styles.riskValue}>{riskMetrics.beta.toFixed(2)}</Text>
              <Text style={styles.riskLabel}>Beta</Text>
              <Text style={styles.riskDescription}>Market correlation</Text>
            </View>
          </View>
          
          <View style={styles.riskSummary}>
            <Text style={styles.riskSummaryTitle}>Risk Assessment</Text>
            <Text style={styles.riskSummaryText}>
              {riskMetrics.volatility < 0.1 ? 'Low Risk' : 
               riskMetrics.volatility < 0.2 ? 'Moderate Risk' : 'High Risk'} Portfolio
            </Text>
          </View>
        </CyberpunkCard>
      )}
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderPortfolioOverview();
      case 'assets':
        return renderAssetsList();
      case 'performance':
        return renderPerformanceChart();
      case 'analytics':
        return renderAnalytics();
      case 'risk':
        return renderRiskMetrics();
      default:
        return null;
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading portfolio data..." />;
  }

  return (
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <AppText variant="h1" color={tokens.palette.primary} style={styles.title}>Portfolio Analytics</AppText>
          <AppText variant="body" color={tokens.palette.textSecondary} style={styles.subtitle}>Comprehensive insights into your Cardano portfolio</AppText>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              📊 Overview
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'assets' && styles.activeTab]}
            onPress={() => setActiveTab('assets')}
          >
            <Text style={[styles.tabText, activeTab === 'assets' && styles.activeTabText]}>
              💰 Assets
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'performance' && styles.activeTab]}
            onPress={() => setActiveTab('performance')}
          >
            <Text style={[styles.tabText, activeTab === 'performance' && styles.activeTabText]}>
              📈 Performance
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
            onPress={() => setActiveTab('analytics')}
          >
            <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>
              🔍 Analytics
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'risk' && styles.activeTab]}
            onPress={() => setActiveTab('risk')}
          >
            <Text style={[styles.tabText, activeTab === 'risk' && styles.activeTabText]}>
              ⚠️ Risk
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 22,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: CYBERPUNK_COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
  },
  activeTabText: {
    color: CYBERPUNK_COLORS.background,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 16,
  },
  overviewCard: {
    marginBottom: 20,
    padding: 24,
    alignItems: 'center',
  },
  overviewTitle: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 16,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownContainer: {
    marginBottom: 24,
  },
  breakdownGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 4,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
  },
  breakdownBar: {
    height: 4,
    backgroundColor: CYBERPUNK_COLORS.primary,
    borderRadius: 2,
    width: '100%',
  },
  quickStatsContainer: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
  },
  assetCard: {
    marginBottom: 12,
    padding: 16,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 2,
  },
  assetSymbol: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
    fontWeight: '600',
  },
  assetValue: {
    alignItems: 'flex-end',
  },
  assetValueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 2,
  },
  assetAllocation: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  assetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  assetQuantity: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  assetPrice: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  assetChanges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartCard: {
    marginBottom: 20,
    padding: 20,
  },
  chartHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 20,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 20,
    borderRadius: 2,
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  chartStat: {
    alignItems: 'center',
  },
  chartStatLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 4,
  },
  chartStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
  },
  analyticsCard: {
    marginBottom: 16,
    padding: 20,
  },
  analyticsHeader: {
    marginBottom: 16,
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  analyticsItem: {
    alignItems: 'center',
    flex: 1,
  },
  analyticsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
  },
  riskCard: {
    marginBottom: 20,
    padding: 20,
  },
  riskHeader: {
    marginBottom: 20,
  },
  riskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
  },
  riskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  riskItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  riskValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 4,
  },
  riskLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  riskDescription: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
  },
  riskSummary: {
    backgroundColor: CYBERPUNK_COLORS.background,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  riskSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
  },
  riskSummaryText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
  },
});

export default PortfolioAnalyticsScreen;
