import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConfigurationService } from './ConfigurationService';

/**
 * MerchantIdentityService
 * - Resolve merchant public identity keys for BLE verification
 * - Source: configuration mapping or remote resolvers
 */
export class MerchantIdentityService {
    private static instance: MerchantIdentityService;
    private config = ConfigurationService.getInstance();
    private static CACHE_KEY = 'merchant_identity_cache_v1';
    private cache: Record<string, { pubkeyHex: string; updatedAt: number }> = {};

    static getInstance(): MerchantIdentityService {
        if (!MerchantIdentityService.instance) {
            MerchantIdentityService.instance = new MerchantIdentityService();
        }
        return MerchantIdentityService.instance;
    }

    private async loadCache(): Promise<void> {
        try { const raw = await AsyncStorage.getItem(MerchantIdentityService.CACHE_KEY); this.cache = raw ? JSON.parse(raw) : {}; } catch { this.cache = {}; }
    }
    private async saveCache(): Promise<void> {
        try { await AsyncStorage.setItem(MerchantIdentityService.CACHE_KEY, JSON.stringify(this.cache)); } catch {}
    }

    async getMerchantPublicKeyHex(merchantId: string): Promise<string | null> {
        await this.loadCache();
        const cached = this.cache[merchantId];
        if (cached && Date.now() - cached.updatedAt < 24 * 60 * 60 * 1000) return cached.pubkeyHex;

        // 1) Config mapping
        const mapping = this.config.getSetting('merchantIdentityMapping') || {};
        if (mapping[merchantId]) {
            const key = mapping[merchantId];
            this.cache[merchantId] = { pubkeyHex: key, updatedAt: Date.now() };
            await this.saveCache();
            return key;
        }
        // 2) Remote resolvers (if any)
        const nameServiceCfg = this.config.getSetting('nameService') || {};
        const resolvers: string[] = Array.isArray(nameServiceCfg.remoteResolvers) ? nameServiceCfg.remoteResolvers : [];
        for (const endpoint of resolvers) {
            try {
                const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}merchantId=${encodeURIComponent(merchantId)}`;
                const resp = await fetch(url, { method: 'GET' });
                if (!resp.ok) continue;
                const data = await resp.json().catch(() => ({} as any));
                const k = data?.pubkeyHex || data?.data?.pubkeyHex;
                if (typeof k === 'string' && k.length > 0) {
                    this.cache[merchantId] = { pubkeyHex: k, updatedAt: Date.now() };
                    await this.saveCache();
                    return k;
                }
            } catch { /* try next */ }
        }
        return null;
    }
}


