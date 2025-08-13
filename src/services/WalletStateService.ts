import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletAccount } from '../types/wallet';
import { STORAGE_KEYS } from '../constants/index';

export class WalletStateService {
    private static instance: WalletStateService;
    private currentAccount?: WalletAccount;
    private accounts: WalletAccount[] = [];

    static getInstance(): WalletStateService {
        if (!WalletStateService.instance) {
            WalletStateService.instance = new WalletStateService();
        }
        return WalletStateService.instance;
    }

    async initialize(): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS);
            if (raw) {
                const list: WalletAccount[] = JSON.parse(raw);
                this.accounts = list.map(a => ({ ...a, createdAt: new Date(a.createdAt) }));
                this.currentAccount = this.accounts.find(a => a.isActive) || this.accounts[0];
            }
        } catch {}
    }

    getCurrentAddress(): string | undefined {
        return this.currentAccount?.address;
    }

    getCurrentAccount(): WalletAccount | undefined {
        return this.currentAccount;
    }

    async setCurrentAccount(id: string): Promise<void> {
        const found = this.accounts.find(a => a.id === id);
        if (found) {
            this.accounts = this.accounts.map(a => ({ ...a, isActive: a.id === id }));
            this.currentAccount = found;
            await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(this.accounts));
        }
    }

    getAccounts(): WalletAccount[] {
        return [...this.accounts];
    }
}


