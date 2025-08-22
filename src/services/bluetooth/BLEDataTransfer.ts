import logger from '../../utils/Logger';
import { BLUETOOTH_CONSTANTS } from '../../constants/index';
import { SecureTransferService } from '../SecureTransferService';
import { BLEDevice } from './BLEDeviceManager';

export interface TransferSession {
    sessionId: string;
    deviceId: string;
    totalFrames: number;
    completedFrames: number;
    frames: Map<number, string>;
    sharedKey: Uint8Array;
    isComplete: boolean;
    createdAt: Date;
    lastActivity: Date;
}

export interface TransferFrame {
    sessionId: string;
    frameIndex: number;
    totalFrames: number;
    data: string;
    checksum: string;
}

/**
 * BLEDataTransfer - Manages BLE data transfer protocol with frames, sessions, and ACK mechanism
 * 
 * Responsibilities:
 * - Frame-based data transfer protocol
 * - Session management for large data transfers
 * - ACK/NACK mechanism with retry logic
 * - Data encryption and integrity verification
 * - Transfer progress tracking
 * - Timeout and error handling
 */
export class BLEDataTransfer {
    private static instance: BLEDataTransfer;
    private secureService: SecureTransferService;
    private activeSessions: Map<string, TransferSession> = new Map();
    private ackWaiters: Map<string, Map<number, {
        resolve: () => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }>> = new Map();
    private incomingSessions: Map<string, {
        total: number;
        frames: Map<number, string>;
        sharedKey: Uint8Array;
        lastActivity: Date;
    }> = new Map();

    private constructor() {
        this.secureService = SecureTransferService.getInstance();
        
        // Cleanup stale sessions every 5 minutes
        setInterval(() => {
            this.cleanupStaleSessions();
        }, 5 * 60 * 1000);
    }

    public static getInstance(): BLEDataTransfer {
        if (!BLEDataTransfer.instance) {
            BLEDataTransfer.instance = new BLEDataTransfer();
        }
        return BLEDataTransfer.instance;
    }

    /**
     * Send data to device using frame-based protocol
     * @param device - Target BLE device
     * @param data - Data to send (will be encrypted)
     * @param sharedKey - Shared encryption key
     * @param sessionId - Session identifier
     * @returns Success status
     */
    async sendData(
        device: BLEDevice,
        data: Uint8Array,
        sharedKey: Uint8Array,
        sessionId: string
    ): Promise<boolean> {
        try {
            logger.debug('Starting data transfer', 'BLEDataTransfer.sendData', {
                sessionId,
                dataLength: data.length
            });

            // Build encrypted frames
            const frames = await this.secureService.buildFrames(
                sessionId,
                data,
                sharedKey,
                true // Enable encryption
            );

            if (!frames || frames.length === 0) {
                throw new Error('Failed to build frames');
            }

            // Create transfer session
            const session: TransferSession = {
                sessionId,
                deviceId: '', // Will be set based on device
                totalFrames: frames.length,
                completedFrames: 0,
                frames: new Map(),
                sharedKey,
                isComplete: false,
                createdAt: new Date(),
                lastActivity: new Date()
            };

            // Store frames in session
            frames.forEach((frame, index) => {
                session.frames.set(index, frame);
            });

            this.activeSessions.set(sessionId, session);

            // Send frames with ACK mechanism
            const success = await this.sendFramesWithAck(device, sessionId, frames);

            if (success) {
                session.isComplete = true;
                session.completedFrames = frames.length;
                logger.info('Data transfer completed successfully', 'BLEDataTransfer.sendData', {
                    sessionId,
                    frameCount: frames.length
                });
            } else {
                logger.error('Data transfer failed', 'BLEDataTransfer.sendData', { sessionId });
            }

            return success;

        } catch (error) {
            logger.error('Failed to send data', 'BLEDataTransfer.sendData', {
                sessionId,
                error
            });
            return false;
        }
    }

