export type RootStackParamList = {
    Welcome: undefined;
    SetupWallet: undefined;
    WalletHome: undefined;
    SendTransaction: {
        recipientAddress?: string;
        amount?: string;
    };
    ReceiveScreen: undefined;
    OfflineTransaction: undefined;
    BackupWallet: undefined;
    RestoreWallet: undefined;
    TransactionHistory: undefined;
    Settings: undefined;
    GuardianRecovery: undefined;
    NameServiceManager: undefined;
    MultiSignature: undefined;
    NFTGallery: undefined;
    DeFiStaking: undefined;
    PortfolioAnalytics: undefined;
    SubmitResult: {
        txHash: string;
        network: 'mainnet' | 'testnet';
    };
    CreateMultiSigTransaction: {
        walletId: string;
    };
    SignMultiSigTransaction: {
        transactionId: string;
    };
};
