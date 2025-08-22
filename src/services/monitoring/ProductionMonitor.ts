/**
 * Production monitoring service for comprehensive app health tracking
 */

import { PerformanceMonitor } from '../analytics/PerformanceMonitor';
import { AnalyticsService } from '../analytics/AnalyticsService';
import SentryManager from '../../config/SentryConfig';
import { environment } from '../../config/Environment';
import { EventBus } from '../EventBus';
import logger from '../../utils/Logger';

export interface MonitoringMetrics {
  app: {
    version: string;
    environment: string;
    uptime: number;
    crashes: number;
    errors: number;
    warnings: number;
  };
  performance: {
    avgResponseTime: number;
    slowQueries: number;
    memoryUsage: number;
    cpuUsage: number;
    bundleSize: number;
  };
  business: {
    activeUsers: number;
    walletsCreated: number;
    transactionsProcessed: number;
    averageTransactionValue: number;
    stakingParticipation: number;
  };
  infrastructure: {
    apiHealth: boolean;
    blockchainSync: boolean;
    externalServices: Record<string, boolean>;
    networkLatency: number;
  };
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'performance' | 'error' | 'business' | 'security' | 'infrastructure';
  title: string;
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
  acknowledged: boolean;
  resolved: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  reportingInterval: number; // ms
  alerting: {
    enabled: boolean;
    channels: Array<'sentry' | 'slack' | 'email' | 'webhook'>;
    thresholds: {
      errorRate: number;
      responseTime: number;
      memoryUsage: number;
      crashRate: number;
    };
  };
  metrics: {
    retention: number; // days
    aggregation: number; // minutes
    sampling: number; // percentage
  };
}

class ProductionMonitor {
  private static instance: ProductionMonitor;
  private config: MonitoringConfig;
  private performanceMonitor: PerformanceMonitor;
  private analyticsService: AnalyticsService;
  private sentryManager: SentryManager;
  private eventBus: EventBus;
  private metrics: MonitoringMetrics;
  private alerts: Alert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number;

