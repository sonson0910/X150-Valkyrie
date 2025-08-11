// Web polyfills for Cardano wallet compatibility

console.log('Loading web polyfills...');

try {
    // Buffer polyfill
    if (typeof global === 'undefined') {
        (window as any).global = window;
        console.log('Global polyfill applied');
    }

    if (typeof Buffer === 'undefined') {
        (window as any).Buffer = require('buffer').Buffer;
        console.log('Buffer polyfill applied');
    }

    // MIME type polyfill
    if (typeof process === 'undefined') {
        (window as any).process = require('process/browser');
        console.log('Process polyfill applied');
    }

    // Crypto polyfill
    if (typeof crypto === 'undefined') {
        (window as any).crypto = require('crypto-browserify');
        console.log('Crypto polyfill applied');
    }

    // Stream polyfill
    if (typeof (window as any).stream === 'undefined') {
        (window as any).stream = require('stream-browserify');
        console.log('Stream polyfill applied');
    }

    // Util polyfill
    if (typeof (window as any).util === 'undefined') {
        (window as any).util = require('util');
        console.log('Util polyfill applied');
    }

    // Fix for Cardano serialization lib
    if (typeof WebAssembly === 'undefined') {
        console.warn('WebAssembly not supported');
    } else {
        console.log('WebAssembly supported');
    }

    console.log('Web polyfills loaded successfully');
} catch (error) {
    console.warn('Some polyfills failed to load:', error);
    // Continue anyway
}

// Export for use in other files
export { };
