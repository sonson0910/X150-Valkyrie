// Expo config plugin to bundle SSL pinning certificates for iOS and Android
// Usage in app.json:
// {
//   "expo": {
//     "plugins": [["./plugins/with-ssl-pinning-certs", { "certs": ["blockfrost"] }]],
//     "extra": { "sslPinning": { "certs": ["blockfrost"] } }
//   }
// }

const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

const withAndroidCerts = (config, certAliases) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const rawDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'raw');
      ensureDir(rawDir);

      const certsDir = path.join(projectRoot, 'certs');
      for (const alias of certAliases) {
        const src = path.join(certsDir, `${alias}.cer`);
        const dest = path.join(rawDir, `${alias}.cer`);
        copyIfExists(src, dest);
      }

      return config;
    },
  ]);

const withIosCerts = (config, certAliases) => {
  // Copy files
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, 'ios');
      const certsDir = path.join(projectRoot, 'certs');
      for (const alias of certAliases) {
        const src = path.join(certsDir, `${alias}.cer`);
        const dest = path.join(iosDir, `${alias}.cer`);
        copyIfExists(src, dest);
      }
      return config;
    },
  ]);

  // Add to Xcode project resources
  config = withXcodeProject(config, (config) => {
    try {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, 'ios');
      const project = config.modResults;
      const pbxGroupKey = project.findPBXGroupKey({ name: 'Resources' }) || project.getFirstProject().firstProject.mainGroup;
      for (const alias of certAliases) {
        const filePath = path.join(iosDir, `${alias}.cer`);
        if (!fs.existsSync(filePath)) continue;
        const file = project.addResourceFile(`${alias}.cer`, { target: project.getFirstTarget().uuid }, pbxGroupKey);
        if (file) {
          // ensure added to PBXBuildFile
        }
      }
    } catch {}
    return config;
  });

  return config;
};

module.exports = function withSslPinningCerts(config, props = {}) {
  const certAliases = props.certs || (config.expo?.extra?.sslPinning?.certs) || [];
  if (!Array.isArray(certAliases) || certAliases.length === 0) return config;
  config = withAndroidCerts(config, certAliases);
  config = withIosCerts(config, certAliases);
  return config;
};


