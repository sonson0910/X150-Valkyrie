/**
 * Analytics service for user behavior tracking and reporting
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PerformanceMonitor, AnalyticsEvent } from './PerformanceMonitor';
import { EventBus } from '../EventBus';
import logger from '../../utils/Logger';

export interface UserProfile {
    userId: string;
    createdAt: number;
    lastActiveAt: number;
    sessionCount: number;
    totalTimeSpent: number;
    preferredLanguage?: string;
    deviceInfo?: {
        platform: string;
        version: string;
        model?: string;
    };
    walletInfo?: {
        accountsCount: number;
        hasStaking: boolean;
        hasNFTs: boolean;
        preferredNetwork: string;
    };
}

export interface SessionInfo {
    sessionId: string;
    userId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    screenViews: number;
    interactions: number;
    errors: number;
    crashes: number;
}

export interface FeatureUsage {
    feature: string;
    category: string;
    usageCount: number;
    lastUsed: number;
    averageSessionUsage: number;
    userSegments: string[];
}

export interface ErrorReport {
    id: string;
    timestamp: number;
    error: string;
    stack?: string;
    userId?: string;
    sessionId: string;
    screen?: string;
    context?: Record<string, any>;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AnalyticsConfig {
    enabled: boolean;
    collectPersonalData: boolean;
    uploadInterval: number;
    maxEventsToStore: number;
    crashReportingEnabled: boolean;
    performanceTrackingEnabled: boolean;
}

export class AnalyticsService {
    private static instance: AnalyticsService;
    private performanceMonitor: PerformanceMonitor;
    private eventBus: EventBus;
    private config: AnalyticsConfig;
    private currentSession: SessionInfo | null = null;
    private userProfile: UserProfile | null = null;
    private eventQueue: AnalyticsEvent[] = [];
    private errorReports: ErrorReport[] = [];
    private featureUsage: Map<string, FeatureUsage> = new Map();
    private uploadTimer: NodeJS.Timeout | null = null;

    private constructor() {
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.eventBus = EventBus.getInstance();
        this.config = this.getDefaultConfig();
        this.initialize();
    }

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    /**
     * Initialize analytics service
     */
    private async initialize(): Promise<void> {
        try {
            // Load configuration
            await this.loadConfig();

            // Load user profile
            await this.loadUserProfile();

            // Setup event handlers
            this.setupEventHandlers();

            // Start session
            await this.startSession();

            // Setup periodic uploads
            this.startPeriodicUploads();

            logger.info('Analytics service initialized', 'AnalyticsService.initialize');
        } catch (error) {
            logger.error('Failed to initialize analytics service', 'AnalyticsService.initialize', error);
        }
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        // Listen to performance events
        this.eventBus.on('analytics:event', this.handleAnalyticsEvent.bind(this));
        this.eventBus.on('analytics:userAction', this.handleUserAction.bind(this));
        
        // Listen to app lifecycle events
        this.eventBus.on('app:foreground', this.handleAppForeground.bind(this));
        this.eventBus.on('app:background', this.handleAppBackground.bind(this));
        this.eventBus.on('app:error', this.handleAppError.bind(this));
        this.eventBus.on('app:crash', this.handleAppCrash.bind(this));
    }

    /**
     * Start a new session
     */
    public async startSession(userId?: string): Promise<void> {
        try {
            // End current session if exists
            if (this.currentSession) {
                await this.endSession();
            }

            // Create new session
            this.currentSession = {
                sessionId: this.generateSessionId(),
                userId: userId || this.userProfile?.userId || 'anonymous',
                startTime: Date.now(),
                screenViews: 0,
                interactions: 0,
                errors: 0,
                crashes: 0
            };

            // Update user profile
            if (this.userProfile) {
                this.userProfile.lastActiveAt = Date.now();
                this.userProfile.sessionCount++;
                await this.saveUserProfile();
            } else if (userId) {
                await this.createUserProfile(userId);
            }

            // Track session start
            this.trackEvent('session_start', 'engagement', {
                sessionId: this.currentSession.sessionId,
                userId: this.currentSession.userId
            });

            logger.info('Session started', 'AnalyticsService.startSession', {
                sessionId: this.currentSession.sessionId
            });
        } catch (error) {
            logger.error('Failed to start session', 'AnalyticsService.startSession', error);
        }
    }

    /**
     * End current session
     */
    public async endSession(): Promise<void> {
        if (!this.currentSession) return;

        try {
            const endTime = Date.now();
            this.currentSession.endTime = endTime;
            this.currentSession.duration = endTime - this.currentSession.startTime;

            // Update user total time
            if (this.userProfile) {
                this.userProfile.totalTimeSpent += this.currentSession.duration;
                await this.saveUserProfile();
            }

            // Track session end
            this.trackEvent('session_end', 'engagement', {
                sessionId: this.currentSession.sessionId,
                duration: this.currentSession.duration,
                screenViews: this.currentSession.screenViews,
                interactions: this.currentSession.interactions,
                errors: this.currentSession.errors
            });

            logger.info('Session ended', 'AnalyticsService.endSession', {
                sessionId: this.currentSession.sessionId,
                duration: this.currentSession.duration
            });

            this.currentSession = null;
        } catch (error) {
            logger.error('Failed to end session', 'AnalyticsService.endSession', error);
        }
    }

    /**
     * Track custom event
     */
    public trackEvent(
        name: string,
        category: string,
        properties?: Record<string, any>,
        userId?: string
    ): void {
        if (!this.config.enabled) return;

        try {
            const event: AnalyticsEvent = {
                id: this.generateEventId(),
                name,
                category,
                timestamp: Date.now(),
                properties: this.sanitizeProperties(properties),
                userId: userId || this.currentSession?.userId,
                sessionId: this.currentSession?.sessionId || 'no-session'
            };

            this.eventQueue.push(event);
            this.trimEventQueue();

            // Track feature usage
            this.updateFeatureUsage(name, category);

            logger.debug('Event tracked', 'AnalyticsService.trackEvent', {
                name,
                category,
                userId: event.userId
            });
        } catch (error) {
            logger.error('Failed to track event', 'AnalyticsService.trackEvent', error);
        }
    }

    /**
     * Track screen view
     */
    public trackScreenView(
        screenName: string,
        properties?: Record<string, any>
    ): void {
        if (!this.config.enabled) return;

        this.trackEvent('screen_view', 'navigation', {
            screenName,
            ...properties
        });

        if (this.currentSession) {
            this.currentSession.screenViews++;
        }
    }

    /**
     * Track user interaction
     */
    public trackInteraction(
        action: string,
        element: string,
        screen: string,
        properties?: Record<string, any>
    ): void {
        if (!this.config.enabled) return;

        this.trackEvent('user_interaction', 'ui', {
            action,
            element,
            screen,
            ...properties
        });

        if (this.currentSession) {
            this.currentSession.interactions++;
        }
    }

    /**
     * Track error
     */
    public trackError(
        error: Error,
        context?: Record<string, any>,
        severity: ErrorReport['severity'] = 'medium'
    ): void {
        if (!this.config.enabled) return;

        try {
            const errorReport: ErrorReport = {
                id: this.generateEventId(),
                timestamp: Date.now(),
                error: error.message,
                stack: error.stack,
                userId: this.currentSession?.userId,
                sessionId: this.currentSession?.sessionId || 'no-session',
                context: this.sanitizeProperties(context),
                severity
            };

            this.errorReports.push(errorReport);

            if (this.currentSession) {
                this.currentSession.errors++;
            }

            // Track error event
            this.trackEvent('error_occurred', 'error', {
                errorMessage: error.message,
                errorType: error.name,
                severity,
                context
            });

            logger.error('Error tracked', 'AnalyticsService.trackError', error);
        } catch (trackingError) {
            logger.error('Failed to track error', 'AnalyticsService.trackError', trackingError);
        }
    }

    /**
     * Set user properties
     */
    public async setUserProperties(properties: Partial<UserProfile>): Promise<void> {
        try {
            if (this.userProfile) {
                Object.assign(this.userProfile, properties);
                await this.saveUserProfile();
            }

            // Track user property update
            this.trackEvent('user_properties_updated', 'user', {
                updatedProperties: Object.keys(properties)
            });
        } catch (error) {
            logger.error('Failed to set user properties', 'AnalyticsService.setUserProperties', error);
        }
    }

    /**
     * Get analytics summary
     */
    public getAnalyticsSummary(): {
        currentSession: SessionInfo | null;
        userProfile: UserProfile | null;
        eventQueueSize: number;
        errorReportsCount: number;
        topFeatures: Array<{ feature: string; usage: number }>;
        sessionStats: {
            averageDuration: number;
            averageScreenViews: number;
            averageInteractions: number;
        };
    } {
        // Calculate session stats
        const sessionStats = {
            averageDuration: 0,
            averageScreenViews: 0,
            averageInteractions: 0
        };

        if (this.userProfile && this.userProfile.sessionCount > 0) {
            sessionStats.averageDuration = this.userProfile.totalTimeSpent / this.userProfile.sessionCount;
        }

        // Get top features
        const topFeatures = Array.from(this.featureUsage.values())
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, 10)
            .map(feature => ({ feature: feature.feature, usage: feature.usageCount }));

        return {
            currentSession: this.currentSession,
            userProfile: this.userProfile,
            eventQueueSize: this.eventQueue.length,
            errorReportsCount: this.errorReports.length,
            topFeatures,
            sessionStats
        };
    }

    /**
     * Export analytics data
     */
    public async exportAnalyticsData(): Promise<{
        userProfile: UserProfile | null;
        sessions: SessionInfo[];
        events: AnalyticsEvent[];
        errors: ErrorReport[];
        featureUsage: FeatureUsage[];
        performanceData: any;
    }> {
        try {
            // Load stored sessions
            const storedSessions = await this.loadStoredSessions();

            return {
                userProfile: this.userProfile,
                sessions: this.currentSession ? [...storedSessions, this.currentSession] : storedSessions,
                events: [...this.eventQueue],
                errors: [...this.errorReports],
                featureUsage: Array.from(this.featureUsage.values()),
                performanceData: this.performanceMonitor.exportMetrics()
            };
        } catch (error) {
            logger.error('Failed to export analytics data', 'AnalyticsService.exportAnalyticsData', error);
            throw error;
        }
    }

    /**
     * Clear all analytics data
     */
    public async clearAllData(): Promise<void> {
        try {
            this.eventQueue = [];
            this.errorReports = [];
            this.featureUsage.clear();
            this.currentSession = null;
            this.userProfile = null;

            // Clear stored data
            await AsyncStorage.multiRemove([
                'analytics_config',
                'analytics_user_profile',
                'analytics_sessions'
            ]);

            logger.info('All analytics data cleared', 'AnalyticsService.clearAllData');
        } catch (error) {
            logger.error('Failed to clear analytics data', 'AnalyticsService.clearAllData', error);
        }
    }

    /**
     * Private helper methods
     */

    private getDefaultConfig(): AnalyticsConfig {
        return {
            enabled: true,
            collectPersonalData: false,
            uploadInterval: 300000, // 5 minutes
            maxEventsToStore: 1000,
            crashReportingEnabled: true,
            performanceTrackingEnabled: true
        };
    }

    private async loadConfig(): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem('analytics_config');
            if (stored) {
                this.config = { ...this.config, ...JSON.parse(stored) };
            }
        } catch (error) {
            logger.warn('Failed to load analytics config', 'AnalyticsService.loadConfig', error);
        }
    }

    private async saveConfig(): Promise<void> {
        try {
            await AsyncStorage.setItem('analytics_config', JSON.stringify(this.config));
        } catch (error) {
            logger.error('Failed to save analytics config', 'AnalyticsService.saveConfig', error);
        }
    }

    private async loadUserProfile(): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem('analytics_user_profile');
            if (stored) {
                this.userProfile = JSON.parse(stored);
            }
        } catch (error) {
            logger.warn('Failed to load user profile', 'AnalyticsService.loadUserProfile', error);
        }
    }

    private async saveUserProfile(): Promise<void> {
        if (!this.userProfile) return;

        try {
            await AsyncStorage.setItem('analytics_user_profile', JSON.stringify(this.userProfile));
        } catch (error) {
            logger.error('Failed to save user profile', 'AnalyticsService.saveUserProfile', error);
        }
    }

    private async createUserProfile(userId: string): Promise<void> {
        this.userProfile = {
            userId,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
            sessionCount: 1,
            totalTimeSpent: 0
        };

        await this.saveUserProfile();
    }

    private async loadStoredSessions(): Promise<SessionInfo[]> {
        try {
            const stored = await AsyncStorage.getItem('analytics_sessions');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            logger.warn('Failed to load stored sessions', 'AnalyticsService.loadStoredSessions', error);
            return [];
        }
    }

    private updateFeatureUsage(feature: string, category: string): void {
        const key = `${category}:${feature}`;
        const existing = this.featureUsage.get(key);

        if (existing) {
            existing.usageCount++;
            existing.lastUsed = Date.now();
        } else {
            this.featureUsage.set(key, {
                feature,
                category,
                usageCount: 1,
                lastUsed: Date.now(),
                averageSessionUsage: 0,
                userSegments: []
            });
        }
    }

    private sanitizeProperties(properties?: Record<string, any>): Record<string, any> | undefined {
        if (!properties) return undefined;

        const sanitized: Record<string, any> = {};
        
        Object.keys(properties).forEach(key => {
            const value = properties[key];
            
            // Only include primitive types and simple objects
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Simple object - only one level deep
                sanitized[key] = JSON.stringify(value);
            }
        });

        return sanitized;
    }

    private trimEventQueue(): void {
        if (this.eventQueue.length > this.config.maxEventsToStore) {
            this.eventQueue = this.eventQueue.slice(-this.config.maxEventsToStore);
        }
    }

    private startPeriodicUploads(): void {
        if (this.uploadTimer) {
            clearInterval(this.uploadTimer);
        }

        this.uploadTimer = setInterval(() => {
            this.uploadAnalyticsData();
        }, this.config.uploadInterval);
    }

    private async uploadAnalyticsData(): Promise<void> {
        // This would implement actual upload logic
        // For now, just log that we would upload
        logger.debug('Would upload analytics data', 'AnalyticsService.uploadAnalyticsData', {
            eventCount: this.eventQueue.length,
            errorCount: this.errorReports.length
        });
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateEventId(): string {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Event handlers
    private handleAnalyticsEvent(event: AnalyticsEvent): void {
        // Already handled by trackEvent
    }

    private handleUserAction(action: any): void {
        this.trackInteraction(action.action, 'unknown', action.screen, action.metadata);
    }

    private handleAppForeground(): void {
        this.trackEvent('app_foreground', 'lifecycle');
    }

    private handleAppBackground(): void {
        this.trackEvent('app_background', 'lifecycle');
    }

    private handleAppError(error: any): void {
        this.trackError(error.error || new Error(error.message), error.context, 'medium');
    }

    private handleAppCrash(crash: any): void {
        if (this.currentSession) {
            this.currentSession.crashes++;
        }
        this.trackError(crash.error || new Error(crash.message), crash.context, 'critical');
    }

    /**
     * Cleanup on destroy
     */
    public destroy(): void {
        if (this.uploadTimer) {
            clearInterval(this.uploadTimer);
        }
        this.endSession();
    }
}

export default AnalyticsService;

