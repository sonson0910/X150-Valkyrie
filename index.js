import { registerRootComponent } from 'expo';
import * as ExpoCrypto from 'expo-crypto';

// Native polyfills should be set before loading the app module
try {
  if (typeof globalThis.Buffer === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    globalThis.Buffer = require('buffer').Buffer;
  }
  if (!globalThis.crypto) {
    globalThis.crypto = {};
  }
  if (typeof globalThis.crypto.getRandomValues !== 'function') {
    globalThis.crypto.getRandomValues = (typedArray) => {
      const bytes = ExpoCrypto.getRandomBytes(typedArray.length);
      typedArray.set(bytes);
      return typedArray;
    };
  }
} catch {}

const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
