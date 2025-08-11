import { GuardianRecoveryService } from '../services/GuardianRecoveryService';

describe('GuardianRecoveryService', () => {
    it('starts a recovery request', async () => {
        const svc = GuardianRecoveryService.getInstance();
        const req = await svc.startRecovery('user');
        expect(req.id).toBeTruthy();
        const active = await svc.getActiveRecovery();
        expect(active?.id).toBe(req.id);
    });
});


