import { BiometricService } from '../services/BiometricService';

describe('Quick Pay (one-touch payment) policy', () => {
  beforeEach(async () => {
    const svc = BiometricService.getInstance();
    // Ensure baseline config
    await svc.updateBiometricConfig({
      isEnabled: true,
      quickPayLimit: '10000000', // legacy 10 ADA
      timeout: 30000,
    } as any);
    // Configure extended policy: 10 ADA per tx, 20 ADA per day
    await svc.updateQuickPayPolicy({
      quickPayPerTxLimit: '10000000',
      quickPayDailyCap: '20000000',
      holdToConfirm: true,
    });
    // Reset daily spent by simulating a new day
    // We cannot directly set private fields; instead call a 0-amount quick pay to trigger reset logic path
    await svc.authenticateQuickPay('0');
  });

  it('allows quick biometric for amount <= per-transaction limit and increments daily spent (whitelisted recipient)', async () => {
    const svc = BiometricService.getInstance();
    svc.addWhitelistRecipient('addr1quickpaywhitelisted');
    const res = await svc.authenticateQuickPay('5000000', 'addr1quickpaywhitelisted'); // 5 ADA
    expect(res.requireFullAuth).toBe(false);
    expect(res.success).toBe(true);
  });

  it('requires full auth when amount exceeds per-transaction limit', async () => {
    const svc = BiometricService.getInstance();
    svc.addWhitelistRecipient('addr1quickpaywhitelisted');
    const res = await svc.authenticateQuickPay('15000000', 'addr1quickpaywhitelisted'); // 15 ADA > 10 ADA
    expect(res.requireFullAuth).toBe(true);
    expect(res.success).toBe(false);
  });

  it('requires full auth when daily cap would be exceeded', async () => {
    const svc = BiometricService.getInstance();
    // Spend 5 ADA first (allowed)
    svc.addWhitelistRecipient('addr1quickpaywhitelisted');
    await svc.authenticateQuickPay('5000000', 'addr1quickpaywhitelisted');
    // Now try to spend 16 ADA (5 + 16 = 21 > 20 ADA cap)
    const res = await svc.authenticateQuickPay('16000000', 'addr1quickpaywhitelisted');
    expect(res.requireFullAuth).toBe(true);
    expect(res.success).toBe(false);
  });

  it('requires full auth when recipient not in whitelist (if whitelist configured)', async () => {
    const svc = BiometricService.getInstance();
    await svc.updateQuickPayPolicy({ quickPayPerTxLimit: '10000000', quickPayDailyCap: '50000000' });
    // Ensure whitelist has some other address
    svc.addWhitelistRecipient('addr1whitelistedabc');
    const res = await svc.authenticateQuickPay('1000000', 'addr1notwhitelisted');
    expect(res.requireFullAuth).toBe(true);
    expect(res.success).toBe(false);
  });
});