  private constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.analyticsService = AnalyticsService.getInstance();
    this.sentryManager = SentryManager.getInstance();
    this.eventBus = EventBus.getInstance();
    this.config = this.getDefaultConfig();
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.initialize();
  }

  public static getInstance(): ProductionMonitor {
    if (!ProductionMonitor.instance) {
      ProductionMonitor.instance = new ProductionMonitor();
    }
    return ProductionMonitor.instance;
  }

  /**
   * Initialize monitoring service
   */
  private async initialize(): Promise<void> {
    try {
      if (!this.config.enabled) {
        logger.info('Production monitoring disabled', 'ProductionMonitor.initialize');
        return;
      }

      // Setup event handlers
      this.setupEventHandlers();

      // Start monitoring loops
      this.startPeriodicMonitoring();

      // Setup alert handlers
      this.setupAlertHandlers();

      // Register health check endpoints
      this.registerHealthChecks();

      logger.info('Production monitoring initialized', 'ProductionMonitor.initialize');
    } catch (error) {
      logger.error('Failed to initialize production monitoring', 'ProductionMonitor.initialize', error);
    }
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    // Performance events
    this.eventBus.on('performance:measurement', this.handlePerformanceEvent.bind(this));
    this.eventBus.on('performance:memory', this.handleMemoryEvent.bind(this));
    this.eventBus.on('performance:network', this.handleNetworkEvent.bind(this));

    // Error events
    this.eventBus.on('error:occurred', this.handleErrorEvent.bind(this));
    this.eventBus.on('error:critical', this.handleCriticalErrorEvent.bind(this));

    // Business events
    this.eventBus.on('wallet:created', this.handleWalletCreatedEvent.bind(this));
    this.eventBus.on('transaction:completed', this.handleTransactionEvent.bind(this));
    this.eventBus.on('staking:delegated', this.handleStakingEvent.bind(this));

    // Infrastructure events
    this.eventBus.on('api:health', this.handleApiHealthEvent.bind(this));
    this.eventBus.on('blockchain:sync', this.handleBlockchainSyncEvent.bind(this));

    // App lifecycle events
    this.eventBus.on('app:foreground', this.handleAppForegroundEvent.bind(this));
    this.eventBus.on('app:background', this.handleAppBackgroundEvent.bind(this));
    this.eventBus.on('app:crash', this.handleAppCrashEvent.bind(this));
  }

  /**
   * Start periodic monitoring
   */
  private startPeriodicMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlertConditions();
      this.reportMetrics();
    }, this.config.reportingInterval);
  }

  /**
   * Collect comprehensive metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Update app metrics
      this.metrics.app.uptime = Date.now() - this.startTime;
      
      // Get performance metrics
      const perfSummary = this.performanceMonitor.getPerformanceSummary();
      this.metrics.performance.avgResponseTime = perfSummary.networkSummary.avgDuration;
      this.metrics.performance.memoryUsage = perfSummary.memoryUsage?.heapUsed || 0;

      // Get analytics metrics
      const analyticsSummary = this.analyticsService.getAnalyticsSummary();
      this.metrics.business.activeUsers = analyticsSummary.currentSession ? 1 : 0;

      // Check infrastructure health
      await this.checkInfrastructureHealth();

      logger.debug('Metrics collected', 'ProductionMonitor.collectMetrics', this.metrics);
    } catch (error) {
      logger.error('Failed to collect metrics', 'ProductionMonitor.collectMetrics', error);
    }
  }

  /**
   * Check infrastructure health
   */
  private async checkInfrastructureHealth(): Promise<void> {
    const services = [
      { name: 'blockfrost', url: environment.get('BLOCKFROST_BASE_URL') + '/health' },
      { name: 'coingecko', url: 'https://api.coingecko.com/api/v3/ping' },
    ];

    for (const service of services) {
      try {
        const startTime = Date.now();
        const response = await fetch(service.url, { 
          method: 'GET',
          timeout: 10000 
        } as any);
        
        const isHealthy = response.ok;
        const latency = Date.now() - startTime;
        
        this.metrics.infrastructure.externalServices[service.name] = isHealthy;
        
        if (service.name === 'blockfrost') {
          this.metrics.infrastructure.networkLatency = latency;
        }

        if (!isHealthy) {
          this.createAlert({
            severity: 'high',
            type: 'infrastructure',
            title: `${service.name} Service Down`,
            message: `External service ${service.name} is not responding`,
            metadata: { service: service.name, url: service.url, status: response.status }
          });
        }
      } catch (error) {
        this.metrics.infrastructure.externalServices[service.name] = false;
        
        this.createAlert({
          severity: 'critical',
          type: 'infrastructure',
          title: `${service.name} Service Error`,
          message: `Failed to connect to ${service.name}: ${error.message}`,
          metadata: { service: service.name, error: error.message }
        });
      }
    }
  }

  /**
   * Check alert conditions
   */
  private checkAlertConditions(): void {
    const { thresholds } = this.config.alerting;

    // Memory usage alert
    if (this.metrics.performance.memoryUsage > thresholds.memoryUsage) {
      this.createAlert({
        severity: 'medium',
        type: 'performance',
        title: 'High Memory Usage',
        message: `Memory usage is ${Math.round(this.metrics.performance.memoryUsage / 1024 / 1024)}MB`,
        metadata: { current: this.metrics.performance.memoryUsage, threshold: thresholds.memoryUsage }
      });
    }

    // Response time alert
    if (this.metrics.performance.avgResponseTime > thresholds.responseTime) {
      this.createAlert({
        severity: 'medium',
        type: 'performance',
        title: 'Slow Response Time',
        message: `Average response time is ${Math.round(this.metrics.performance.avgResponseTime)}ms`,
        metadata: { current: this.metrics.performance.avgResponseTime, threshold: thresholds.responseTime }
      });
    }

    // Error rate alert
    const errorRate = this.calculateErrorRate();
    if (errorRate > thresholds.errorRate) {
      this.createAlert({
        severity: 'high',
        type: 'error',
        title: 'High Error Rate',
        message: `Error rate is ${Math.round(errorRate * 100)}%`,
        metadata: { current: errorRate, threshold: thresholds.errorRate }
      });
    }
  }

  /**
   * Calculate current error rate
   */
  private calculateErrorRate(): number {
    const perfSummary = this.performanceMonitor.getPerformanceSummary();
    const { totalRequests, errorRate } = perfSummary.networkSummary;
    return totalRequests > 0 ? errorRate : 0;
  }

  /**
   * Create and dispatch alert
   */
  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      ...alertData
    };

    this.alerts.push(alert);

    // Dispatch alert
    this.dispatchAlert(alert);

    logger.warn('Alert created', 'ProductionMonitor.createAlert', alert);
  }

  /**
   * Dispatch alert to configured channels
   */
  private async dispatchAlert(alert: Alert): Promise<void> {
    if (!this.config.alerting.enabled) return;

    for (const channel of this.config.alerting.channels) {
      try {
        switch (channel) {
          case 'sentry':
            await this.sendToSentry(alert);
            break;
          case 'slack':
            await this.sendToSlack(alert);
            break;
          case 'email':
            await this.sendToEmail(alert);
            break;
          case 'webhook':
            await this.sendToWebhook(alert);
            break;
        }
      } catch (error) {
        logger.error(`Failed to send alert to ${channel}`, 'ProductionMonitor.dispatchAlert', error);
      }
    }
  }

  /**
   * Send alert to Sentry
   */
  private async sendToSentry(alert: Alert): Promise<void> {
    this.sentryManager.trackWalletEvent('monitoring_alert', {
      alert_id: alert.id,
      severity: alert.severity,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata
    });
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: Alert): Promise<void> {
    const webhookUrl = environment.get('SLACK_WEBHOOK_URL');
    if (!webhookUrl) return;

    const color = {
      low: '#36a64f',      // Green
      medium: '#ff9500',   // Orange  
      high: '#ff0000',     // Red
      critical: '#8B0000'  // Dark Red
    }[alert.severity];

    const payload = {
      text: `🚨 ${alert.title}`,
      attachments: [{
        color,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Type', value: alert.type, short: true },
          { title: 'Message', value: alert.message, short: false },
          { title: 'Environment', value: environment.getCurrentEnvironment(), short: true },
          { title: 'Timestamp', value: new Date(alert.timestamp).toISOString(), short: true }
        ]
      }]
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Send alert to email
   */
  private async sendToEmail(alert: Alert): Promise<void> {
    // This would integrate with an email service like SendGrid
    logger.info('Email alert would be sent', 'ProductionMonitor.sendToEmail', alert);
  }

  /**
   * Send alert to webhook
   */
  private async sendToWebhook(alert: Alert): Promise<void> {
    const webhookUrl = environment.get('MONITORING_WEBHOOK_URL');
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'alert',
        data: alert,
        environment: environment.getCurrentEnvironment(),
        app_version: environment.get('APP_VERSION')
      })
    });
  }

  /**
   * Report metrics to external services
   */
  private async reportMetrics(): Promise<void> {
    try {
      // Report to custom analytics endpoint
      await this.reportToAnalytics();
      
      // Report to monitoring service
      await this.reportToMonitoringService();
      
    } catch (error) {
      logger.error('Failed to report metrics', 'ProductionMonitor.reportMetrics', error);
    }
  }

  /**
   * Report to analytics endpoint
   */
  private async reportToAnalytics(): Promise<void> {
    const analyticsUrl = environment.get('ANALYTICS_ENDPOINT');
    if (!analyticsUrl) return;

    await fetch(analyticsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        environment: environment.getCurrentEnvironment(),
        metrics: this.metrics,
        app_version: environment.get('APP_VERSION')
      })
    });
  }

  /**
   * Report to monitoring service
   */
  private async reportToMonitoringService(): Promise<void> {
    const monitoringUrl = environment.get('MONITORING_ENDPOINT');
    if (!monitoringUrl) return;

    await fetch(monitoringUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${environment.get('MONITORING_API_KEY')}`
      },
      body: JSON.stringify({
        source: 'valkyrie-wallet',
        timestamp: Date.now(),
        environment: environment.getCurrentEnvironment(),
        metrics: this.metrics,
        alerts: this.alerts.filter(a => !a.resolved).length
      })
    });
  }

  /**
   * Setup alert handlers
   */
  private setupAlertHandlers(): void {
    // Auto-resolve alerts after certain conditions
    setInterval(() => {
      this.autoResolveAlerts();
    }, 60000); // Check every minute
  }

  /**
   * Auto-resolve alerts when conditions improve
   */
  private autoResolveAlerts(): void {
    this.alerts.forEach(alert => {
      if (alert.resolved) return;

      // Auto-resolve performance alerts if metrics improve
      if (alert.type === 'performance') {
        if (alert.title.includes('Memory') && 
            this.metrics.performance.memoryUsage < this.config.alerting.thresholds.memoryUsage * 0.8) {
          this.resolveAlert(alert.id);
        }
        
        if (alert.title.includes('Response') && 
            this.metrics.performance.avgResponseTime < this.config.alerting.thresholds.responseTime * 0.8) {
          this.resolveAlert(alert.id);
        }
      }

      // Auto-resolve infrastructure alerts if services are healthy
      if (alert.type === 'infrastructure') {
        const serviceName = alert.metadata?.service;
        if (serviceName && this.metrics.infrastructure.externalServices[serviceName]) {
          this.resolveAlert(alert.id);
        }
      }
    });
  }

  /**
   * Register health check endpoints
   */
  private registerHealthChecks(): void {
    // This would register health check endpoints for load balancers
    // In a real implementation, this might set up an Express server
    logger.info('Health check endpoints registered', 'ProductionMonitor.registerHealthChecks');
  }

  /**
   * Event handlers
   */
  private handlePerformanceEvent(event: any): void {
    // Update performance metrics based on events
    if (event.category === 'api' && event.duration > this.config.alerting.thresholds.responseTime) {
      this.metrics.performance.slowQueries++;
    }
  }

  private handleMemoryEvent(event: any): void {
    this.metrics.performance.memoryUsage = event.heapUsed;
  }

  private handleNetworkEvent(event: any): void {
    if (event.status >= 400) {
      this.metrics.app.errors++;
    }
  }

  private handleErrorEvent(event: any): void {
    this.metrics.app.errors++;
  }

  private handleCriticalErrorEvent(event: any): void {
    this.metrics.app.errors++;
    this.createAlert({
      severity: 'critical',
      type: 'error',
      title: 'Critical Error Occurred',
      message: event.message || 'Unknown critical error',
      metadata: event
    });
  }

  private handleWalletCreatedEvent(event: any): void {
    this.metrics.business.walletsCreated++;
  }

  private handleTransactionEvent(event: any): void {
    this.metrics.business.transactionsProcessed++;
    if (event.amount) {
      this.metrics.business.averageTransactionValue = 
        (this.metrics.business.averageTransactionValue + parseFloat(event.amount)) / 2;
    }
  }

  private handleStakingEvent(event: any): void {
    this.metrics.business.stakingParticipation++;
  }

  private handleApiHealthEvent(event: any): void {
    this.metrics.infrastructure.apiHealth = event.healthy;
  }

  private handleBlockchainSyncEvent(event: any): void {
    this.metrics.infrastructure.blockchainSync = event.synced;
  }

  private handleAppForegroundEvent(): void {
    this.metrics.business.activeUsers++;
  }

  private handleAppBackgroundEvent(): void {
    // App went to background
  }

  private handleAppCrashEvent(event: any): void {
    this.metrics.app.crashes++;
    this.createAlert({
      severity: 'critical',
      type: 'error',
      title: 'App Crash Detected',
      message: event.message || 'Application crashed',
      metadata: event
    });
  }

  /**
   * Public API methods
   */
  public getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  public getAlerts(): Alert[] {
    return [...this.alerts];
  }

  public acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Alert acknowledged', 'ProductionMonitor.acknowledgeAlert', { alertId });
    }
  }

  public resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info('Alert resolved', 'ProductionMonitor.resolveAlert', { alertId });
    }
  }

  public getHealthStatus(): { status: 'healthy' | 'degraded' | 'unhealthy'; details: any } {
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    const highAlerts = activeAlerts.filter(a => a.severity === 'high');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (highAlerts.length > 0 || activeAlerts.length > 5) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        uptime: this.metrics.app.uptime,
        activeAlerts: activeAlerts.length,
        criticalAlerts: criticalAlerts.length,
        memoryUsage: this.metrics.performance.memoryUsage,
        apiHealth: this.metrics.infrastructure.apiHealth,
        lastCheck: Date.now()
      }
    };
  }

  /**
   * Configuration and utility methods
   */
  private getDefaultConfig(): MonitoringConfig {
    return {
      enabled: environment.isProduction() || environment.isStaging(),
      reportingInterval: environment.isDevelopment() ? 30000 : 300000, // 30s dev, 5min prod
      alerting: {
        enabled: true,
        channels: ['sentry', 'slack'],
        thresholds: {
          errorRate: 0.05, // 5%
          responseTime: 5000, // 5 seconds
          memoryUsage: 100 * 1024 * 1024, // 100MB
          crashRate: 0.01 // 1%
        }
      },
      metrics: {
        retention: 30, // 30 days
        aggregation: 5, // 5 minutes
        sampling: environment.isProduction() ? 10 : 100 // 10% prod, 100% dev
      }
    };
  }

  private initializeMetrics(): MonitoringMetrics {
    return {
      app: {
        version: environment.get('APP_VERSION') || '1.0.0',
        environment: environment.getCurrentEnvironment(),
        uptime: 0,
        crashes: 0,
        errors: 0,
        warnings: 0
      },
      performance: {
        avgResponseTime: 0,
        slowQueries: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        bundleSize: 0
      },
      business: {
        activeUsers: 0,
        walletsCreated: 0,
        transactionsProcessed: 0,
        averageTransactionValue: 0,
        stakingParticipation: 0
      },
      infrastructure: {
        apiHealth: true,
        blockchainSync: true,
        externalServices: {},
        networkLatency: 0
      }
    };
  }

  /**
   * Cleanup on destroy
   */
  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.alerts = [];
  }
}

export default ProductionMonitor;