    /**
     * Receive and reassemble data from frames
     * @param frame - Received frame data
     * @param sharedKey - Shared decryption key
     * @returns Reassembled data if transfer is complete, null otherwise
     */
    async receiveFrame(frame: string, sharedKey: Uint8Array): Promise<Uint8Array | null> {
        try {
            // Parse frame header to get session info
            const frameData = JSON.parse(frame);
            const sessionId = frameData.sessionId;
            const frameIndex = frameData.index;
            const totalFrames = frameData.total;

            logger.debug('Received frame', 'BLEDataTransfer.receiveFrame', {
                sessionId,
                frameIndex,
                totalFrames
            });

            // Initialize or update incoming session
            if (!this.incomingSessions.has(sessionId)) {
                this.incomingSessions.set(sessionId, {
                    total: totalFrames,
                    frames: new Map(),
                    sharedKey,
                    lastActivity: new Date()
                });
            }

            const session = this.incomingSessions.get(sessionId)!;
            session.frames.set(frameIndex, frame);
            session.lastActivity = new Date();

            // Send ACK for received frame
            await this.sendAck(sessionId, frameIndex);

            // Check if all frames received
            if (session.frames.size === session.total) {
                logger.debug('All frames received, reassembling data', 'BLEDataTransfer.receiveFrame', {
                    sessionId,
                    frameCount: session.total
                });

                // Reassemble frames in order
                const orderedFrames: string[] = [];
                for (let i = 0; i < session.total; i++) {
                    const frameData = session.frames.get(i);
                    if (!frameData) {
                        throw new Error(`Missing frame ${i} in session ${sessionId}`);
                    }
                    orderedFrames.push(frameData);
                }

                // Decrypt and verify data
                const reassembledData = await this.secureService.parseFrames(
                    orderedFrames,
                    session.sharedKey,
                    true // Verify encryption
                );

                // Cleanup session
                this.incomingSessions.delete(sessionId);

                logger.info('Data transfer received and verified', 'BLEDataTransfer.receiveFrame', {
                    sessionId,
                    dataLength: reassembledData.length
                });

                return reassembledData;
            }

            return null; // Transfer not complete yet

        } catch (error) {
            logger.error('Failed to receive frame', 'BLEDataTransfer.receiveFrame', error);
            return null;
        }
    }

    /**
     * Send ACK for received frame
     * @param sessionId - Session identifier
     * @param frameIndex - Frame index to acknowledge
     */
    async sendAck(sessionId: string, frameIndex: number): Promise<void> {
        try {
            const ackMessage = JSON.stringify({
                type: 'ACK',
                sessionId,
                frameIndex,
                timestamp: Date.now()
            });

            logger.debug('Sending ACK', 'BLEDataTransfer.sendAck', {
                sessionId,
                frameIndex
            });

            // In real implementation, this would send ACK via BLE characteristic
            // For now, we simulate ACK processing
            setTimeout(() => {
                this.onAckReceived(sessionId, frameIndex);
            }, 10);

        } catch (error) {
            logger.error('Failed to send ACK', 'BLEDataTransfer.sendAck', {
                sessionId,
                frameIndex,
                error
            });
        }
    }

    /**
     * Handle received ACK
     * @param sessionId - Session identifier
     * @param frameIndex - Frame index that was acknowledged
     */
    onAckReceived(sessionId: string, frameIndex: number): void {
        const sessionWaiters = this.ackWaiters.get(sessionId);
        if (!sessionWaiters) return;

        const waiter = sessionWaiters.get(frameIndex);
        if (waiter) {
            clearTimeout(waiter.timeout);
            waiter.resolve();
            sessionWaiters.delete(frameIndex);

            logger.debug('ACK received and processed', 'BLEDataTransfer.onAckReceived', {
                sessionId,
                frameIndex
            });

            // Update session progress
            const session = this.activeSessions.get(sessionId);
            if (session) {
                session.completedFrames++;
                session.lastActivity = new Date();
            }
        }
    }

    /**
     * Get transfer progress for a session
     * @param sessionId - Session identifier
     * @returns Transfer progress information
     */
    getTransferProgress(sessionId: string): {
        totalFrames: number;
        completedFrames: number;
        progressPercentage: number;
        isComplete: boolean;
    } | null {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return null;
        }

        const progressPercentage = session.totalFrames > 0 
            ? (session.completedFrames / session.totalFrames) * 100 
            : 0;

