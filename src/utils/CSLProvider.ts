/**
 * CSLProvider - Centralized lazy loading provider for Cardano Serialization Library
 * 
 * Provides a single source for all CSL components with lazy loading.
 * This avoids the need to update every individual CSL usage site.
 */

import { loadCSL } from './LazyLoader';

// Cache for CSL components
let cslComponents: any = null;

/**
 * Get all CSL components (lazy loaded)
 * @returns All CSL components
 */
export const getCSL = async () => {
    if (cslComponents) {
        return cslComponents;
    }

    const CSL = await loadCSL();
    
    // Cache commonly used components for easy access
    cslComponents = {
        // Raw CSL library
        CSL,
        
        // Address components
        Address: CSL.Address,
        BaseAddress: CSL.BaseAddress,
        StakeCredential: CSL.StakeCredential,
        RewardAddress: CSL.RewardAddress,
        Ed25519KeyHash: CSL.Ed25519KeyHash,
        
        // Key components
        Bip32PrivateKey: CSL.Bip32PrivateKey,
        PrivateKey: CSL.PrivateKey,
        PublicKey: CSL.PublicKey,
        Vkey: CSL.Vkey,
        Vkeywitness: CSL.Vkeywitness,
        Vkeywitnesses: CSL.Vkeywitnesses,
        
        // Transaction components
        TransactionBuilder: CSL.TransactionBuilder,
        TransactionBuilderConfigBuilder: CSL.TransactionBuilderConfigBuilder,
        TransactionOutput: CSL.TransactionOutput,
        TransactionInput: CSL.TransactionInput,
        TransactionHash: CSL.TransactionHash,
        TransactionWitnessSet: CSL.TransactionWitnessSet,
        Transaction: CSL.Transaction,
        
        // Value and assets
        Value: CSL.Value,
        BigNum: CSL.BigNum,
        MultiAsset: CSL.MultiAsset,
        Assets: CSL.Assets,
        AssetName: CSL.AssetName,
        ScriptHash: CSL.ScriptHash,
        
        // Fee calculation
        LinearFee: CSL.LinearFee,
        
        // Metadata
        AuxiliaryData: CSL.AuxiliaryData,
        GeneralTransactionMetadata: CSL.GeneralTransactionMetadata,
        TransactionMetadatum: CSL.TransactionMetadatum,
        MetadataMap: CSL.MetadataMap,
        MetadataList: CSL.MetadataList,
        
        // Utility functions
        hash_transaction: CSL.hash_transaction,
        min_ada_required: CSL.min_ada_required,
    };
    
    return cslComponents;
};

/**
 * Get specific CSL component (lazy loaded)
 * @param componentName - Name of the CSL component
 * @returns CSL component
 */
export const getCSLComponent = async (componentName: string) => {
    const components = await getCSL();
    return components[componentName];
};

/**
 * Check if CSL is loaded
 */
export const isCSLReady = (): boolean => {
    return cslComponents !== null;
};

/**
 * Reset CSL cache (for testing)
 */
export const resetCSLCache = (): void => {
    cslComponents = null;
};

