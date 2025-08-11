import { ErrorHandler, ErrorType, ErrorSeverity, AppError } from '../services/ErrorHandler';

describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;

    beforeEach(() => {
        errorHandler = ErrorHandler.getInstance();
        // Clear error log before each test
        errorHandler.clearErrorLog();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = ErrorHandler.getInstance();
            const instance2 = ErrorHandler.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('Error Handling', () => {
        it('should handle string errors', () => {
            const errorMessage = 'Test error message';
            errorHandler.handleError(errorMessage, 'test-context', ErrorSeverity.MEDIUM, ErrorType.NETWORK);

            const errorLog = errorHandler.getErrorLog();
            expect(errorLog).toHaveLength(1);
            expect(errorLog[0].message).toBe(errorMessage);
            expect(errorLog[0].type).toBe(ErrorType.NETWORK);
            expect(errorLog[0].severity).toBe(ErrorSeverity.MEDIUM);
        });

        it('should handle Error objects', () => {
            const error = new Error('Test error');
            errorHandler.handleError(error, 'test-context', ErrorSeverity.HIGH, ErrorType.AUTHENTICATION);

            const errorLog = errorHandler.getErrorLog();
            expect(errorLog).toHaveLength(1);
            expect(errorLog[0].message).toBe('Test error');
            expect(errorLog[0].type).toBe(ErrorType.AUTHENTICATION);
            expect(errorLog[0].severity).toBe(ErrorSeverity.HIGH);
        });

        it('should handle errors with code property', () => {
            const error = { message: 'Test error', code: 'TEST_001' } as Error;
            errorHandler.handleError(error, 'test-context');

            const errorLog = errorHandler.getErrorLog();
            expect(errorLog).toHaveLength(1);
            expect(errorLog[0].code).toBe('TEST_001');
        });
    });

    describe('Error Log Management', () => {
        it('should maintain error log size limit', () => {
            // Add more than 100 errors
            for (let i = 0; i < 105; i++) {
                errorHandler.handleError(`Error ${i}`, 'test');
            }

            const errorLog = errorHandler.getErrorLog();
            expect(errorLog).toHaveLength(100);
            expect(errorLog[0].message).toBe('Error 5'); // Should keep last 100
        });

        it('should clear error log', () => {
            errorHandler.handleError('Test error', 'test');
            expect(errorHandler.getErrorLog()).toHaveLength(1);

            errorHandler.clearErrorLog();
            expect(errorHandler.getErrorLog()).toHaveLength(0);
        });
    });

    describe('Static Error Creators', () => {
        it('should create network errors', () => {
            const networkError = ErrorHandler.createNetworkError('Network failed', { status: 500 });

            expect(networkError.type).toBe(ErrorType.NETWORK);
            expect(networkError.severity).toBe(ErrorSeverity.MEDIUM);
            expect(networkError.message).toBe('Network failed');
            expect(networkError.details).toEqual({ status: 500 });
        });

        it('should create authentication errors', () => {
            const authError = ErrorHandler.createAuthError('Invalid credentials');

            expect(authError.type).toBe(ErrorType.AUTHENTICATION);
            expect(authError.severity).toBe(ErrorSeverity.HIGH);
            expect(authError.message).toBe('Invalid credentials');
        });

        it('should create transaction errors', () => {
            const txError = ErrorHandler.createTransactionError('Insufficient balance');

            expect(txError.type).toBe(ErrorType.TRANSACTION);
            expect(txError.severity).toBe(ErrorSeverity.HIGH);
            expect(txError.message).toBe('Insufficient balance');
        });

        it('should create crypto errors', () => {
            const cryptoError = ErrorHandler.createCryptoError('Encryption failed');

            expect(cryptoError.type).toBe(ErrorType.CRYPTO);
            expect(cryptoError.severity).toBe(ErrorSeverity.CRITICAL);
            expect(cryptoError.message).toBe('Encryption failed');
        });
    });

    describe('Error Properties', () => {
        it('should set timestamp correctly', () => {
            const before = new Date();
            errorHandler.handleError('Test error');
            const after = new Date();

            const errorLog = errorHandler.getErrorLog();
            const error = errorLog[0];

            expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('should set context correctly', () => {
            const context = 'test-context';
            errorHandler.handleError('Test error', context);

            const errorLog = errorHandler.getErrorLog();
            expect(errorLog[0].context).toBe(context);
        });
    });
});
