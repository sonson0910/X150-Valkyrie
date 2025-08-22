#!/usr/bin/env node

/**
 * Health check script for CI/CD pipeline
 * Verifies application health and dependencies
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class HealthChecker {
    constructor() {
        this.results = {
            overall: 'unknown',
            checks: [],
            timestamp: new Date().toISOString(),
            duration: 0
        };
        this.startTime = Date.now();
    }

    /**
     * Run all health checks
     */
    async runAllChecks() {
        console.log('🔍 Starting health checks...\n');

        try {
            // Core checks
            await this.checkDependencies();
            await this.checkConfiguration();
            await this.checkSecuritySettings();
            
            // External service checks
            await this.checkExternalServices();
            
            // Performance checks
            await this.checkPerformance();
            
            // Security checks
            await this.checkSecurityVulnerabilities();

            this.calculateOverallHealth();
            this.printResults();
            
            return this.results.overall === 'healthy';
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            this.results.overall = 'unhealthy';
            return false;
        } finally {
            this.results.duration = Date.now() - this.startTime;
        }
    }

    /**
     * Check package dependencies
     */
    async checkDependencies() {
        const check = { name: 'Dependencies', status: 'unknown', details: [] };
        
        try {
            // Check package.json exists
            const packagePath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packagePath)) {
                throw new Error('package.json not found');
            }

            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Check critical dependencies
            const criticalDeps = [
                '@emurgo/cardano-serialization-lib-browser',
                'react-native',
                'expo',
                '@react-navigation/native'
            ];

            for (const dep of criticalDeps) {
                if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
                    check.details.push(`Missing critical dependency: ${dep}`);
                }
            }

            // Check for known vulnerable packages
            const vulnerablePackages = ['event-stream', 'eslint-scope'];
            for (const vuln of vulnerablePackages) {
                if (packageJson.dependencies[vuln] || packageJson.devDependencies[vuln]) {
                    check.details.push(`Vulnerable package detected: ${vuln}`);
                }
            }

            check.status = check.details.length === 0 ? 'healthy' : 'warning';
            if (check.details.length === 0) {
                check.details.push('All critical dependencies present');
            }

        } catch (error) {
            check.status = 'unhealthy';
            check.details.push(`Dependency check failed: ${error.message}`);
        }

        this.results.checks.push(check);
        this.logCheck(check);
    }

    /**
     * Check configuration files
     */
    async checkConfiguration() {
        const check = { name: 'Configuration', status: 'unknown', details: [] };
        
        try {
            // Check environment files
            const envFiles = [
                'environment.development.js',
                'environment.staging.js', 
                'environment.production.js'
            ];

            for (const envFile of envFiles) {
                if (fs.existsSync(envFile)) {
                    check.details.push(`✓ ${envFile} exists`);
                } else {
                    check.details.push(`✗ ${envFile} missing`);
                }
            }

            // Check required config files
            const configFiles = [
                'tsconfig.json',
                'jest.config.js',
                'babel.config.js'
            ];

            for (const configFile of configFiles) {
                if (fs.existsSync(configFile)) {
                    check.details.push(`✓ ${configFile} exists`);
                } else {
                    check.details.push(`✗ ${configFile} missing`);
                }
            }

            // Check for sensitive data in config
            const gitignorePath = '.gitignore';
            if (fs.existsSync(gitignorePath)) {
                const gitignore = fs.readFileSync(gitignorePath, 'utf8');
                const requiredIgnores = ['.env', '*.key', '*.pem', 'secrets'];
                
                for (const ignore of requiredIgnores) {
                    if (!gitignore.includes(ignore)) {
                        check.details.push(`⚠️ ${ignore} not in .gitignore`);
                    }
                }
            }

            check.status = check.details.some(d => d.includes('✗') || d.includes('⚠️')) ? 'warning' : 'healthy';

        } catch (error) {
            check.status = 'unhealthy';
            check.details.push(`Configuration check failed: ${error.message}`);
        }

        this.results.checks.push(check);
        this.logCheck(check);
    }

    /**
     * Check security settings
     */
    async checkSecuritySettings() {
        const check = { name: 'Security Settings', status: 'unknown', details: [] };
        
        try {
            // Check for security-related files
            const securityFiles = [
                '.snyk',
                'sonar-project.properties'
            ];

            for (const file of securityFiles) {
                if (fs.existsSync(file)) {
                    check.details.push(`✓ ${file} configured`);
                } else {
                    check.details.push(`⚠️ ${file} missing`);
                }
            }

            // Check package.json for security scripts
            const packagePath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(packagePath)) {
                const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                const securityScripts = ['security:audit', 'security:check'];
                
                for (const script of securityScripts) {
                    if (packageJson.scripts && packageJson.scripts[script]) {
                        check.details.push(`✓ ${script} script configured`);
                    } else {
                        check.details.push(`⚠️ ${script} script missing`);
                    }
                }
            }

            check.status = check.details.some(d => d.includes('⚠️')) ? 'warning' : 'healthy';

        } catch (error) {
            check.status = 'unhealthy';
            check.details.push(`Security check failed: ${error.message}`);
        }

        this.results.checks.push(check);
        this.logCheck(check);
    }

    /**
     * Check external services
     */
    async checkExternalServices() {
        const check = { name: 'External Services', status: 'unknown', details: [] };
        
        try {
            const services = [
                { name: 'Blockfrost API', url: 'https://cardano-mainnet.blockfrost.io/api/v0/health' },
                { name: 'CoinGecko API', url: 'https://api.coingecko.com/api/v3/ping' },
                { name: 'GitHub API', url: 'https://api.github.com/rate_limit' }
            ];

            for (const service of services) {
                try {
                    const isHealthy = await this.checkUrl(service.url, 5000);
                    if (isHealthy) {
                        check.details.push(`✓ ${service.name} accessible`);
                    } else {
                        check.details.push(`✗ ${service.name} unreachable`);
                    }
                } catch (error) {
                    check.details.push(`✗ ${service.name} error: ${error.message}`);
                }
            }

            check.status = check.details.some(d => d.includes('✗')) ? 'warning' : 'healthy';

        } catch (error) {
            check.status = 'unhealthy';
            check.details.push(`External services check failed: ${error.message}`);
        }

        this.results.checks.push(check);
        this.logCheck(check);
    }

    /**
     * Check performance metrics
     */
    async checkPerformance() {
        const check = { name: 'Performance', status: 'unknown', details: [] };
        
        try {
            // Check bundle size limits
            const bundleSizeLimit = 10 * 1024 * 1024; // 10MB
            
            // Check if build directory exists
            if (fs.existsSync('dist') || fs.existsSync('build')) {
                check.details.push('✓ Build artifacts exist');
            } else {
                check.details.push('ℹ️ No build artifacts (run build first)');
            }

            // Memory usage check
            const memUsage = process.memoryUsage();
            if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
                check.details.push('⚠️ High memory usage detected');
            } else {
                check.details.push('✓ Memory usage normal');
            }

            check.status = check.details.some(d => d.includes('⚠️')) ? 'warning' : 'healthy';

        } catch (error) {
            check.status = 'unhealthy';
            check.details.push(`Performance check failed: ${error.message}`);
        }

        this.results.checks.push(check);
        this.logCheck(check);
    }

    /**
     * Check for security vulnerabilities
     */
    async checkSecurityVulnerabilities() {
        const check = { name: 'Security Vulnerabilities', status: 'unknown', details: [] };
        
        try {
            // This would normally run npm audit or snyk test
            // For now, we'll just check if the tools are available
            
            const { execSync } = require('child_process');
            
            try {
                execSync('npm audit --audit-level=high --json', { stdio: 'pipe' });
                check.details.push('✓ No high-severity vulnerabilities found');
            } catch (error) {
                // npm audit returns non-zero exit code if vulnerabilities found
                check.details.push('⚠️ High-severity vulnerabilities detected');
            }

            check.status = check.details.some(d => d.includes('⚠️')) ? 'warning' : 'healthy';

        } catch (error) {
            check.status = 'warning';
            check.details.push('ℹ️ Could not run vulnerability scan');
        }

        this.results.checks.push(check);
        this.logCheck(check);
    }

    /**
     * Check URL accessibility
     */
    checkUrl(url, timeout = 5000) {
        return new Promise((resolve) => {
            const client = url.startsWith('https') ? https : http;
            const startTime = Date.now();
            
            const req = client.get(url, (res) => {
                const success = res.statusCode >= 200 && res.statusCode < 400;
                resolve(success);
            });

            req.setTimeout(timeout, () => {
                req.destroy();
                resolve(false);
            });

            req.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Calculate overall health
     */
    calculateOverallHealth() {
        const healthyCount = this.results.checks.filter(c => c.status === 'healthy').length;
        const warningCount = this.results.checks.filter(c => c.status === 'warning').length;
        const unhealthyCount = this.results.checks.filter(c => c.status === 'unhealthy').length;

        if (unhealthyCount > 0) {
            this.results.overall = 'unhealthy';
        } else if (warningCount > 0) {
            this.results.overall = 'warning';
        } else {
            this.results.overall = 'healthy';
        }
    }

    /**
     * Log individual check result
     */
    logCheck(check) {
        const icon = {
            healthy: '✅',
            warning: '⚠️',
            unhealthy: '❌'
        }[check.status];

        console.log(`${icon} ${check.name}: ${check.status}`);
        check.details.forEach(detail => {
            console.log(`   ${detail}`);
        });
        console.log();
    }

    /**
     * Print final results
     */
    printResults() {
        console.log('📊 Health Check Summary');
        console.log('=' .repeat(50));
        console.log(`Overall Status: ${this.results.overall.toUpperCase()}`);
        console.log(`Duration: ${this.results.duration}ms`);
        console.log(`Timestamp: ${this.results.timestamp}`);
        console.log();

        const counts = this.results.checks.reduce((acc, check) => {
            acc[check.status] = (acc[check.status] || 0) + 1;
            return acc;
        }, {});

        console.log('Check Results:');
        console.log(`  ✅ Healthy: ${counts.healthy || 0}`);
        console.log(`  ⚠️  Warning: ${counts.warning || 0}`);
        console.log(`  ❌ Unhealthy: ${counts.unhealthy || 0}`);
        console.log();

        // Save results to file for CI/CD
        fs.writeFileSync('health-check-results.json', JSON.stringify(this.results, null, 2));
        console.log('📄 Results saved to health-check-results.json');
    }
}

// Run health checks if script is executed directly
if (require.main === module) {
    const checker = new HealthChecker();
    checker.runAllChecks().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Health check failed:', error);
        process.exit(1);
    });
}

module.exports = HealthChecker;

