/**
 * React hook for error recovery functionality
 */

import { useState, useCallback, useRef } from 'react';
import { ErrorRecoveryService, RecoveryStrategy, FallbackProvider } from '../services/recovery/ErrorRecoveryService';

export interface UseErrorRecoveryResult {
    executeWithRecovery: <T>(
        operation: () => Promise<T>,
        operationId: string,
        strategy?: RecoveryStrategy,
        metadata?: Record<string, any>
    ) => Promise<T>;
    isRecovering: boolean;
    lastError: Error | null;
    recoveryAttempts: number;
    registerFallback: (operationId: string, fallback: FallbackProvider) => void;
    recoveryStatus: any;
}

export function useErrorRecovery(): UseErrorRecoveryResult {
    const [isRecovering, setIsRecovering] = useState(false);
    const [lastError, setLastError] = useState<Error | null>(null);
    const [recoveryAttempts, setRecoveryAttempts] = useState(0);
    const [recoveryStatus, setRecoveryStatus] = useState<any>(null);

    const errorRecoveryService = ErrorRecoveryService.getInstance();
    const operationCounter = useRef(0);

    const executeWithRecovery = useCallback(async <T,>(
        operation: () => Promise<T>,
        operationId: string,
        strategy: RecoveryStrategy = 'retry',
        metadata?: Record<string, any>
    ): Promise<T> => {
        const operationKey = `${operationId}_${++operationCounter.current}`;
        
        setIsRecovering(true);
        setLastError(null);
        setRecoveryAttempts(0);

        try {
            // Wrap operation to track attempts
            const wrappedOperation = async (): Promise<T> => {
                setRecoveryAttempts(prev => prev + 1);
                return await operation();
            };

            const result = await errorRecoveryService.executeWithRecovery(
                wrappedOperation,
                operationKey,
                strategy,
                metadata
            );

            return result;
        } catch (error) {
            setLastError(error as Error);
            throw error;
        } finally {
            setIsRecovering(false);
            setRecoveryStatus(errorRecoveryService.getRecoveryStatus());
        }
    }, []);

    const registerFallback = useCallback((
        operationId: string,
        fallback: FallbackProvider
    ) => {
        errorRecoveryService.registerFallbackProvider(operationId, fallback);
    }, []);

    return {
        executeWithRecovery,
        isRecovering,
        lastError,
        recoveryAttempts,
        registerFallback,
        recoveryStatus
    };
}

export interface UseApiRecoveryResult {
    callApi: <T>(
        apiFunction: () => Promise<T>,
        apiName: string,
        options?: {
            strategy?: RecoveryStrategy;
            enableCache?: boolean;
            cacheTimeout?: number;
        }
    ) => Promise<T>;
    isLoading: boolean;
    error: Error | null;
    retryCount: number;
    lastSuccess: number | null;
}

