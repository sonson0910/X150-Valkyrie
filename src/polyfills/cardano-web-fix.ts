// Cardano Web Fix for serialization lib

console.log('Loading Cardano web fix...');

// Fix for Cardano serialization lib Buffer issues
if (typeof window !== 'undefined') {
    // Override problematic Buffer methods
    const originalBuffer = (window as any).Buffer;
    if (originalBuffer) {
        // Fix Buffer.isBuffer
        originalBuffer.isBuffer = function (obj: any) {
            return obj && (obj._isBuffer || obj instanceof originalBuffer);
        };

        // Fix Buffer prototype
        if (originalBuffer.prototype) {
            originalBuffer.prototype._isBuffer = true;
        }
        console.log('Window Buffer methods fixed');
    }

    // Fix MIME type detection
    if ((window as any).navigator && (window as any).navigator.mimeTypes) {
        const mimeTypes = (window as any).navigator.mimeTypes;
        if (mimeTypes.getType) {
            const originalGetType = mimeTypes.getType;
            mimeTypes.getType = function (filename: string) {
                try {
                    return originalGetType.call(this, filename) || 'application/octet-stream';
                } catch {
                    return 'application/octet-stream';
                }
            };
            console.log('MIME types getType fixed');
        }
    }
}

// Fix for global Buffer
if (typeof global !== 'undefined') {
    const globalBuffer = (global as any).Buffer;
    if (globalBuffer) {
        globalBuffer.isBuffer = function (obj: any) {
            return obj && (obj._isBuffer || obj instanceof globalBuffer);
        };

        if (globalBuffer.prototype) {
            globalBuffer.prototype._isBuffer = true;
        }
        console.log('Global Buffer methods fixed');
    }
}

// Fix for Cardano serialization lib specifically
if (typeof window !== 'undefined') {
    // Wait for Cardano lib to load
    setTimeout(() => {
        const cardanoLib = (window as any).cardano_serialization_lib;
        if (cardanoLib) {
            console.log('Cardano serialization lib found, applying specific fixes...');

            // Fix Buffer methods used by Cardano lib
            if (cardanoLib.Buffer) {
                cardanoLib.Buffer.isBuffer = function (obj: any) {
                    return obj && (obj._isBuffer || obj instanceof Buffer);
                };
            }

            // Fix any other problematic methods
            if (cardanoLib.Buffer && cardanoLib.Buffer.prototype) {
                cardanoLib.Buffer.prototype._isBuffer = true;
            }
        }
    }, 1000);
}

// Fix for MIME Buffer error specifically
if (typeof window !== 'undefined') {
    // Override console.error to catch MIME Buffer errors
    const originalConsoleError = console.error;
    console.error = function (...args: any[]) {
        const message = args.join(' ');
        if (message.includes('Could not find MIME for Buffer')) {
            console.warn('MIME Buffer error caught and suppressed:', message);
            return;
        }
        originalConsoleError.apply(console, args);
    };
    console.log('Console error override applied');
}

console.log('Cardano web fix loaded successfully');

export { };
