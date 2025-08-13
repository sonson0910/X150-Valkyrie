import { SecureIdentityService } from '../services/SecureIdentityService';

describe('SecureIdentityService basic', () => {
  it('should generate identity and sign/verify', async () => {
    const id = SecureIdentityService.getInstance();
    await id.initialize();
    const pub = await id.getPublicKeyRaw();
    const msg = new TextEncoder().encode('hello');
    const sig = await id.sign(msg);
    const ok = await id.verify(pub, msg, sig);
    expect(ok).toBe(true);
  });
});

