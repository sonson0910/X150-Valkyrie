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
  Image,
  FlatList,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import { NFTManagementService, NFTAsset, NFTMetadata } from '../services/NFTManagementService';
import { CyberpunkCard, CyberpunkButton, LoadingSpinner } from '../components/index';

type NFTGalleryScreenNavigationProp = StackNavigationProp<RootStackParamList, 'NFTGallery'>;

interface Props {
  navigation: NFTGalleryScreenNavigationProp;
}

const NFTGalleryScreen: React.FC<Props> = ({ navigation }) => {
  const [nfts, setNfts] = useState<NFTAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMintModal, setShowMintModal] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<NFTAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mint form states
  const [nftName, setNftName] = useState('');
  const [nftDescription, setNftDescription] = useState('');
  const [nftImage, setNftImage] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [quantity, setQuantity] = useState('1');

  const nftService = NFTManagementService.getInstance();

  useEffect(() => {
    loadNFTs();
  }, []);

  const loadNFTs = async () => {
    try {
      setIsLoading(true);
      // For demo, use a placeholder address
      const address = 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer';
      const nftsData = await nftService.getAddressNFTs(address);
      setNfts(nftsData);
    } catch (error) {
      console.error('Failed to load NFTs:', error);
      Alert.alert('Error', 'Failed to load NFT collection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMintNFT = async () => {
    if (!nftName.trim() || !policyId.trim() || !assetName.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const metadata: NFTMetadata = {
        name: nftName,
        description: nftDescription,
        image: nftImage,
        version: '1.0'
      };

      const result = await nftService.mintNFT({
        policyId,
        assetName,
        quantity,
        metadata,
        recipientAddress: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer',
        senderAddress: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer'
      });

      if (result.success) {
        Alert.alert('Success', `NFT minted successfully! Asset ID: ${result.assetId}`);
        setShowMintModal(false);
        resetForm();
        loadNFTs();
      } else {
        Alert.alert('Error', result.error || 'Failed to mint NFT');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to mint NFT: ${error}`);
    }
  };

  const handleTransferNFT = async (nft: NFTAsset) => {
    Alert.prompt(
      'Transfer NFT',
      'Enter recipient address:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async (recipientAddress) => {
            if (!recipientAddress || !recipientAddress.trim()) {
              Alert.alert('Error', 'Please enter a valid recipient address');
              return;
            }

            try {
              const result = await nftService.transferNFT({
                assetId: nft.assetId,
                quantity: nft.quantity,
                fromAddress: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer',
                toAddress: recipientAddress.trim()
              });

              if (result.success) {
                Alert.alert('Success', 'NFT transferred successfully');
                loadNFTs();
              } else {
                Alert.alert('Error', result.error || 'Failed to transfer NFT');
              }
            } catch (error) {
              Alert.alert('Error', `Failed to transfer NFT: ${error}`);
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setNftName('');
    setNftDescription('');
    setNftImage('');
    setPolicyId('');
    setAssetName('');
    setQuantity('1');
  };

  const filteredNFTs = nfts.filter(nft => 
    nft.metadata?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    nft.metadata?.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderNFTCard = ({ item: nft }: { item: NFTAsset }) => (
    <TouchableOpacity
      onPress={() => setSelectedNFT(nft)}
      activeOpacity={0.8}
    >
      <CyberpunkCard style={styles.nftCard}>
        <View style={styles.nftImageContainer}>
          {nft.metadata?.image ? (
            <Image
              source={{ uri: nft.metadata.image }}
              style={styles.nftImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.nftPlaceholder}>
              <Text style={styles.nftPlaceholderText}>🎨</Text>
            </View>
          )}
        </View>

        <View style={styles.nftInfo}>
          <Text style={styles.nftName} numberOfLines={1}>
            {nft.metadata?.name || 'Unnamed NFT'}
          </Text>
          <Text style={styles.nftDescription} numberOfLines={2}>
            {nft.metadata?.description || 'No description'}
          </Text>
          
          <View style={styles.nftDetails}>
            <Text style={styles.nftPolicyId}>
              Policy: {nft.policyId.slice(0, 8)}...
            </Text>
            <Text style={styles.nftQuantity}>
              Quantity: {nft.quantity}
            </Text>
          </View>

          <View style={styles.nftActions}>
            <CyberpunkButton
              title="Transfer"
              onPress={() => handleTransferNFT(nft)}
              variant="outline"
              style={styles.transferButton}
            />
            <CyberpunkButton
              title="View Details"
              onPress={() => setSelectedNFT(nft)}
              style={styles.detailsButton}
            />
          </View>
        </View>
      </CyberpunkCard>
    </TouchableOpacity>
  );

  const renderNFTDetails = () => {
    if (!selectedNFT) return null;

    return (
      <Modal
        visible={!!selectedNFT}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedNFT(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>NFT Details</Text>
              
              <View style={styles.nftDetailImageContainer}>
                {selectedNFT.metadata?.image ? (
                  <Image
                    source={{ uri: selectedNFT.metadata.image }}
                    style={styles.nftDetailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.nftDetailPlaceholder}>
                    <Text style={styles.nftDetailPlaceholderText}>🎨</Text>
                  </View>
                )}
              </View>

              <View style={styles.nftDetailInfo}>
                <Text style={styles.nftDetailName}>
                  {selectedNFT.metadata?.name || 'Unnamed NFT'}
                </Text>
                <Text style={styles.nftDetailDescription}>
                  {selectedNFT.metadata?.description || 'No description'}
                </Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Asset ID:</Text>
                  <Text style={styles.detailValue}>{selectedNFT.assetId}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Policy ID:</Text>
                  <Text style={styles.detailValue}>{selectedNFT.policyId}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fingerprint:</Text>
                  <Text style={styles.detailValue}>{selectedNFT.fingerprint}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantity:</Text>
                  <Text style={styles.detailValue}>{selectedNFT.quantity}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedNFT.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                {selectedNFT.metadata?.attributes && selectedNFT.metadata.attributes.length > 0 && (
                  <View style={styles.attributesSection}>
                    <Text style={styles.attributesTitle}>Attributes:</Text>
                    {selectedNFT.metadata.attributes.map((attr, index) => (
                      <View key={index} style={styles.attributeItem}>
                        <Text style={styles.attributeType}>{attr.trait_type}:</Text>
                        <Text style={styles.attributeValue}>{attr.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <CyberpunkButton
                  title="Transfer NFT"
                  onPress={() => {
                    setSelectedNFT(null);
                    handleTransferNFT(selectedNFT);
                  }}
                  style={styles.modalButton}
                />
                <CyberpunkButton
                  title="Close"
                  onPress={() => setSelectedNFT(null)}
                  variant="outline"
                  style={styles.modalButton}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading NFT collection..." />;
  }

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>NFT Gallery</Text>
          <Text style={styles.subtitle}>
            Your digital art collection on Cardano
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search NFTs..."
            placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Mint NFT Button */}
        <TouchableOpacity
          style={styles.mintButton}
          onPress={() => setShowMintModal(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent]}
            style={styles.mintButtonGradient}
          >
            <Text style={styles.mintButtonText}>🎨 MINT NEW NFT</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* NFT Collection */}
        <View style={styles.collectionSection}>
          <Text style={styles.sectionTitle}>
            Your Collection ({filteredNFTs.length} NFTs)
          </Text>
          
          {filteredNFTs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No NFTs found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try adjusting your search' : 'Mint your first NFT to get started'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredNFTs}
              renderItem={renderNFTCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.nftRow}
            />
          )}
        </View>
      </ScrollView>

      {/* Mint NFT Modal */}
      <Modal
        visible={showMintModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMintModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Mint New NFT</Text>
              
              <TextInput
                style={styles.input}
                placeholder="NFT Name *"
                placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
                value={nftName}
                onChangeText={setNftName}
              />

              <TextInput
                style={styles.input}
                placeholder="Description"
                placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
                value={nftDescription}
                onChangeText={setNftDescription}
                multiline
                numberOfLines={3}
              />

              <TextInput
                style={styles.input}
                placeholder="Image URL"
                placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
                value={nftImage}
                onChangeText={setNftImage}
              />

              <TextInput
                style={styles.input}
                placeholder="Policy ID *"
                placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
                value={policyId}
                onChangeText={setPolicyId}
              />

              <TextInput
                style={styles.input}
                placeholder="Asset Name *"
                placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
                value={assetName}
                onChangeText={setAssetName}
              />

              <TextInput
                style={styles.input}
                placeholder="Quantity"
                placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
              />

              <View style={styles.modalActions}>
                <CyberpunkButton
                  title="Cancel"
                  onPress={() => setShowMintModal(false)}
                  variant="outline"
                  style={styles.modalButton}
                />
                <CyberpunkButton
                  title="Mint NFT"
                  onPress={handleMintNFT}
                  style={styles.modalButton}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {renderNFTDetails()}
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
  searchContainer: {
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
  },
  mintButton: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mintButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  mintButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.background,
    letterSpacing: 1,
  },
  collectionSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 16,
  },
  nftRow: {
    justifyContent: 'space-between',
  },
  nftCard: {
    width: '48%',
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
  },
  nftImageContainer: {
    height: 120,
    backgroundColor: CYBERPUNK_COLORS.background,
  },
  nftImage: {
    width: '100%',
    height: '100%',
  },
  nftPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.background,
  },
  nftPlaceholderText: {
    fontSize: 32,
  },
  nftInfo: {
    padding: 12,
  },
  nftName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  nftDescription: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 16,
  },
  nftDetails: {
    marginBottom: 8,
  },
  nftPolicyId: {
    fontSize: 10,
    color: CYBERPUNK_COLORS.primary,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  nftQuantity: {
    fontSize: 10,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  nftActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transferButton: {
    flex: 1,
    marginRight: 4,
  },
  detailsButton: {
    flex: 1,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    opacity: 0.7,
    textAlign: 'center',
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
    maxHeight: '80%',
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
  nftDetailImageContainer: {
    height: 200,
    backgroundColor: CYBERPUNK_COLORS.background,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  nftDetailImage: {
    width: '100%',
    height: '100%',
  },
  nftDetailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.background,
  },
  nftDetailPlaceholderText: {
    fontSize: 48,
  },
  nftDetailInfo: {
    marginBottom: 20,
  },
  nftDetailName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
  },
  nftDetailDescription: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
  },
  attributesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CYBERPUNK_COLORS.border,
  },
  attributesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 12,
  },
  attributeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  attributeType: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    fontWeight: '600',
  },
  attributeValue: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
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
    marginBottom: 16,
  },
});

export default NFTGalleryScreen;
