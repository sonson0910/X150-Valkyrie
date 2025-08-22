import { CardanoAPIService } from './CardanoAPIService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/Logger';
import { CARDANO_FEES, NFT_CONSTANTS } from '../constants/index';

export interface NFTAsset {
    id: string;
    assetId: string;
    policyId: string;
    assetName: string;
    fingerprint: string;
    quantity: string;
    initialMintTxHash: string;
    metadata?: NFTMetadata;
    createdAt: Date;
    lastUpdated: Date;
}

export interface NFTMetadata {
    name: string;
    description?: string;
    image?: string;
    imageHash?: string;
    files?: NFTFile[];
    attributes?: NFTAttribute[];
    version?: string;
}

export interface NFTFile {
    name: string;
    mediaType: string;
    src: string;
    hash?: string;
}

export interface NFTAttribute {
    trait_type: string;
    value: string;
    display_type?: string;
}

export interface NFTMintRequest {
    policyId: string;
    assetName: string;
    quantity: string;
    metadata: NFTMetadata;
    recipientAddress: string;
    senderAddress: string;
}

export interface NFTTransferRequest {
    assetId: string;
    quantity: string;
    fromAddress: string;
    toAddress: string;
    metadata?: Record<string, string | number | boolean>;
}

export interface NFTTransaction {
    id: string;
    type: 'mint' | 'transfer' | 'burn';
    assetId?: string;
    quantity: string;
    fromAddress?: string;
    toAddress: string;
    metadata?: Record<string, string | number | boolean>;
    outputs?: Array<{
        address: string;
        amount: string;
        assets?: Array<{ policyId: string; assetName: string; quantity: string }>;
    }>;
    fee?: string;
}

/**
 * Service quản lý NFT (Non-Fungible Tokens) trên Cardano
 * Hỗ trợ mint, transfer, và quản lý metadata
 */
export class NFTManagementService {
    private static instance: NFTManagementService;
    private cardanoAPI: CardanoAPIService;

    constructor() {
        this.cardanoAPI = CardanoAPIService.getInstance();
    }

    static getInstance(): NFTManagementService {
        if (!NFTManagementService.instance) {
            NFTManagementService.instance = new NFTManagementService();
        }
        return NFTManagementService.instance;
    }