        return {
            totalFrames: session.totalFrames,
            completedFrames: session.completedFrames,
            progressPercentage: Math.round(progressPercentage),
            isComplete: session.isComplete
        };
    }

    /**
     * Cancel an active transfer session
     * @param sessionId - Session identifier
     * @returns Success status
     */
    async cancelTransfer(sessionId: string): Promise<boolean> {
        try {
            // Cancel any pending ACK waiters
            const sessionWaiters = this.ackWaiters.get(sessionId);
            if (sessionWaiters) {
                for (const waiter of sessionWaiters.values()) {
                    clearTimeout(waiter.timeout);
                    waiter.reject(new Error('Transfer cancelled'));
                }
                this.ackWaiters.delete(sessionId);
            }

            // Remove active session
            this.activeSessions.delete(sessionId);
            this.incomingSessions.delete(sessionId);

            logger.info('Transfer session cancelled', 'BLEDataTransfer.cancelTransfer', { sessionId });
            return true;

        } catch (error) {
            logger.error('Failed to cancel transfer', 'BLEDataTransfer.cancelTransfer', {
                sessionId,
                error
            });
            return false;
        }
    }

    /**
     * Get all active transfer sessions
     * @returns Array of active session information
     */
    getActiveSessions(): Array<{
        sessionId: string;
        totalFrames: number;
        completedFrames: number;
        progressPercentage: number;
        isComplete: boolean;
        age: number; // Age in seconds
    }> {
        const now = new Date();
        
        return Array.from(this.activeSessions.values()).map(session => {
            const progressPercentage = session.totalFrames > 0 
                ? (session.completedFrames / session.totalFrames) * 100 
                : 0;
            
            const age = Math.floor((now.getTime() - session.createdAt.getTime()) / 1000);

            return {
                sessionId: session.sessionId,
                totalFrames: session.totalFrames,
                completedFrames: session.completedFrames,
                progressPercentage: Math.round(progressPercentage),
                isComplete: session.isComplete,
                age
            };
        });
    }

    /**
     * Cleanup data transfer manager
     */
    async cleanup(): Promise<void> {
        try {
            // Cancel all pending ACK waiters
            for (const [sessionId, sessionWaiters] of this.ackWaiters.entries()) {
                for (const waiter of sessionWaiters.values()) {
                    clearTimeout(waiter.timeout);
                    waiter.reject(new Error('Data transfer cleanup'));
                }
            }

            // Clear all sessions
            this.ackWaiters.clear();
            this.activeSessions.clear();
            this.incomingSessions.clear();

            logger.info('BLE data transfer manager cleaned up', 'BLEDataTransfer.cleanup');

        } catch (error) {
            logger.error('Failed to cleanup BLE data transfer manager', 'BLEDataTransfer.cleanup', error);
        }
    }

    // Private helper methods

    /**
     * Send frames with ACK mechanism and retry logic
     */
    private async sendFramesWithAck(device: BLEDevice, sessionId: string, frames: string[]): Promise<boolean> {
        try {
            logger.debug('Sending frames with ACK mechanism', 'BLEDataTransfer.sendFramesWithAck', {
                sessionId,
                frameCount: frames.length
            });

            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                let attempts = 0;
                
                while (attempts <= BLUETOOTH_CONSTANTS.RESEND_LIMIT) {
                    try {
                        // Send frame
                        const frameData = new TextEncoder().encode(frame);
                        await device.writeCharacteristicWithResponseForService(
                            BLUETOOTH_CONSTANTS.SERVICE_UUID,
                            BLUETOOTH_CONSTANTS.TX_CHARACTERISTIC_UUID,
                            frameData
                        );

                        // Wait for ACK
                        await this.waitForAck(sessionId, i);
                        
                        logger.debug('Frame sent and acknowledged', 'BLEDataTransfer.sendFramesWithAck', {
                            sessionId,
                            frameIndex: i,
                            attempts: attempts + 1
                        });

                        break; // Move to next frame
                        
                    } catch (ackError) {
                        attempts++;
                        
                        if (attempts > BLUETOOTH_CONSTANTS.RESEND_LIMIT) {
                            logger.error('Failed to deliver frame after retries', 'BLEDataTransfer.sendFramesWithAck', {
                                sessionId,
                                frameIndex: i,
                                attempts
                            });
                            throw new Error(`Failed to deliver frame ${i} after ${attempts} attempts`);
                        }

                        logger.warn('Frame delivery failed, retrying', 'BLEDataTransfer.sendFramesWithAck', {
                            sessionId,
                            frameIndex: i,
                            attempt: attempts,
                            error: ackError
                        });

                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }

            logger.info('All frames sent successfully', 'BLEDataTransfer.sendFramesWithAck', {
                sessionId,
                frameCount: frames.length
            });

            return true;

        } catch (error) {
            logger.error('Failed to send frames with ACK', 'BLEDataTransfer.sendFramesWithAck', {
                sessionId,
                error
            });
            return false;
        }
    }

    /**
     * Wait for ACK with timeout
     */
    private async waitForAck(sessionId: string, frameIndex: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Initialize session waiters if needed
            if (!this.ackWaiters.has(sessionId)) {
                this.ackWaiters.set(sessionId, new Map());
            }
            
            const sessionWaiters = this.ackWaiters.get(sessionId)!;
            
            // Set timeout for ACK
            const timeout = setTimeout(() => {
                sessionWaiters.delete(frameIndex);
                reject(new Error(`ACK timeout for frame ${frameIndex}`));
            }, BLUETOOTH_CONSTANTS.ACK_TIMEOUT_MS);

            // Store waiter
            sessionWaiters.set(frameIndex, { resolve, reject, timeout });
        });
    }

    /**
     * Cleanup stale sessions
     */
    private cleanupStaleSessions(): void {
        const now = new Date();
        const maxAge = 10 * 60 * 1000; // 10 minutes

        // Cleanup active sessions
        for (const [sessionId, session] of this.activeSessions.entries()) {
            const age = now.getTime() - session.lastActivity.getTime();
            if (age > maxAge) {
                logger.debug('Cleaning up stale active session', 'BLEDataTransfer.cleanupStaleSessions', {
                    sessionId,
                    ageMinutes: Math.floor(age / 60000)
                });
                this.cancelTransfer(sessionId);
            }
        }

        // Cleanup incoming sessions
        for (const [sessionId, session] of this.incomingSessions.entries()) {
            const age = now.getTime() - session.lastActivity.getTime();
            if (age > maxAge) {
                logger.debug('Cleaning up stale incoming session', 'BLEDataTransfer.cleanupStaleSessions', {
                    sessionId,
                    ageMinutes: Math.floor(age / 60000)
                });
                this.incomingSessions.delete(sessionId);
            }
        }
    }
}

export default BLEDataTransfer;

