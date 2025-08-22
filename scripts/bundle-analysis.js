#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * 
 * Analyzes bundle sizes across platforms and provides optimization recommendations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// =========================================================================
// CONFIGURATION
// =========================================================================

const config = {
    platforms: ['android', 'ios'],
    thresholds: {
        total: 20 * 1024 * 1024, // 20MB
        vendor: 10 * 1024 * 1024, // 10MB  
        app: 5 * 1024 * 1024, // 5MB
        crypto: 3 * 1024 * 1024, // 3MB for CSL
    },
    outputDir: './bundle-reports',
    tempDir: '/tmp'
};

// =========================================================================
// BUNDLE ANALYSIS FUNCTIONS
// =========================================================================

class BundleAnalyzer {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            platforms: {},
            recommendations: [],
            summary: {}
        };
        
        // Ensure output directory exists
        if (!fs.existsSync(config.outputDir)) {
            fs.mkdirSync(config.outputDir, { recursive: true });
        }
    }
    
    /**
     * Run complete bundle analysis
     */
    async analyze() {
        console.log('🔍 Starting Bundle Size Analysis...\n');
        
        try {
            // Analyze each platform
            for (const platform of config.platforms) {
                console.log(`📱 Analyzing ${platform} bundle...`);
                await this.analyzePlatform(platform);
            }
            
            // Generate recommendations
            this.generateRecommendations();
            
            // Create summary
            this.createSummary();
            
            // Save results
            this.saveResults();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Bundle analysis failed:', error.message);
            process.exit(1);
        }
    }
    
    /**
     * Analyze bundle for specific platform
     */
    async analyzePlatform(platform) {
        const bundlePath = path.join(config.tempDir, `index.${platform}.bundle`);
        const mapPath = path.join(config.tempDir, `index.${platform}.bundle.map`);
        
        try {
            // Generate bundle
            console.log(`  📦 Building ${platform} bundle...`);
            execSync(`npx react-native bundle --platform ${platform} --dev false --entry-file index.js --bundle-output ${bundlePath} --sourcemap-output ${mapPath}`, {
                stdio: 'inherit'
            });
            
            // Analyze bundle size
            const bundleStats = this.analyzeBundleFile(bundlePath);
            
            // Analyze source map for detailed breakdown
            const sourceMapAnalysis = this.analyzeSourceMap(mapPath);
            
            this.results.platforms[platform] = {
                ...bundleStats,
                breakdown: sourceMapAnalysis,
                timestamp: new Date().toISOString()
            };
            
            console.log(`  ✅ ${platform} analysis complete`);
            
        } catch (error) {
            console.error(`  ❌ Failed to analyze ${platform}:`, error.message);
            this.results.platforms[platform] = {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Analyze bundle file size and structure
     */
    analyzeBundleFile(bundlePath) {
        const stats = fs.statSync(bundlePath);
        const content = fs.readFileSync(bundlePath, 'utf8');
        
        return {
            size: {
                bytes: stats.size,
                mb: (stats.size / (1024 * 1024)).toFixed(2),
                human: this.formatBytes(stats.size)
            },
            structure: {
                lines: content.split('\n').length,
                modules: this.countModules(content),
                functions: this.countFunctions(content)
            },
            checks: {
                exceedsThreshold: stats.size > config.thresholds.total,
                hasSourceMap: fs.existsSync(bundlePath + '.map'),
                isMinified: this.isMinified(content)
            }
        };
    }
    
    /**
     * Analyze source map for detailed module breakdown
     */
    analyzeSourceMap(mapPath) {
        if (!fs.existsSync(mapPath)) {
            return { error: 'Source map not found' };
        }
        
        try {
            const sourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            
            // Group sources by category
            const breakdown = {
                app: [],
                nodeModules: [],
                crypto: [],
                ui: [],
                total: sourceMap.sources.length
            };
            
            sourceMap.sources.forEach(source => {
                if (source.includes('node_modules')) {
                    if (source.includes('@emurgo') || source.includes('crypto') || source.includes('bip39')) {
                        breakdown.crypto.push(source);
                    } else if (source.includes('react-native') || source.includes('expo')) {
                        breakdown.ui.push(source);
                    } else {
                        breakdown.nodeModules.push(source);
                    }
                } else {
                    breakdown.app.push(source);
                }
            });
            
            return breakdown;
            
        } catch (error) {
            return { error: `Failed to parse source map: ${error.message}` };
        }
    }
    
    /**
     * Generate optimization recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Check bundle sizes
        Object.entries(this.results.platforms).forEach(([platform, data]) => {
            if (data.error) return;
            
            const sizeBytes = data.size.bytes;
            
            if (sizeBytes > config.thresholds.total) {
                recommendations.push({
                    type: 'size',
                    severity: 'high',
                    platform,
                    message: `${platform} bundle (${data.size.human}) exceeds recommended size (${this.formatBytes(config.thresholds.total)})`,
                    actions: [
                        'Enable code splitting',
                        'Implement lazy loading for screens',
                        'Remove unused dependencies',
                        'Use dynamic imports for heavy libraries'
                    ]
                });
            }
            
            // Check crypto libraries
            if (data.breakdown && data.breakdown.crypto.length > 10) {
                recommendations.push({
                    type: 'crypto',
                    severity: 'medium',
                    platform,
                    message: `Large number of crypto modules (${data.breakdown.crypto.length}) detected`,
                    actions: [
                        'Implement lazy loading for CSL',
                        'Tree shake unused crypto functions',
                        'Consider WASM optimization'
                    ]
                });
            }
            
            // Check if minified
            if (!data.checks.isMinified) {
                recommendations.push({
                    type: 'optimization',
                    severity: 'high',
                    platform,
                    message: 'Bundle is not properly minified',
                    actions: [
                        'Enable minification in production',
                        'Configure Terser properly',
                        'Remove development code'
                    ]
                });
            }
        });
        
        this.results.recommendations = recommendations;
    }
    
    /**
     * Create analysis summary
     */
    createSummary() {
        const platforms = Object.keys(this.results.platforms);
        const totalSize = platforms.reduce((sum, platform) => {
            const data = this.results.platforms[platform];
            return sum + (data.size ? data.size.bytes : 0);
        }, 0);
        
        const criticalIssues = this.results.recommendations.filter(r => r.severity === 'high').length;
        const mediumIssues = this.results.recommendations.filter(r => r.severity === 'medium').length;
        
        this.results.summary = {
            totalSize: this.formatBytes(totalSize),
            platforms: platforms.length,
            issues: {
                critical: criticalIssues,
                medium: mediumIssues,
                total: criticalIssues + mediumIssues
            },
            status: criticalIssues > 0 ? 'needs_attention' : mediumIssues > 0 ? 'good' : 'excellent'
        };
    }
    
    /**
     * Save analysis results
     */
    saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `bundle-analysis-${timestamp}.json`;
        const filepath = path.join(config.outputDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        
        // Also save as latest
        const latestPath = path.join(config.outputDir, 'latest.json');
        fs.writeFileSync(latestPath, JSON.stringify(this.results, null, 2));
        
        console.log(`\n📄 Results saved to: ${filepath}`);
    }
    
    /**
     * Display analysis results
     */
    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 BUNDLE SIZE ANALYSIS RESULTS');
        console.log('='.repeat(60));
        
        // Summary
        console.log(`\n📈 Summary:`);
        console.log(`   Total Size: ${this.results.summary.totalSize}`);
        console.log(`   Platforms: ${this.results.summary.platforms}`);
        console.log(`   Status: ${this.getStatusEmoji(this.results.summary.status)} ${this.results.summary.status.toUpperCase()}`);
        
        // Platform details
        console.log(`\n📱 Platform Breakdown:`);
        Object.entries(this.results.platforms).forEach(([platform, data]) => {
            if (data.error) {
                console.log(`   ${platform}: ❌ ${data.error}`);
            } else {
                const status = data.size.bytes > config.thresholds.total ? '⚠️' : '✅';
                console.log(`   ${platform}: ${status} ${data.size.human} (${data.structure.modules} modules)`);
            }
        });
        
        // Recommendations
        if (this.results.recommendations.length > 0) {
            console.log(`\n💡 Recommendations:`);
            this.results.recommendations.forEach((rec, index) => {
                const icon = rec.severity === 'high' ? '🔴' : '🟡';
                console.log(`   ${index + 1}. ${icon} ${rec.message}`);
                rec.actions.forEach(action => {
                    console.log(`      - ${action}`);
                });
            });
        } else {
            console.log(`\n✅ No optimization recommendations - bundle is well optimized!`);
        }
        
        console.log('\n' + '='.repeat(60));
    }
    
    // Helper methods
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    countModules(content) {
        const modulePattern = /__d\s*\(\s*function/g;
        const matches = content.match(modulePattern);
        return matches ? matches.length : 0;
    }
    
    countFunctions(content) {
        const functionPattern = /function\s+\w+/g;
        const arrowPattern = /=>\s*{/g;
        const funcMatches = content.match(functionPattern) || [];
        const arrowMatches = content.match(arrowPattern) || [];
        return funcMatches.length + arrowMatches.length;
    }
    
    isMinified(content) {
        // Simple heuristic: minified code has very long lines
        const lines = content.split('\n');
        const avgLineLength = content.length / lines.length;
        return avgLineLength > 100; // Arbitrary threshold
    }
    
    getStatusEmoji(status) {
        switch (status) {
            case 'excellent': return '🟢';
            case 'good': return '🟡';
            case 'needs_attention': return '🔴';
            default: return '⚪';
        }
    }
}

// =========================================================================
// MAIN EXECUTION
// =========================================================================

if (require.main === module) {
    const analyzer = new BundleAnalyzer();
    analyzer.analyze().catch(error => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
}

module.exports = BundleAnalyzer;

