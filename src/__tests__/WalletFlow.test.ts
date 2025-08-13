import { CardanoWalletService } from '../services/CardanoWalletService';
import { MnemonicTransformService } from '../services/MnemonicTransformService';

describe('Wallet end-to-end flow (basic)', () => {
  it('should generate, transform, restore mnemonic and init wallet', async () => {
    const mnemonic = CardanoWalletService.generateMnemonic(256);
    const password = 'P@ssw0rd!1234';
    const transformed = await MnemonicTransformService.transformMnemonic(mnemonic, password);
    expect(transformed.split(' ').length).toBe(36);

    const restored = await MnemonicTransformService.restoreOriginalMnemonic(transformed, password);
    expect(restored).toBe(mnemonic);

    const wallet = CardanoWalletService.getInstance('testnet');
    const ok = await wallet.initializeFromMnemonic(restored);
    expect(ok).toBe(true);

    const account = await wallet.createAccount(0, 'Test');
    expect(account.address).toMatch(/^addr1/);
    expect(account.stakeAddress).toBeDefined();
  });
});