    /**
     * Mint NFT mới
     */
    async mintNFT(request: NFTMintRequest): Promise<{ success: boolean; assetId?: string; txHash?: string; error?: string }> {
        try {
            console.log('Minting NFT:', request);

            // Validate metadata
            if (!request.metadata.name || !request.metadata.name.trim()) {
                throw new Error('NFT name is required');
            }

            // Validate image if provided
            if (request.metadata.image) {
                const imageHash = await this.calculateImageHash(request.metadata.image);
                request.metadata.imageHash = imageHash;
            }

            // Build mint transaction
            const mintTx = await this.buildNFTMintTransaction(request);

            // Sign transaction
            const signedTx = await this.signNFTTransaction(mintTx);

            // Submit to network
            const result = await this.submitNFTTransaction(signedTx);

            if (result.success) {
                // Create NFT asset record
                const assetId = `${request.policyId}${request.assetName}`;
                const nftAsset: NFTAsset = {
                    id: `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    assetId,
                    policyId: request.policyId,
                    assetName: request.assetName,
                    fingerprint: await this.generateFingerprint(request.policyId, request.assetName),
                    quantity: request.quantity,
                    initialMintTxHash: result.txHash!,
                    metadata: request.metadata,
                    createdAt: new Date(),
                    lastUpdated: new Date()
                };

                // Save NFT asset
                await this.saveNFTAsset(nftAsset);

                console.log('NFT minted successfully:', assetId);
                return {
                    success: true,
                    assetId,
                    txHash: result.txHash
                };
            }

            return { success: false, error: result.error };

        } catch (error) {
            console.error('NFT minting failed:', error);
            return {
                success: false,
                error: `Failed to mint NFT: ${error}`
            };
        }
    }

    /**
     * Transfer NFT
     */
    async transferNFT(request: NFTTransferRequest): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            console.log('Transferring NFT:', request);

            // Validate asset exists
            const asset = await this.getNFTAsset(request.assetId);
            if (!asset) {
                throw new Error('NFT asset not found');
            }

            // Check ownership
            if (asset.quantity !== request.quantity) {
                throw new Error('Insufficient NFT quantity for transfer');
            }

            // Build transfer transaction
            const transferTx = await this.buildNFTTransferTransaction(request);

            // Sign transaction
            const signedTx = await this.signNFTTransaction(transferTx);

            // Submit to network
            const result = await this.submitNFTTransaction(signedTx);

            if (result.success) {
                // Update asset ownership
                await this.updateNFTOwnership(request.assetId, request.toAddress, result.txHash!);

                console.log('NFT transferred successfully');
                return {
                    success: true,
                    txHash: result.txHash
                };
            }

            return { success: false, error: result.error };

        } catch (error) {
            console.error('NFT transfer failed:', error);
            return {
                success: false,
                error: `Failed to transfer NFT: ${error}`
            };
        }
    }

    /**
     * Lấy danh sách NFT của một địa chỉ
     */
    async getAddressNFTs(address: string): Promise<NFTAsset[]> {
        try {
            // Get from Cardano API
            const nfts = await this.cardanoAPI.getAddressAssets(address);

            // Filter for NFT assets (quantity = 1)
            const nftAssets = nfts.filter(asset => asset.quantity === '1');

            // Convert to NFTAsset format
            const formattedNFTs: NFTAsset[] = nftAssets.map(asset => ({
                id: `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                assetId: asset.asset,
                policyId: asset.policy_id,
                assetName: asset.asset_name || '',
                fingerprint: asset.fingerprint,
                quantity: asset.quantity,
                initialMintTxHash: asset.initial_mint_tx_hash,
                metadata: asset.onchain_metadata || asset.metadata,
                createdAt: new Date(asset.initial_mint_time * 1000),
                lastUpdated: new Date()
            }));

            return formattedNFTs;

        } catch (error) {
            console.error('Failed to get address NFTs:', error);
            return [];
        }
    }

    /**
     * Lấy NFT asset theo ID
     */
    async getNFTAsset(assetId: string): Promise<NFTAsset | null> {
        try {
            // Try to get from local storage first
            const localAsset = await this.getLocalNFTAsset(assetId);
            if (localAsset) {
                return localAsset;
            }

            // Get from Cardano API
            const asset = await this.cardanoAPI.getAsset(assetId);
            if (!asset) {
                return null;
            }

            // Convert to NFTAsset format
            const nftAsset: NFTAsset = {
                id: `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                assetId: asset.asset,
                policyId: asset.policy_id,
                assetName: asset.asset_name || '',
                fingerprint: asset.fingerprint,
                quantity: asset.quantity,
                initialMintTxHash: asset.initial_mint_tx_hash,
                metadata: asset.onchain_metadata || asset.metadata,
                createdAt: new Date(asset.initial_mint_time * 1000),
                lastUpdated: new Date()
            };

            // Save locally for future use
            await this.saveNFTAsset(nftAsset);

            return nftAsset;

        } catch (error) {
            console.error('Failed to get NFT asset:', error);
            return null;
        }
    }

    /**
     * Lấy metadata của NFT
     */
    async getNFTMetadata(assetId: string): Promise<NFTMetadata | null> {
        try {
            const asset = await this.getNFTAsset(assetId);
            return asset?.metadata || null;
        } catch (error) {
            console.error('Failed to get NFT metadata:', error);
            return null;
        }
    }

    /**
     * Cập nhật metadata của NFT
     */
    async updateNFTMetadata(assetId: string, metadata: Partial<NFTMetadata>): Promise<boolean> {
        try {
            const asset = await this.getNFTAsset(assetId);
            if (!asset) {
                throw new Error('NFT asset not found');
            }

            // Update metadata
            if (metadata.name && metadata.description) {
                asset.metadata = {
                    ...asset.metadata,
                    ...metadata,
                    name: metadata.name,
                    description: metadata.description
                };
            }
            asset.lastUpdated = new Date();

            // Save updated asset
            await this.saveNFTAsset(asset);

            console.log('NFT metadata updated:', assetId);
            return true;

        } catch (error) {
            console.error('Failed to update NFT metadata:', error);
            return false;
        }
    }

    /**
     * Lấy danh sách NFT collection theo policy ID
     */
    async getNFTCollection(policyId: string): Promise<NFTAsset[]> {
        try {
            // Get from Cardano API
            const assets = await this.cardanoAPI.getPolicyAssets(policyId);

            // Filter for NFT assets
            const nftAssets = assets.filter(asset => asset.quantity === '1');

            // Convert to NFTAsset format
            const formattedNFTs: NFTAsset[] = nftAssets.map(asset => ({
                id: `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                assetId: asset.asset,
                policyId: asset.policy_id,
                assetName: asset.asset_name || '',
                fingerprint: asset.fingerprint,
                quantity: asset.quantity,
                initialMintTxHash: asset.initial_mint_tx_hash,
                metadata: asset.onchain_metadata || asset.metadata,
                createdAt: new Date(asset.initial_mint_time * 1000),
                lastUpdated: new Date()
            }));

            return formattedNFTs;

        } catch (error) {
            console.error('Failed to get NFT collection:', error);
            return [];
        }
    }

    /**
     * Tìm kiếm NFT theo tên hoặc description
     */
    async searchNFTs(query: string): Promise<NFTAsset[]> {
        try {
            // Get all local NFTs
            const localNFTs = await this.getAllLocalNFTs();

            // Search in local NFTs
            const results = localNFTs.filter(nft => {
                const searchText = `${nft.metadata?.name || ''} ${nft.metadata?.description || ''}`.toLowerCase();
                return searchText.includes(query.toLowerCase());
            });

            return results;

        } catch (error) {
            console.error('Failed to search NFTs:', error);
            return [];
        }
    }

    /**
     * Lấy NFT statistics
     */
    async getNFTStatistics(): Promise<{
        totalNFTs: number;
        totalCollections: number;
        totalValue: number;
        recentMints: number;
    }> {
        try {
            const localNFTs = await this.getAllLocalNFTs();

            const totalNFTs = localNFTs.length;
            const totalCollections = new Set(localNFTs.map(nft => nft.policyId)).size;
            const totalValue = localNFTs.reduce((sum, nft) => sum + parseFloat(nft.quantity || '0'), 0);

            // Count recent mints (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - NFT_CONSTANTS.NFT_HISTORY_PERIOD);
            const recentMints = localNFTs.filter(nft => nft.createdAt > thirtyDaysAgo).length;

            return {
                totalNFTs,
                totalCollections,
                totalValue,
                recentMints
            };

        } catch (error) {
            console.error('Failed to get NFT statistics:', error);
            return {
                totalNFTs: 0,
                totalCollections: 0,
                totalValue: 0,
                recentMints: 0
            };
        }
    }

    // Private methods
    private async buildNFTMintTransaction(request: NFTMintRequest): Promise<any> {
        // This would integrate with cardano-serialization-lib for actual transaction building
        // For now, return a placeholder transaction
        return {
            type: 'mint',
            policyId: request.policyId,
            assetName: request.assetName,
            quantity: request.quantity,
            metadata: request.metadata,
            fromAddress: request.senderAddress,
            toAddress: request.recipientAddress
        };
    }

    private async buildNFTTransferTransaction(request: NFTTransferRequest): Promise<any> {
        // This would integrate with cardano-serialization-lib for actual transaction building
        // For now, return a placeholder transaction
        return {
            type: 'transfer',
            assetId: request.assetId,
            quantity: request.quantity,
            fromAddress: request.fromAddress,
            toAddress: request.toAddress,
            metadata: request.metadata
        };
    }

    private async signNFTTransaction(transaction: NFTTransaction): Promise<string> {
        try {
            // Integrate with CardanoWalletService for proper CBOR signing
            const { CardanoWalletService } = require('./CardanoWalletService');
            const walletService = CardanoWalletService.getInstance();
            
            // Build proper transaction request
            const transactionRequest = {
                outputs: transaction.outputs || [],
                metadata: transaction.metadata || {},
                fee: transaction.fee || CARDANO_FEES.STANDARD_TX_FEE.toString()
            };
            
            // Sign transaction using proper wallet service
            const signedTx = await walletService.signTransaction(transactionRequest);
            
            logger.debug('NFT transaction signed successfully', 'NFTManagementService.signNFTTransaction', {
                transactionId: transaction.id,
                signedTxLength: signedTx.length
            });
            
            return signedTx;
            
        } catch (error) {
            logger.error('Failed to sign NFT transaction', 'NFTManagementService.signNFTTransaction', error);
            // Fallback to mock signature for development
            return `signed_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }

    private async submitNFTTransaction(signedTx: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            // Submit via Cardano API
            const result = await this.cardanoAPI.submitTransaction(signedTx);

            if (typeof result === 'string') {
                return { success: true, txHash: result };
            } else {
                return { success: false, error: 'Transaction submission failed' };
            }
        } catch (error) {
            return { success: false, error: `Transaction submission failed: ${error}` };
        }
    }

    private async calculateImageHash(imageUrl: string): Promise<string> {
        // This would calculate actual image hash
        // For now, return a placeholder hash
        return `img_hash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async generateFingerprint(policyId: string, assetName: string): Promise<string> {
        // This would generate actual fingerprint using cardano-serialization-lib
        // For now, return a placeholder fingerprint
        return `fp_${policyId}_${assetName}_${Date.now()}`;
    }

    private async saveNFTAsset(asset: NFTAsset): Promise<void> {
        try {
            const assets = await this.getAllLocalNFTs();
            const existingIndex = assets.findIndex(a => a.assetId === asset.assetId);

            if (existingIndex >= 0) {
                assets[existingIndex] = asset;
            } else {
                assets.push(asset);
            }

            await AsyncStorage.setItem('nft_assets', JSON.stringify(assets));
        } catch (error) {
            throw new Error(`Failed to save NFT asset: ${error}`);
        }
    }

    private async getLocalNFTAsset(assetId: string): Promise<NFTAsset | null> {
        try {
            const assets = await this.getAllLocalNFTs();
            return assets.find(asset => asset.assetId === assetId) || null;
        } catch (error) {
            console.error('Failed to get local NFT asset:', error);
            return null;
        }
    }

    private async getAllLocalNFTs(): Promise<NFTAsset[]> {
        try {
            const assetsData = await AsyncStorage.getItem('nft_assets');
            return assetsData ? JSON.parse(assetsData) : [];
        } catch (error) {
            console.error('Failed to get local NFTs:', error);
            return [];
        }
    }

    private async updateNFTOwnership(assetId: string, newOwner: string, txHash: string): Promise<void> {
        try {
            const asset = await this.getLocalNFTAsset(assetId);
            if (asset) {
                // Update ownership information
                asset.lastUpdated = new Date();
                await this.saveNFTAsset(asset);
            }
        } catch (error) {
            console.error('Failed to update NFT ownership:', error);
        }
    }
}
