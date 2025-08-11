import { AddressResolverService } from '../services/AddressResolverService';
import { ConfigurationService } from '../services/ConfigurationService';

describe('AddressResolverService', () => {
    it('returns raw address as-is', async () => {
        const svc = AddressResolverService.getInstance();
        const res = await svc.resolve('addr1qxy');
        expect(res.source).toBe('raw');
    });

    it('falls back to handle source when cannot resolve', async () => {
        const svc = AddressResolverService.getInstance();
        const res = await svc.resolve('$nonexistent', { skipCache: true });
        expect(res.source).toBe('handle');
    });

    it('resolves using local mapping', async () => {
        const cfg = ConfigurationService.getInstance();
        cfg.setSetting('nameService', { mapping: { bob: 'addr1qtestaddress' } });
        const svc = AddressResolverService.getInstance();
        await svc.clearCache();
        const res = await svc.resolve('$bob', { skipCache: true });
        expect(res.address).toBe('addr1qtestaddress');
        expect(res.source).toBe('mapping');
    });

    it('resolves via remote resolver (mocked fetch)', async () => {
        const cfg = ConfigurationService.getInstance();
        cfg.setSetting('nameService', { mapping: {}, remoteResolvers: ['https://resolver.test/lookup'] });
        const svc = AddressResolverService.getInstance();
        await svc.clearCache();
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ address: 'addr1qremoteresolved' }) });
        const res = await svc.resolve('$alice', { skipCache: true, network: 'testnet' });
        expect(res.address).toBe('addr1qremoteresolved');
        expect(res.source).toBe('remote');
    });
});


