import { ConfigurationService } from './ConfigurationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CardanoAPIService } from './CardanoAPIService';

/**
 * AddressResolverService
 * - Resolve human-readable names to Cardano bech32 addresses
 * - Supports ADA Handle-like syntax: $handle via local config mapping for now
 */
export class AddressResolverService {
    private static instance: AddressResolverService;
    private config = ConfigurationService.getInstance();
    private cache: Record<string, { address: string; updatedAt: number }> = {};
    private static CACHE_KEY = 'address_resolver_cache_v1';
    private static CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

    static getInstance(): AddressResolverService {
        if (!AddressResolverService.instance) {
            AddressResolverService.instance = new AddressResolverService();
        }
        return AddressResolverService.instance;
    }

    private async loadCache(): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(AddressResolverService.CACHE_KEY);
            this.cache = raw ? JSON.parse(raw) : {};
        } catch {
            this.cache = {};
        }
    }

    private async saveCache(): Promise<void> {
        try {
            await AsyncStorage.setItem(AddressResolverService.CACHE_KEY, JSON.stringify(this.cache));
        } catch { }
    }

    async clearCache(): Promise<void> {
        try {
            this.cache = {};
            await AsyncStorage.removeItem(AddressResolverService.CACHE_KEY);
        } catch { }
    }

    private toHexAscii(input: string): string {
        return Array.from(input)
            .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
            .join('');
    }

    async resolve(input: string, opts?: { network?: 'mainnet' | 'testnet'; skipCache?: boolean }): Promise<{ address: string; source: 'raw' | 'handle' | 'mapping' | 'remote' | 'blockfrost' }> {
        const trimmed = input.trim();
        if (trimmed.startsWith('addr1')) {
            return { address: trimmed, source: 'raw' };
        }
        if (trimmed.startsWith('$')) {
            const name = trimmed.slice(1).toLowerCase();
            // Local mapping from config: security/nameService or network/nameService
            const mapping = (this.config.getSetting('nameService')?.mapping) || {};
            const resolved = mapping[name];
            if (resolved && typeof resolved === 'string') {
                return { address: resolved, source: 'mapping' };
            }
            // Cache
            if (!opts?.skipCache) {
                await this.loadCache();
                const cached = this.cache[name];
                if (cached && Date.now() - cached.updatedAt < AddressResolverService.CACHE_TTL_MS) {
                    return { address: cached.address, source: 'remote' };
                }
            }
            // Remote resolvers from config
            const nameServiceCfg = this.config.getSetting('nameService') || {};
            const resolvers: string[] = Array.isArray(nameServiceCfg.remoteResolvers) ? nameServiceCfg.remoteResolvers : [];
            const network = opts?.network || 'mainnet';
            for (const endpoint of resolvers) {
                try {
                    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}handle=${encodeURIComponent(name)}&network=${network}`;
                    const resp = await fetch(url, { method: 'GET' });
                    if (!resp.ok) continue;
                    const data = await resp.json().catch(() => ({} as any));
                    const candidate = data?.address || data?.result?.address || data?.data?.address;
                    if (typeof candidate === 'string' && candidate.startsWith('addr1')) {
                        this.cache[name] = { address: candidate, updatedAt: Date.now() };
                        await this.saveCache();
                        return { address: candidate, source: 'remote' };
                    }
                } catch { /* try next */ }
                await new Promise(r => setTimeout(r, 100));
            }
            // Blockfrost policy-based resolution (ADA Handle-like)
            try {
                const adaHandleCfg = nameServiceCfg.adaHandle || {};
                if (adaHandleCfg.enabled && typeof adaHandleCfg.policyId === 'string' && adaHandleCfg.policyId.length === 56) {
                    const policyId: string = adaHandleCfg.policyId;
                    const assetId = `${policyId}${this.toHexAscii(name)}`;
                    const api = CardanoAPIService.getInstance();
                    api.setNetwork(network);
                    const holders = await api.getAssetAddresses(assetId);
                    const addr = Array.isArray(holders) && holders[0]?.address;
                    if (typeof addr === 'string' && addr.startsWith('addr1')) {
                        this.cache[name] = { address: addr, updatedAt: Date.now() };
                        await this.saveCache();
                        return { address: addr, source: 'blockfrost' };
                    }
                }
            } catch { /* ignore */ }
            // Fallback: return input unchanged (UI should validate)
            return { address: trimmed, source: 'handle' };
        }
        return { address: trimmed, source: 'raw' };
    }
}


