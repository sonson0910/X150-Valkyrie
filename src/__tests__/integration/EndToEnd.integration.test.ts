/**
 * End-to-End Integration Test Suite
 * 
 * Tests complete user workflows from start to finish including:
 * - Complete wallet setup and backup flow
 * - Full transaction lifecycle (send/receive)
 * - Portfolio management and analytics
 * - Multi-signature operations
 * - DeFi staking workflows
 * - NFT management
 * - Cross-service data synchronization
 */

import { WalletService } from '../../services/wallet/WalletService';
import WalletKeyManager from '../../services/wallet/WalletKeyManager';
import TransactionBuilder from '../../services/wallet/TransactionBuilder';
import { CardanoAPIService } from '../../services/CardanoAPIService';
import { PortfolioService } from '../../services/portfolio/PortfolioService';
import { MnemonicTransformService } from '../../services/MnemonicTransformService';
import { BiometricService } from '../../services/BiometricService';
import { MultiSignatureService } from '../../services/MultiSignatureService';
import { DeFiStakingService } from '../../services/DeFiStakingService';
import { NFTManagementService } from '../../services/NFTManagementService';

describe('End-to-End Integration', () => {
  let walletService: WalletService;
  let apiService: CardanoAPIService;
  let portfolioService: PortfolioService;
  let multiSigService: MultiSignatureService;
  let defiService: DeFiStakingService;
  let nftService: NFTManagementService;

  beforeEach(() => {
    walletService = WalletService.getInstance();
    apiService = CardanoAPIService.getInstance();
    portfolioService = PortfolioService.getInstance();
    multiSigService = MultiSignatureService.getInstance();
    defiService = DeFiStakingService.getInstance();
    nftService = NFTManagementService.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Wallet Setup Flow', () => {
    it('should complete full wallet creation and backup workflow', async () => {
      // Step 1: Create new wallet
      const walletCreationResult = await walletService.createWallet({
        mnemonic: WalletKeyManager.generateMnemonic(256), // 24 words for security
        name: 'My Complete Wallet',
        password: 'secure-password-123'
      });

      expect(walletCreationResult.success).toBe(true);
      expect(walletCreationResult.wallet.name).toBe('My Complete Wallet');
      expect(walletCreationResult.wallet.accounts).toHaveLength(1);

      const primaryAccount = walletCreationResult.wallet.accounts[0];
      expect(primaryAccount.address).toMatch(/^addr1/);
      expect(primaryAccount.name).toContain('Primary');

      // Step 2: Transform mnemonic to 36 words
      const transformPassword = 'transformation-secret-456';
      const transformed36Word = await MnemonicTransformService.transformMnemonic(
        walletCreationResult.wallet.mnemonic,
        transformPassword
      );

      expect(transformed36Word.split(' ')).toHaveLength(36);

      // Step 3: Verify transformation is reversible
      const restored12Word = await MnemonicTransformService.restoreMnemonic(
        transformed36Word,
        transformPassword
      );
      expect(restored12Word).toBe(walletCreationResult.wallet.mnemonic);

      // Step 4: Setup biometric authentication
      const { isSensorAvailable, simplePrompt } = require('react-native-biometrics');
      isSensorAvailable.mockResolvedValue({ available: true, biometryType: 'FaceID' });
      simplePrompt.mockResolvedValue({ success: true });

      const biometricSetup = await BiometricService.getInstance().setupBiometricAuth();
      expect(biometricSetup.success).toBe(true);

      // Step 5: Create additional accounts
      const businessAccount = await walletService.createAccount('Business Expenses');
      const savingsAccount = await walletService.createAccount('Long-term Savings');

      expect(businessAccount.success).toBe(true);
      expect(savingsAccount.success).toBe(true);

      const currentWallet = await walletService.getCurrentWallet();
      expect(currentWallet.accounts).toHaveLength(3);
    });

    it('should complete wallet restoration workflow', async () => {
      // Step 1: Create original wallet
      const originalMnemonic = WalletKeyManager.generateMnemonic(128);
      const originalWallet = await walletService.createWallet({
        mnemonic: originalMnemonic,
        name: 'Original Wallet',
        password: 'original-password-123'
      });

      const originalAddress = originalWallet.wallet.accounts[0].address;

      // Step 2: Clear wallet (simulate device loss/reset)
      await walletService.clearWallet();

      // Step 3: Restore wallet from mnemonic
      const restoredWallet = await walletService.restoreWallet({
        mnemonic: originalMnemonic,
        name: 'Restored Wallet',
        password: 'new-password-456'
      });

      expect(restoredWallet.success).toBe(true);
      expect(restoredWallet.wallet.accounts[0].address).toBe(originalAddress);

      // Step 4: Verify account recovery
      const currentWallet = await walletService.getCurrentWallet();
      expect(currentWallet.accounts[0].address).toBe(originalAddress);
    });
  });

  describe('Complete Transaction Lifecycle', () => {
    it('should execute full send transaction workflow', async () => {
      // Setup: Create wallet and mock data
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletService.createWallet({
        mnemonic,
        name: 'Transaction Test Wallet',
        password: 'test-password-123'
      });

      const currentWallet = await walletService.getCurrentWallet();
      const senderAddress = currentWallet.accounts[0].address;
      const recipientAddress = 'addr1test_recipient_e2e';

      // Mock UTXOs for sender
      const mockUtxos = [
        {
          tx_hash: 'e2e_utxo_1',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '10000000' }], // 10 ADA
          address: senderAddress,
          block: 'block_123',
        },
        {
          tx_hash: 'e2e_utxo_2',
          tx_index: 1,
          amount: [
            { unit: 'lovelace', quantity: '5000000' },
            { unit: 'test_policy.test_token', quantity: '1000' }
          ],
          address: senderAddress,
          block: 'block_124',
        }
      ];

      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(mockUtxos);
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'e2e_tx_hash_success' },
        status: 200
      });

      // Step 1: Prepare transaction
      const transactionPreview = await walletService.previewTransaction({
        fromAccountIndex: 0,
        toAddress: recipientAddress,
        amount: '3000000', // 3 ADA
        assets: [
          { unit: 'test_policy.test_token', quantity: '500' }
        ],
        memo: 'End-to-end test transaction'
      });

      expect(transactionPreview.success).toBe(true);
      expect(transactionPreview.preview.totalCost).toBeDefined();
      expect(transactionPreview.preview.fee).toBeDefined();
      expect(transactionPreview.preview.outputs).toHaveLength(2); // Recipient + change

      // Step 2: Send transaction with biometric confirmation
      const { simplePrompt } = require('react-native-biometrics');
      simplePrompt.mockResolvedValue({ success: true });

      const sendResult = await walletService.sendTransaction({
        fromAccountIndex: 0,
        toAddress: recipientAddress,
        amount: '3000000',
        assets: [
          { unit: 'test_policy.test_token', quantity: '500' }
        ],
        memo: 'End-to-end test transaction',
        requireBiometric: true
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.txHash).toBe('e2e_tx_hash_success');
      expect(sendResult.transaction.outputs).toHaveLength(2);

      // Step 3: Verify transaction was recorded
      const transactionHistory = await walletService.getTransactionHistory(0);
      expect(transactionHistory.transactions).toHaveLength(1);
      expect(transactionHistory.transactions[0].hash).toBe('e2e_tx_hash_success');
    });

    it('should handle receive transaction workflow', async () => {
      // Setup wallet
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletService.createWallet({
        mnemonic,
        name: 'Receive Test Wallet',
        password: 'test-password-123'
      });

      const currentWallet = await walletService.getCurrentWallet();
      const receiverAddress = currentWallet.accounts[0].address;

      // Step 1: Generate receive address with memo
      const receiveAddressInfo = await walletService.generateReceiveAddress({
        accountIndex: 0,
        memo: 'Payment for services',
        amount: '5000000' // 5 ADA
      });

      expect(receiveAddressInfo.success).toBe(true);
      expect(receiveAddressInfo.address).toMatch(/^addr1/);
      expect(receiveAddressInfo.qrCode).toBeDefined();

      // Step 2: Mock incoming transaction
      const incomingTransaction = {
        hash: 'incoming_tx_hash',
        block: 'new_block_456',
        block_time: Date.now(),
        amount: [{ unit: 'lovelace', quantity: '5000000' }],
        fees: '200000',
        inputs: [
          {
            address: 'addr1test_sender_external',
            amount: [{ unit: 'lovelace', quantity: '6000000' }]
          }
        ],
        outputs: [
          {
            address: receiverAddress,
            amount: [{ unit: 'lovelace', quantity: '5000000' }]
          },
          {
            address: 'addr1test_sender_external',
            amount: [{ unit: 'lovelace', quantity: '800000' }] // Change
          }
        ]
      };

      jest.spyOn(apiService, 'getAddressTransactions').mockResolvedValue([incomingTransaction]);

      // Step 3: Sync and detect incoming transaction
      const syncResult = await walletService.syncWallet();
      expect(syncResult.success).toBe(true);
      expect(syncResult.newTransactions).toHaveLength(1);

      // Step 4: Verify balance update
      const updatedBalance = await walletService.getAccountBalance(0);
      expect(parseInt(updatedBalance.confirmed)).toBe(5000000);
    });
  });

  describe('Portfolio Management Workflow', () => {
    it('should complete full portfolio analysis workflow', async () => {
      // Setup wallet with diverse holdings
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletService.createWallet({
        mnemonic,
        name: 'Portfolio Test Wallet',
        password: 'test-password-123'
      });

      const currentWallet = await walletService.getCurrentWallet();
      const portfolioAddress = currentWallet.accounts[0].address;

      // Mock diverse portfolio data
      const mockPortfolioUtxos = [
        {
          tx_hash: 'portfolio_utxo_1',
          tx_index: 0,
          amount: [
            { unit: 'lovelace', quantity: '50000000' }, // 50 ADA
            { unit: 'hosky_policy.hosky', quantity: '1000000' },
            { unit: 'sundae_policy.sundae', quantity: '500' }
          ],
          address: portfolioAddress,
          block: 'portfolio_block_1',
        }
      ];

      const mockStakingInfo = {
        active: true,
        rewards: '2500000', // 2.5 ADA rewards
        poolId: 'pool1test_staking_pool',
        delegation: '50000000'
      };

      const mockNFTs = [
        {
          unit: 'nft_policy.nft_1',
          quantity: '1',
          metadata: {
            name: 'Test NFT #1',
            image: 'https://example.com/nft1.jpg',
            attributes: [
              { trait_type: 'Rarity', value: 'Rare' }
            ]
          }
        }
      ];

      // Mock API responses
      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(mockPortfolioUtxos);
      jest.spyOn(apiService, 'getStakeAddressInfo').mockResolvedValue(mockStakingInfo);

      // Mock price data
      const mockPrices = {
        'ADA': { price: 1.50, change24h: 0.05 },
        'HOSKY': { price: 0.001, change24h: -0.02 },
        'SUNDAE': { price: 0.25, change24h: 0.15 }
      };

      jest.spyOn(require('../../services/portfolio/AssetPriceService').AssetPriceService.getInstance(), 'getAssetPrices')
        .mockResolvedValue(mockPrices);

      // Step 1: Generate comprehensive portfolio report
      const portfolioReport = await portfolioService.getComprehensivePortfolioReport('user_123');

      expect(portfolioReport).toMatchObject({
        summary: expect.objectContaining({
          totalValue: expect.any(Number),
          totalAda: expect.any(Number),
          assetCount: expect.any(Number)
        }),
        holdings: expect.any(Array),
        performance: expect.objectContaining({
          '24h': expect.any(Number)
        }),
        staking: expect.objectContaining({
          isStaking: expect.any(Boolean),
          rewards: expect.any(Number)
        })
      });

      // Step 2: Generate portfolio analytics
      const analytics = await portfolioService.getPortfolioAnalytics('user_123');

      expect(analytics).toMatchObject({
        allocation: expect.any(Object),
        riskMetrics: expect.objectContaining({
          volatility: expect.any(Number),
          riskScore: expect.any(Number)
        }),
        diversification: expect.any(Object)
      });

      // Step 3: Get historical performance
      const historical = await portfolioService.getHistoricalPerformance('user_123', '30d');
      expect(historical.dataPoints).toBeDefined();
      expect(historical.totalReturn).toBeDefined();
    });
  });

  describe('Multi-Signature Workflow', () => {
    it('should complete multi-signature transaction workflow', async () => {
      // Setup multiple wallets for multi-sig
      const cosignerWallets = [];
      
      for (let i = 0; i < 3; i++) {
        const mnemonic = WalletKeyManager.generateMnemonic(128);
        const wallet = await walletService.createWallet({
          mnemonic,
          name: `Cosigner Wallet ${i + 1}`,
          password: `password-${i + 1}-123`
        });
        cosignerWallets.push(wallet.wallet);
      }

      // Step 1: Create multi-signature setup
      const multiSigSetup = await multiSigService.createMultiSignature({
        name: 'Board Treasury',
        description: 'Company board treasury multi-sig',
        requiredSignatures: 2,
        totalSigners: 3,
        cosigners: cosignerWallets.map((wallet, index) => ({
          name: `Board Member ${index + 1}`,
          publicKey: wallet.accounts[0].publicKey,
          address: wallet.accounts[0].address
        }))
      });

      expect(multiSigSetup.success).toBe(true);
      expect(multiSigSetup.multiSig.address).toMatch(/^addr1/);
      expect(multiSigSetup.multiSig.script).toBeDefined();

      // Step 2: Fund multi-sig address
      const fundingUtxos = [
        {
          tx_hash: 'multisig_funding_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '100000000' }], // 100 ADA
          address: multiSigSetup.multiSig.address,
          block: 'funding_block',
        }
      ];

      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(fundingUtxos);

      // Step 3: Create multi-sig transaction
      const multiSigTx = await multiSigService.createTransaction({
        multiSigId: multiSigSetup.multiSig.id,
        toAddress: 'addr1test_recipient_multisig',
        amount: '50000000', // 50 ADA
        memo: 'Board approved payment'
      });

      expect(multiSigTx.success).toBe(true);
      expect(multiSigTx.transaction.requiredSignatures).toBe(2);
      expect(multiSigTx.transaction.currentSignatures).toBe(0);

      // Step 4: Sign with first cosigner
      const signature1 = await multiSigService.signTransaction({
        transactionId: multiSigTx.transaction.id,
        cosignerIndex: 0
      });

      expect(signature1.success).toBe(true);
      expect(signature1.transaction.currentSignatures).toBe(1);

      // Step 5: Sign with second cosigner (should complete transaction)
      const signature2 = await multiSigService.signTransaction({
        transactionId: multiSigTx.transaction.id,
        cosignerIndex: 1
      });

      expect(signature2.success).toBe(true);
      expect(signature2.transaction.currentSignatures).toBe(2);
      expect(signature2.transaction.isComplete).toBe(true);

      // Step 6: Submit completed multi-sig transaction
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'multisig_tx_hash_success' },
        status: 200
      });

      const submitResult = await multiSigService.submitTransaction({
        transactionId: multiSigTx.transaction.id
      });

      expect(submitResult.success).toBe(true);
      expect(submitResult.txHash).toBe('multisig_tx_hash_success');
    });
  });

  describe('DeFi Staking Workflow', () => {
    it('should complete full staking workflow', async () => {
      // Setup wallet for staking
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletService.createWallet({
        mnemonic,
        name: 'Staking Wallet',
        password: 'staking-password-123'
      });

      const currentWallet = await walletService.getCurrentWallet();
      const stakingAddress = currentWallet.accounts[0].address;
      const stakeAddress = currentWallet.accounts[0].stakeAddress;

      // Mock wallet balance
      const stakingUtxos = [
        {
          tx_hash: 'staking_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '100000000' }], // 100 ADA
          address: stakingAddress,
          block: 'staking_block',
        }
      ];

      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(stakingUtxos);

      // Step 1: Find available stake pools
      const availablePools = await defiService.getAvailableStakePools();
      expect(availablePools.pools).toBeDefined();
      expect(availablePools.pools.length).toBeGreaterThan(0);

      const selectedPool = availablePools.pools[0];

      // Step 2: Create delegation transaction
      const delegationTx = await defiService.createDelegation({
        stakeAddress,
        poolId: selectedPool.poolId,
        amount: '50000000' // Delegate 50 ADA
      });

      expect(delegationTx.success).toBe(true);
      expect(delegationTx.transaction.outputs).toBeDefined();

      // Step 3: Submit delegation
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'delegation_tx_hash' },
        status: 200
      });

      const delegationResult = await defiService.submitDelegation({
        transactionId: delegationTx.transaction.id
      });

      expect(delegationResult.success).toBe(true);
      expect(delegationResult.txHash).toBe('delegation_tx_hash');

      // Step 4: Check staking status
      const stakingStatus = await defiService.getStakingStatus(stakeAddress);
      expect(stakingStatus.isActive).toBe(true);
      expect(stakingStatus.poolId).toBe(selectedPool.poolId);

      // Step 5: Simulate rewards accumulation and withdrawal
      const mockRewards = '5000000'; // 5 ADA rewards
      jest.spyOn(apiService, 'getStakeAddressInfo').mockResolvedValue({
        rewards: mockRewards,
        delegation: selectedPool.poolId
      });

      const rewardsInfo = await defiService.getRewards(stakeAddress);
      expect(rewardsInfo.availableRewards).toBe(mockRewards);

      // Step 6: Withdraw rewards
      const withdrawalTx = await defiService.withdrawRewards({
        stakeAddress,
        amount: mockRewards
      });

      expect(withdrawalTx.success).toBe(true);
    });
  });

  describe('NFT Management Workflow', () => {
    it('should complete NFT minting and transfer workflow', async () => {
      // Setup wallet for NFT operations
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletService.createWallet({
        mnemonic,
        name: 'NFT Creator Wallet',
        password: 'nft-password-123'
      });

      const currentWallet = await walletService.getCurrentWallet();
      const creatorAddress = currentWallet.accounts[0].address;

      // Mock funding UTXOs
      const nftUtxos = [
        {
          tx_hash: 'nft_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '50000000' }], // 50 ADA
          address: creatorAddress,
          block: 'nft_block',
        }
      ];

      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(nftUtxos);

      // Step 1: Create NFT collection
      const collection = await nftService.createCollection({
        name: 'Test Art Collection',
        description: 'A collection of test NFTs',
        image: 'https://example.com/collection.jpg',
        creatorAddress
      });

      expect(collection.success).toBe(true);
      expect(collection.collection.policyId).toBeDefined();

      // Step 2: Mint NFT
      const mintTx = await nftService.mintNFT({
        collectionId: collection.collection.id,
        name: 'Test NFT #1',
        description: 'First test NFT in collection',
        image: 'https://example.com/nft1.jpg',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Rarity', value: 'Common' }
        ],
        royalty: {
          percentage: 5,
          address: creatorAddress
        }
      });

      expect(mintTx.success).toBe(true);
      expect(mintTx.transaction.outputs).toBeDefined();

      // Step 3: Submit minting transaction
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'nft_mint_tx_hash' },
        status: 200
      });

      const mintResult = await nftService.submitMinting({
        transactionId: mintTx.transaction.id
      });

      expect(mintResult.success).toBe(true);
      expect(mintResult.txHash).toBe('nft_mint_tx_hash');

      // Step 4: Transfer NFT
      const recipientAddress = 'addr1test_nft_recipient';
      const transferTx = await nftService.transferNFT({
        nftId: mintTx.nft.id,
        fromAddress: creatorAddress,
        toAddress: recipientAddress,
        price: '10000000' // 10 ADA
      });

      expect(transferTx.success).toBe(true);

      // Step 5: Submit transfer
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'nft_transfer_tx_hash' },
        status: 200
      });

      const transferResult = await nftService.submitTransfer({
        transactionId: transferTx.transaction.id
      });

      expect(transferResult.success).toBe(true);
      expect(transferResult.txHash).toBe('nft_transfer_tx_hash');

      // Step 6: Verify NFT ownership change
      const nftInfo = await nftService.getNFTInfo(mintTx.nft.id);
      expect(nftInfo.currentOwner).toBe(recipientAddress);
    });
  });

  describe('Cross-Service Data Synchronization', () => {
    it('should maintain data consistency across all services', async () => {
      // Setup comprehensive wallet
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      const wallet = await walletService.createWallet({
        mnemonic,
        name: 'Comprehensive Test Wallet',
        password: 'comprehensive-password-123'
      });

      const walletAddress = wallet.wallet.accounts[0].address;

      // Mock comprehensive UTXO data
      const comprehensiveUtxos = [
        {
          tx_hash: 'comprehensive_utxo_1',
          tx_index: 0,
          amount: [
            { unit: 'lovelace', quantity: '100000000' }, // 100 ADA
            { unit: 'token_policy.utility_token', quantity: '1000' },
            { unit: 'nft_policy.art_piece_1', quantity: '1' }
          ],
          address: walletAddress,
          block: 'comprehensive_block',
        }
      ];

      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(comprehensiveUtxos);

      // Step 1: Sync wallet data across services
      const walletSync = await walletService.syncWallet();
      expect(walletSync.success).toBe(true);

      // Step 2: Verify data consistency in portfolio service
      const portfolioData = await portfolioService.getComprehensivePortfolioReport('user_123');
      expect(portfolioData.holdings.some(holding => 
        holding.asset === 'token_policy.utility_token'
      )).toBe(true);

      // Step 3: Verify NFT service recognizes NFT holdings
      const nftHoldings = await nftService.getUserNFTs(walletAddress);
      expect(nftHoldings.nfts.some(nft => 
        nft.unit === 'nft_policy.art_piece_1'
      )).toBe(true);

      // Step 4: Create transaction and verify impact across services
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'sync_test_tx_hash' },
        status: 200
      });

      const sendResult = await walletService.sendTransaction({
        fromAccountIndex: 0,
        toAddress: 'addr1test_sync_recipient',
        amount: '10000000', // 10 ADA
        assets: [
          { unit: 'token_policy.utility_token', quantity: '100' }
        ]
      });

      expect(sendResult.success).toBe(true);

      // Step 5: Verify all services reflect the transaction
      const updatedWallet = await walletService.getCurrentWallet();
      const updatedPortfolio = await portfolioService.getComprehensivePortfolioReport('user_123');
      const transactionHistory = await walletService.getTransactionHistory(0);

      expect(transactionHistory.transactions).toHaveLength(1);
      expect(transactionHistory.transactions[0].hash).toBe('sync_test_tx_hash');
    });

    it('should handle service-specific failures without affecting others', async () => {
      // Setup wallet
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletService.createWallet({
        mnemonic,
        name: 'Resilient Wallet',
        password: 'resilient-password-123'
      });

      // Mock portfolio service to fail
      jest.spyOn(portfolioService, 'getComprehensivePortfolioReport')
        .mockRejectedValue(new Error('Portfolio service unavailable'));

      // Mock NFT service to fail
      jest.spyOn(nftService, 'getUserNFTs')
        .mockRejectedValue(new Error('NFT service unavailable'));

      // Core wallet operations should still work
      const currentWallet = await walletService.getCurrentWallet();
      expect(currentWallet).toBeDefined();

      const newAccount = await walletService.createAccount('Backup Account');
      expect(newAccount.success).toBe(true);

      // Transaction building should work
      const mockUtxos = [
        {
          tx_hash: 'resilient_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '5000000' }],
          address: currentWallet.accounts[0].address,
          block: 'resilient_block',
        }
      ];

      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(mockUtxos);
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'resilient_tx_hash' },
        status: 200
      });

      const sendResult = await walletService.sendTransaction({
        fromAccountIndex: 0,
        toAddress: 'addr1test_resilient_recipient',
        amount: '2000000'
      });

      expect(sendResult.success).toBe(true);
    });
  });

  describe('Performance and Scalability End-to-End', () => {
    it('should handle complex multi-service workflows efficiently', async () => {
      const startTime = Date.now();

      // Create wallet
      const mnemonic = WalletKeyManager.generateMnemonic(256); // 24 words
      const wallet = await walletService.createWallet({
        mnemonic,
        name: 'Performance Test Wallet',
        password: 'performance-password-123'
      });

      // Create multiple accounts
      const accountPromises = Array(5).fill(0).map((_, i) =>
        walletService.createAccount(`Account ${i + 1}`)
      );
      await Promise.all(accountPromises);

      // Generate addresses for each account
      const addressPromises = [];
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 10; j++) {
          addressPromises.push(
            walletService.generateReceiveAddress({
              accountIndex: i,
              memo: `Address ${j + 1} for Account ${i + 1}`
            })
          );
        }
      }
      await Promise.all(addressPromises);

      // Mock portfolio analysis
      jest.spyOn(portfolioService, 'getComprehensivePortfolioReport')
        .mockResolvedValue({
          summary: { totalValue: 10000, totalAda: 5000, assetCount: 10 },
          holdings: [],
          performance: { '24h': 0.05 },
          staking: { isStaking: false, rewards: 0 }
        });

      // Generate portfolio report
      await portfolioService.getComprehensivePortfolioReport('user_123');

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete complex workflow within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds

      // Verify all operations completed successfully
      const finalWallet = await walletService.getCurrentWallet();
      expect(finalWallet.accounts).toHaveLength(6); // Initial + 5 created
    });

    it('should maintain performance under concurrent operations', async () => {
      // Setup multiple wallets concurrently
      const walletPromises = Array(10).fill(0).map((_, i) => {
        const mnemonic = WalletKeyManager.generateMnemonic(128);
        return walletService.createWallet({
          mnemonic,
          name: `Concurrent Wallet ${i + 1}`,
          password: `concurrent-password-${i + 1}-123`
        });
      });

      const startTime = Date.now();
      const wallets = await Promise.all(walletPromises);
      const endTime = Date.now();

      // All wallets should be created successfully
      expect(wallets).toHaveLength(10);
      wallets.forEach((wallet, index) => {
        expect(wallet.success).toBe(true);
        expect(wallet.wallet.name).toBe(`Concurrent Wallet ${index + 1}`);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(15000); // 15 seconds
    });
  });
});

