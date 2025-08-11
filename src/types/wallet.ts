export interface WalletAccount {
    id: string;
    name: string;
    address: string;
    balance: string;
    stakeAddress?: string;
    isActive: boolean;
    createdAt: Date;
}

export interface Transaction {
    id: string;
    hash?: string;
    amount: string;
    fee: string;
    from: string;
    to: string;
    status: TransactionStatus;
    timestamp: Date;
    metadata?: any;
    isOffline?: boolean;
    signedTx?: string; // Signed transaction data for offline transactions
    errorDetails?: string; // Error details if transaction failed
}

export enum TransactionStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    FAILED = 'failed',
    OFFLINE_SIGNED = 'offline_signed',
    QUEUED = 'queued'
}

export interface EncryptedMnemonic {
    encryptedData: string;
    salt: string;
    iv: string;
    fakeMnemonic: string;
    algorithm: string;
    iterations: number;
    keySize: number;
    timestamp: string;
}

export interface WalletState {
    isUnlocked: boolean;
    currentAccount?: WalletAccount;
    accounts: WalletAccount[];
    transactions: Transaction[];
    offlineQueue: Transaction[];
    isOnline: boolean;
}

export interface BiometricConfig {
    enabled: boolean;
    type: 'fingerprint' | 'face' | 'none';
    quickPayEnabled: boolean;
    quickPayLimit: string;
}

export interface BluetoothTransaction {
    id: string;
    signedTx: string;
    metadata: {
        amount: string;
        recipient: string;
        timestamp: Date;
    };
}

export interface WalletConfig {
    network: 'mainnet' | 'testnet';
    biometric: BiometricConfig;
    autoLock: number; // minutes
    cyberpunkTheme: boolean;
}
