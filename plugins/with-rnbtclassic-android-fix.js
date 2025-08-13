// Fix react-native-bluetooth-classic Gradle settings for modern AGP/SDK
// - Enforces compileSdkVersion/targetSdkVersion 35
// - Removes legacy buildToolsVersion 28.0.3 if present
// Usage: add to app.json plugins: ["./plugins/with-rnbtclassic-android-fix"]

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

function patchBluetoothClassicGradle(projectRoot) {
    const gradlePath = path.join(projectRoot, 'node_modules', 'react-native-bluetooth-classic', 'android', 'build.gradle');
    if (!fs.existsSync(gradlePath)) {
        return;
    }
    let content = fs.readFileSync(gradlePath, 'utf8');

    // Force compileSdkVersion 35
    content = content.replace(/compileSdkVersion\s+safeExtGet\('\w+',\s*\d+\)/g, 'compileSdkVersion 35');
    content = content.replace(/compileSdkVersion\s+\d+/g, 'compileSdkVersion 35');

    // Force targetSdkVersion 35
    content = content.replace(/targetSdkVersion\s+safeExtGet\('\w+',\s*\d+\)/g, 'targetSdkVersion 35');
    content = content.replace(/targetSdkVersion\s+\d+/g, 'targetSdkVersion 35');

    // Remove or update buildToolsVersion
    content = content.replace(/buildToolsVersion\s+['"][0-9.]+['"]/g, "// buildToolsVersion removed by with-rnbtclassic-android-fix");

    // Ensure Java 17 compatibility where needed
    if (!/compileOptions\s*\{[\s\S]*?sourceCompatibility/.test(content)) {
        content = content.replace(/android\s*\{/, match => (
            match + "\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }\n"
        ));
    }

    fs.writeFileSync(gradlePath, content);
}

function patchBluetoothClassicSource(projectRoot) {
    const srcPath = path.join(projectRoot, 'node_modules', 'react-native-bluetooth-classic', 'android', 'src', 'main', 'java', 'kjd', 'reactnative', 'bluetooth', 'RNBluetoothClassicModule.java');
    if (!fs.existsSync(srcPath)) return;
    let code = fs.readFileSync(srcPath, 'utf8');
    // Remove hasConstants override which no longer exists in RN 0.79
    const hasConstantsRegex = /\n\s*@Override\s*\n\s*public\s+boolean\s+hasConstants\s*\(\)\s*\{[\s\S]*?return\s+true;[\s\S]*?\}\s*\n/;
    if (hasConstantsRegex.test(code)) {
        code = code.replace(hasConstantsRegex, '\n    // hasConstants() removed for RN 0.79+\n');
        fs.writeFileSync(srcPath, code);
    }
}

module.exports = function withRnbtclassicAndroidFix(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            try {
                patchBluetoothClassicGradle(config.modRequest.projectRoot);
                patchBluetoothClassicSource(config.modRequest.projectRoot);
            } catch (e) {
                console.warn('with-rnbtclassic-android-fix failed:', e?.message || e);
            }
            return config;
        }
    ]);
};


