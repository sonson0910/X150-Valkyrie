import { OfflineTransactionService } from '../services/OfflineTransactionService';

describe('OfflineTransactionService basic behavior', () => {
  it('should initialize and expose empty queue', async () => {
    const svc = OfflineTransactionService.getInstance();
    const ok = await svc.initialize();
    expect(ok).toBe(true);
    expect(Array.isArray(svc.getOfflineQueue())).toBe(true);
  });
});

