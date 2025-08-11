import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '@constants/index';
import { 
  DeFiStakingService, 
  StakingPool, 
  LiquidityPool, 
  GovernanceProposal,
  StakingPosition,
  LiquidityPosition
} from '@services/DeFiStakingService';
import { CyberpunkCard, CyberpunkButton, LoadingSpinner } from '@components/index';

type DeFiStakingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'DeFiStaking'>;

interface Props {
  navigation: DeFiStakingScreenNavigationProp;
}

const DeFiStakingScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'staking' | 'liquidity' | 'governance'>('staking');
  const [isLoading, setIsLoading] = useState(true);
  
  // Staking data
  const [stakingPools, setStakingPools] = useState<StakingPool[]>([]);
  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([]);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  
  // Liquidity data
  const [liquidityPools, setLiquidityPools] = useState<LiquidityPool[]>([]);
  const [liquidityPositions, setLiquidityPositions] = useState<LiquidityPosition[]>([]);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);
  const [selectedLiquidityPool, setSelectedLiquidityPool] = useState<LiquidityPool | null>(null);
  
  // Governance data
  const [governanceProposals, setGovernanceProposals] = useState<GovernanceProposal[]>([]);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<GovernanceProposal | null>(null);

  // Form states
  const [stakeAmount, setStakeAmount] = useState('');
  const [liquidityAmountA, setLiquidityAmountA] = useState('');
  const [liquidityAmountB, setLiquidityAmountB] = useState('');
  const [voteChoice, setVoteChoice] = useState<'yes' | 'no' | 'abstain'>('yes');
  const [votingPower, setVotingPower] = useState('1000');

  const defiService = DeFiStakingService.getInstance();

  useEffect(() => {
    loadDeFiData();
  }, []);

  const loadDeFiData = async () => {
    try {
      setIsLoading(true);
      const [pools, positions, liqPools, liqPositions, proposals] = await Promise.all([
        defiService.getStakingPools(20, 0),
        defiService.getStakingPositions('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer'),
        defiService.getLiquidityPools(),
        defiService.getLiquidityPositions('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer'),
        defiService.getGovernanceProposals()
      ]);
      
      setStakingPools(pools);
      setStakingPositions(positions);
      setLiquidityPools(liqPools);
      setLiquidityPositions(liqPositions);
      setGovernanceProposals(proposals);
    } catch (error) {
      console.error('Failed to load DeFi data:', error);
      Alert.alert('Error', 'Failed to load DeFi data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStake = async () => {
    if (!selectedPool || !stakeAmount.trim()) {
      Alert.alert('Error', 'Please enter stake amount');
      return;
    }

    try {
      const result = await defiService.delegateToPool(
        'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer',
        selectedPool.poolId,
        stakeAmount
      );

      if (result.success) {
        Alert.alert('Success', 'Successfully staked to pool');
        setShowStakeModal(false);
        setStakeAmount('');
        loadDeFiData();
      } else {
        Alert.alert('Error', result.error || 'Failed to stake');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to stake: ${error}`);
    }
  };

  const handleAddLiquidity = async () => {
    if (!selectedLiquidityPool || !liquidityAmountA.trim() || !liquidityAmountB.trim()) {
      Alert.alert('Error', 'Please enter both token amounts');
      return;
    }

    try {
      const result = await defiService.addLiquidity(
        selectedLiquidityPool.id,
        liquidityAmountA,
        liquidityAmountB,
        'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer'
      );

      if (result.success) {
        Alert.alert('Success', 'Successfully added liquidity');
        setShowLiquidityModal(false);
        setLiquidityAmountA('');
        setLiquidityAmountB('');
        loadDeFiData();
      } else {
        Alert.alert('Error', result.error || 'Failed to add liquidity');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to add liquidity: ${error}`);
    }
  };

  const handleVote = async () => {
    if (!selectedProposal) {
      Alert.alert('Error', 'No proposal selected');
      return;
    }

    try {
      const result = await defiService.voteOnProposal(
        selectedProposal.id,
        'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer',
        voteChoice,
        votingPower
      );

      if (result.success) {
        Alert.alert('Success', 'Vote submitted successfully');
        setShowVoteModal(false);
        setVoteChoice('yes');
        setVotingPower('1000');
        loadDeFiData();
      } else {
        Alert.alert('Error', result.error || 'Failed to submit vote');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to submit vote: ${error}`);
    }
  };

  const renderStakingPool = ({ item: pool }: { item: StakingPool }) => (
    <CyberpunkCard key={pool.id} style={styles.poolCard}>
      <View style={styles.poolHeader}>
        <View style={styles.poolInfo}>
          <Text style={styles.poolName}>{pool.name}</Text>
          <Text style={styles.poolTicker}>{pool.ticker}</Text>
          <Text style={styles.poolDescription}>{pool.description || 'No description'}</Text>
        </View>
        <View style={styles.poolStats}>
          <Text style={styles.apyValue}>{pool.apy.toFixed(2)}%</Text>
          <Text style={styles.apyLabel}>APY</Text>
        </View>
      </View>

      <View style={styles.poolDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Stake:</Text>
          <Text style={styles.detailValue}>
            {(parseFloat(pool.totalStake) / 1000000).toFixed(0)} ADA
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Delegators:</Text>
          <Text style={styles.detailValue}>{pool.delegators}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Saturation:</Text>
          <Text style={styles.detailValue}>{pool.saturation.toFixed(1)}%</Text>
        </View>
      </View>

      <CyberpunkButton
        title="Stake to Pool"
        onPress={() => {
          setSelectedPool(pool);
          setShowStakeModal(true);
        }}
        style={styles.stakeButton}
      />
    </CyberpunkCard>
  );

  const renderLiquidityPool = ({ item: pool }: { item: LiquidityPool }) => (
    <CyberpunkCard key={pool.id} style={styles.poolCard}>
      <View style={styles.poolHeader}>
        <View style={styles.poolInfo}>
          <Text style={styles.poolName}>{pool.name}</Text>
          <Text style={styles.poolDescription}>
            {pool.tokenA} / {pool.tokenB}
          </Text>
        </View>
        <View style={styles.poolStats}>
          <Text style={styles.apyValue}>{pool.apy.toFixed(2)}%</Text>
          <Text style={styles.apyLabel}>APY</Text>
        </View>
      </View>

      <View style={styles.poolDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Liquidity:</Text>
          <Text style={styles.detailValue}>
            ${(parseFloat(pool.totalLiquidity) / 1000000).toFixed(0)}k
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>24h Volume:</Text>
          <Text style={styles.detailValue}>
            ${(parseFloat(pool.volume24h) / 1000000).toFixed(0)}k
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>24h Fees:</Text>
          <Text style={styles.detailValue}>
            ${(parseFloat(pool.fees24h) / 1000000).toFixed(0)}k
          </Text>
        </View>
      </View>

      <CyberpunkButton
        title="Add Liquidity"
        onPress={() => {
          setSelectedLiquidityPool(pool);
          setShowLiquidityModal(true);
        }}
        style={styles.stakeButton}
      />
    </CyberpunkCard>
  );

  const renderGovernanceProposal = ({ item: proposal }: { item: GovernanceProposal }) => (
    <CyberpunkCard key={proposal.id} style={styles.proposalCard}>
      <View style={styles.proposalHeader}>
        <Text style={styles.proposalTitle}>{proposal.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getProposalStatusColor(proposal.status) }]}>
          <Text style={styles.statusText}>{proposal.status}</Text>
        </View>
      </View>

      <Text style={styles.proposalDescription}>{proposal.description}</Text>

      <View style={styles.proposalStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{proposal.yesVotes}</Text>
          <Text style={styles.statLabel}>Yes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{proposal.noVotes}</Text>
          <Text style={styles.statLabel}>No</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{proposal.abstainVotes}</Text>
          <Text style={styles.statLabel}>Abstain</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{proposal.totalVotes}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.proposalDates}>
        <Text style={styles.dateText}>
          Voting: {new Date(proposal.votingStart).toLocaleDateString()} - {new Date(proposal.votingEnd).toLocaleDateString()}
        </Text>
      </View>

      {proposal.status === 'active' && (
        <CyberpunkButton
          title="Vote Now"
          onPress={() => {
            setSelectedProposal(proposal);
            setShowVoteModal(true);
          }}
          variant="outline"
          style={styles.voteButton}
        />
      )}
    </CyberpunkCard>
  );

  const getProposalStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return CYBERPUNK_COLORS.primary;
      case 'passed': return CYBERPUNK_COLORS.success;
      case 'rejected': return CYBERPUNK_COLORS.error;
      case 'expired': return CYBERPUNK_COLORS.textSecondary;
      default: return CYBERPUNK_COLORS.border;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'staking':
        return (
          <View>
            <Text style={styles.sectionTitle}>Staking Pools</Text>
            {stakingPools.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No staking pools available</Text>
              </View>
            ) : (
              <FlatList
                data={stakingPools}
                renderItem={renderStakingPool}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        );

      case 'liquidity':
        return (
          <View>
            <Text style={styles.sectionTitle}>Liquidity Pools</Text>
            {liquidityPools.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No liquidity pools available</Text>
              </View>
            ) : (
              <FlatList
                data={liquidityPools}
                renderItem={renderLiquidityPool}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        );

      case 'governance':
        return (
          <View>
            <Text style={styles.sectionTitle}>Governance Proposals</Text>
            {governanceProposals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No governance proposals available</Text>
              </View>
            ) : (
              <FlatList
                data={governanceProposals}
                renderItem={renderGovernanceProposal}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading DeFi data..." />;
  }

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>DeFi & Staking</Text>
          <Text style={styles.subtitle}>
            Earn rewards through staking and liquidity provision
          </Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'staking' && styles.activeTab]}
            onPress={() => setActiveTab('staking')}
          >
            <Text style={[styles.tabText, activeTab === 'staking' && styles.activeTabText]}>
              🏗️ Staking
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'liquidity' && styles.activeTab]}
            onPress={() => setActiveTab('liquidity')}
          >
            <Text style={[styles.tabText, activeTab === 'liquidity' && styles.activeTabText]}>
              💧 Liquidity
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'governance' && styles.activeTab]}
            onPress={() => setActiveTab('governance')}
          >
            <Text style={[styles.tabText, activeTab === 'governance' && styles.activeTabText]}>
              🗳️ Governance
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>

      {/* Stake Modal */}
      <Modal
        visible={showStakeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStakeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Stake to Pool</Text>
            
            {selectedPool && (
              <View style={styles.selectedPoolInfo}>
                <Text style={styles.selectedPoolName}>{selectedPool.name}</Text>
                <Text style={styles.selectedPoolAPY}>APY: {selectedPool.apy.toFixed(2)}%</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Amount to stake (ADA)"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={stakeAmount}
              onChangeText={setStakeAmount}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <CyberpunkButton
                title="Cancel"
                onPress={() => setShowStakeModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <CyberpunkButton
                title="Stake"
                onPress={handleStake}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Liquidity Modal */}
      <Modal
        visible={showLiquidityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLiquidityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Liquidity</Text>
            
            {selectedLiquidityPool && (
              <View style={styles.selectedPoolInfo}>
                <Text style={styles.selectedPoolName}>{selectedLiquidityPool.name}</Text>
                <Text style={styles.selectedPoolAPY}>APY: {selectedLiquidityPool.apy.toFixed(2)}%</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder={`Amount ${selectedLiquidityPool?.tokenA || 'Token A'}`}
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={liquidityAmountA}
              onChangeText={setLiquidityAmountA}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder={`Amount ${selectedLiquidityPool?.tokenB || 'Token B'}`}
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={liquidityAmountB}
              onChangeText={setLiquidityAmountB}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <CyberpunkButton
                title="Cancel"
                onPress={() => setShowLiquidityModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <CyberpunkButton
                title="Add Liquidity"
                onPress={handleAddLiquidity}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Vote Modal */}
      <Modal
        visible={showVoteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vote on Proposal</Text>
            
            {selectedProposal && (
              <View style={styles.selectedProposalInfo}>
                <Text style={styles.selectedProposalTitle}>{selectedProposal.title}</Text>
                <Text style={styles.selectedProposalDescription}>{selectedProposal.description}</Text>
              </View>
            )}

            <View style={styles.voteOptions}>
              <TouchableOpacity
                style={[styles.voteOption, voteChoice === 'yes' && styles.selectedVoteOption]}
                onPress={() => setVoteChoice('yes')}
              >
                <Text style={[styles.voteOptionText, voteChoice === 'yes' && styles.selectedVoteOptionText]}>
                  ✅ Yes
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.voteOption, voteChoice === 'no' && styles.selectedVoteOption]}
                onPress={() => setVoteChoice('no')}
              >
                <Text style={[styles.voteOptionText, voteChoice === 'no' && styles.selectedVoteOptionText]}>
                  ❌ No
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.voteOption, voteChoice === 'abstain' && styles.selectedVoteOption]}
                onPress={() => setVoteChoice('abstain')}
              >
                <Text style={[styles.voteOptionText, voteChoice === 'abstain' && styles.selectedVoteOptionText]}>
                  🤷 Abstain
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Voting Power (ADA)"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={votingPower}
              onChangeText={setVotingPower}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <CyberpunkButton
                title="Cancel"
                onPress={() => setShowVoteModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <CyberpunkButton
                title="Submit Vote"
                onPress={handleVote}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: CYBERPUNK_COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.textSecondary,
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
  poolCard: {
    marginBottom: 16,
    padding: 20,
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  poolInfo: {
    flex: 1,
  },
  poolName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  poolTicker: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  poolDescription: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  poolStats: {
    alignItems: 'center',
  },
  apyValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.success,
  },
  apyLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  poolDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  stakeButton: {
    width: '100%',
  },
  proposalCard: {
    marginBottom: 16,
    padding: 20,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  proposalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: CYBERPUNK_COLORS.background,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  proposalDescription: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  proposalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: CYBERPUNK_COLORS.background,
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  proposalDates: {
    marginBottom: 16,
  },
  dateText: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
  },
  voteButton: {
    width: '100%',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  selectedPoolInfo: {
    backgroundColor: CYBERPUNK_COLORS.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  selectedPoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  selectedPoolAPY: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.success,
    fontWeight: '600',
  },
  selectedProposalInfo: {
    backgroundColor: CYBERPUNK_COLORS.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  selectedProposalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
  },
  selectedProposalDescription: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  voteOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  voteOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  selectedVoteOption: {
    backgroundColor: CYBERPUNK_COLORS.primary,
    borderColor: CYBERPUNK_COLORS.primary,
  },
  voteOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
  },
  selectedVoteOptionText: {
    color: CYBERPUNK_COLORS.background,
  },
  input: {
    backgroundColor: CYBERPUNK_COLORS.background,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});

export default DeFiStakingScreen;