export function useApiRecovery(baseApiName: string): UseApiRecoveryResult {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [lastSuccess, setLastSuccess] = useState<number | null>(null);

    const { executeWithRecovery, registerFallback } = useErrorRecovery();
    const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

    // Register cache fallback provider
    const registerCacheFallback = useCallback((apiName: string, cacheTimeout: number = 300000) => {
        const fallbackProvider: FallbackProvider = {
            id: `cache_${apiName}`,
            priority: 1,
            canHandle: (error, context) => {
                // Use cache for network errors
                return error.message.includes('network') || 
                       error.message.includes('timeout') ||
                       error.message.includes('fetch');
            },
            execute: async (error, context) => {
                const cached = cacheRef.current.get(apiName);
                if (cached && (Date.now() - cached.timestamp) < cacheTimeout) {
                    return cached.data;
                }
                throw new Error('No valid cache data available');
            },
            isHealthy: async () => true
        };

        registerFallback(apiName, fallbackProvider);
    }, [registerFallback]);

    const callApi = useCallback(async <T,>(
        apiFunction: () => Promise<T>,
        apiName: string,
        options: {
            strategy?: RecoveryStrategy;
            enableCache?: boolean;
            cacheTimeout?: number;
        } = {}
    ): Promise<T> => {
        const {
            strategy = 'retry',
            enableCache = true,
            cacheTimeout = 300000 // 5 minutes
        } = options;

        const fullApiName = `${baseApiName}_${apiName}`;

        // Register cache fallback if enabled
        if (enableCache) {
            registerCacheFallback(fullApiName, cacheTimeout);
        }

        setIsLoading(true);
        setError(null);
        setRetryCount(0);

        try {
            const wrappedApiFunction = async (): Promise<T> => {
                setRetryCount(prev => prev + 1);
                const result = await apiFunction();
                
                // Cache successful result
                if (enableCache) {
                    cacheRef.current.set(fullApiName, {
                        data: result,
                        timestamp: Date.now()
                    });
                }
                
                return result;
            };

            const result = await executeWithRecovery(
                wrappedApiFunction,
                fullApiName,
                strategy,
                { apiName: fullApiName, enableCache }
            );

            setLastSuccess(Date.now());
            return result;
        } catch (err) {
            const error = err as Error;
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [baseApiName, executeWithRecovery, registerCacheFallback]);

    return {
        callApi,
        isLoading,
        error,
        retryCount,
        lastSuccess
    };
}

export interface UseCryptoRecoveryResult {
    executeCryptoOperation: <T>(
        operation: () => Promise<T>,
        operationName: string,
        options?: {
            sensitive?: boolean;
            fallbackToSoftware?: boolean;
        }
    ) => Promise<T>;
    isProcessing: boolean;
    cryptoError: Error | null;
    fallbackUsed: boolean;
}

export function useCryptoRecovery(): UseCryptoRecoveryResult {
    const [isProcessing, setIsProcessing] = useState(false);
    const [cryptoError, setCryptoError] = useState<Error | null>(null);
    const [fallbackUsed, setFallbackUsed] = useState(false);

    const { executeWithRecovery, registerFallback } = useErrorRecovery();

    // Register software crypto fallback
    const registerSoftwareFallback = useCallback((operationName: string) => {
        const fallbackProvider: FallbackProvider = {
            id: `software_crypto_${operationName}`,
            priority: 2,
            canHandle: (error, context) => {
                // Use software fallback for hardware crypto failures
                return error.message.includes('hardware') ||
                       error.message.includes('secure element') ||
                       error.message.includes('keystore');
            },
            execute: async (error, context) => {
                setFallbackUsed(true);
                // This would implement software-based crypto fallback
                throw new Error('Software crypto fallback not implemented');
            },
            isHealthy: async () => true
        };

        registerFallback(operationName, fallbackProvider);
    }, [registerFallback]);

    const executeCryptoOperation = useCallback(async <T,>(
        operation: () => Promise<T>,
        operationName: string,
        options: {
            sensitive?: boolean;
            fallbackToSoftware?: boolean;
        } = {}
    ): Promise<T> => {
        const { sensitive = true, fallbackToSoftware = true } = options;

        // Register software fallback if enabled
        if (fallbackToSoftware) {
            registerSoftwareFallback(operationName);
        }

        setIsProcessing(true);
        setCryptoError(null);
        setFallbackUsed(false);

        try {
            const result = await executeWithRecovery(
                operation,
                operationName,
                fallbackToSoftware ? 'fallback' : 'retry',
                { sensitive, operationName }
            );

            return result;
        } catch (error) {
            setCryptoError(error as Error);
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [executeWithRecovery, registerSoftwareFallback]);

    return {
        executeCryptoOperation,
        isProcessing,
        cryptoError,
        fallbackUsed
    };
}

export interface UseTransactionRecoveryResult {
    submitTransaction: (
        transactionData: any,
        options?: {
            priority?: 'low' | 'medium' | 'high';
            maxWaitTime?: number;
        }
    ) => Promise<any>;
    isSubmitting: boolean;
    submissionError: Error | null;
    queuePosition: number | null;
    estimatedConfirmationTime: number | null;
}

export function useTransactionRecovery(): UseTransactionRecoveryResult {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<Error | null>(null);
    const [queuePosition, setQueuePosition] = useState<number | null>(null);
    const [estimatedConfirmationTime, setEstimatedConfirmationTime] = useState<number | null>(null);

    const { executeWithRecovery, registerFallback } = useErrorRecovery();

    // Register transaction queue fallback
    const registerQueueFallback = useCallback(() => {
        const fallbackProvider: FallbackProvider = {
            id: 'transaction_queue',
            priority: 1,
            canHandle: (error, context) => {
                return error.message.includes('network') ||
                       error.message.includes('congestion') ||
                       error.message.includes('fee too low');
            },
            execute: async (error, context) => {
                // Queue transaction for later submission
                setQueuePosition(1); // Simplified queue position
                setEstimatedConfirmationTime(Date.now() + 300000); // 5 minutes estimate
                
                return {
                    queued: true,
                    position: 1,
                    estimatedTime: 300000
                };
            },
            isHealthy: async () => true
        };

        registerFallback('transaction_submission', fallbackProvider);
    }, [registerFallback]);

    const submitTransaction = useCallback(async (
        transactionData: any,
        options: {
            priority?: 'low' | 'medium' | 'high';
            maxWaitTime?: number;
        } = {}
    ): Promise<any> => {
        const { priority = 'medium', maxWaitTime = 120000 } = options;

        // Register queue fallback
        registerQueueFallback();

        setIsSubmitting(true);
        setSubmissionError(null);
        setQueuePosition(null);
        setEstimatedConfirmationTime(null);

        try {
            const submissionOperation = async () => {
                // This would implement actual transaction submission
                // For now, simulate the operation
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { txHash: 'mock_tx_hash', status: 'submitted' };
            };

            const result = await executeWithRecovery(
                submissionOperation,
                'transaction_submission',
                'fallback',
                { priority, maxWaitTime, transactionData }
            );

            return result;
        } catch (error) {
            setSubmissionError(error as Error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    }, [executeWithRecovery, registerQueueFallback]);

    return {
        submitTransaction,
        isSubmitting,
        submissionError,
        queuePosition,
        estimatedConfirmationTime
    };
}

export default useErrorRecovery;

