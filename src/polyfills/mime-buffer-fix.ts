// MIME Buffer fix for Cardano serialization lib

console.log('Loading MIME Buffer fix...');

try {
    // Fix Buffer MIME type issues
    if (typeof global !== 'undefined') {
        (global as any).Buffer = require('buffer').Buffer;
        console.log('Global Buffer polyfill applied');
    }

    // Override MIME type detection
    const originalGetType = (global as any).Buffer?.isBuffer;
    if (originalGetType) {
        (global as any).Buffer.isBuffer = function (obj: any) {
            return obj && obj._isBuffer;
        };
        console.log('Buffer.isBuffer polyfill applied');
    }

    // Fix for Cardano serialization lib Buffer issues
    if (typeof window !== 'undefined') {
        (window as any).Buffer = require('buffer').Buffer;

        // Override problematic MIME detection
        const originalBuffer = (window as any).Buffer;
        if (originalBuffer) {
            (window as any).Buffer.prototype._isBuffer = true;
            console.log('Window Buffer prototype polyfill applied');
        }
    }

    // Fix MIME type detection globally
    if (typeof window !== 'undefined') {
        // Override MIME type detection
        const originalMimeType = (window as any).navigator?.mimeTypes;
        if (originalMimeType) {
            (window as any).navigator.mimeTypes = new Proxy(originalMimeType, {
                get: function (target, prop) {
                    if (prop === 'getType') {
                        return function () {
                            return 'application/octet-stream';
                        };
                    }
                    return target[prop];
                }
            });
            console.log('MIME types polyfill applied');
        }
    }

    // Fix Buffer constructor
    if (typeof Buffer !== 'undefined') {
        const OriginalBuffer = Buffer;
        (global as any).Buffer = function () {
            const buffer = new (OriginalBuffer as any)(...(arguments as any));
            (buffer as any)._isBuffer = true;
            return buffer;
        };

        // Copy static methods
        Object.setPrototypeOf((global as any).Buffer, OriginalBuffer);
        Object.setPrototypeOf((global as any).Buffer.prototype, OriginalBuffer.prototype);

        // Copy static properties
        Object.getOwnPropertyNames(OriginalBuffer).forEach(name => {
            if (name !== 'prototype' && name !== 'length' && name !== 'name') {
                (global as any).Buffer[name] = (OriginalBuffer as any)[name];
            }
        });
        console.log('Buffer constructor polyfill applied');
    }

    // Fix for Cardano serialization lib specifically
    if (typeof window !== 'undefined') {
        // Override problematic methods
        const cardanoLib = (window as any).cardano_serialization_lib;
        if (cardanoLib) {
            console.log('Cardano serialization lib found, applying fixes...');

            // Fix Buffer methods used by Cardano lib
            if (cardanoLib.Buffer) {
                cardanoLib.Buffer.isBuffer = function (obj: any) {
                    return obj && (obj._isBuffer || obj instanceof Buffer);
                };
            }
        }
    }

    // Không override console.error để tránh che giấu lỗi thực tế

    console.log('MIME Buffer fix loaded successfully');
} catch (error) {
    console.warn('MIME Buffer fix failed to load:', error);
    // Continue anyway
}

export { };
