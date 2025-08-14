// Expo config plugin to add iOS NFC entitlements and usage description
// Adds:
// - Entitlements: com.apple.developer.nfc.readersession.formats = ["NDEF"]
// - InfoPlist: NFCReaderUsageDescription

const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

module.exports = function withIosNfcEntitlements(config, props = {}) {
  config = withEntitlementsPlist(config, (cfg) => {
    const ent = cfg.modResults;
    if (!ent['com.apple.developer.nfc.readersession.formats']) {
      ent['com.apple.developer.nfc.readersession.formats'] = ['NDEF'];
    }
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    if (!plist.NFCReaderUsageDescription) {
      plist.NFCReaderUsageDescription = props.usageDescription || 'This app uses NFC to read secure payment requests.';
    }
    return cfg;
  });

  return config;
};


