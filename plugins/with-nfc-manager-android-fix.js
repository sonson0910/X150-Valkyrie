// Patch react-native-nfc-manager Android source for SDK 33+ where Android Beam APIs
// (NfcAdapter#setNdefPushMessage) are removed. We convert the call to a no-op
// to keep compilation working. This only affects deprecated Beam P2P; tag reading/writing unaffected.

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

function patchNfcManagerSource(projectRoot) {
    const src = path.join(
        projectRoot,
        'node_modules',
        'react-native-nfc-manager',
        'android',
        'src',
        'main',
        'java',
        'community',
        'revteltech',
        'nfc',
        'NfcManager.java'
    );
    if (!fs.existsSync(src)) return;
    let code = fs.readFileSync(src, 'utf8');
    const target = 'nfcAdapter.setNdefPushMessage(msgToPush, currentActivity);';
    if (code.includes(target)) {
        code = code.replace(
            target,
            '// Android Beam removed on modern SDKs; no-op by plugin\n                    try { /* noop */ } catch (Exception __ignored) {}'
        );
        fs.writeFileSync(src, code);
    }
}

module.exports = function withNfcManagerAndroidFix(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            try {
                patchNfcManagerSource(config.modRequest.projectRoot);
            } catch (e) {
                console.warn('with-nfc-manager-android-fix failed:', e?.message || e);
            }
            return config;
        }
    ]);
};


