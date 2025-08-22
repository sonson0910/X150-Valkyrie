#!/usr/bin/env node

/**
 * Comprehensive security testing script
 * Automates security audits and penetration testing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityTester {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0,
                critical: 0
            }
        };
    }

    /**
     * Run all security tests
     */
    async runAllTests() {
        console.log('🔒 Starting comprehensive security testing...\n');

        try {
            // Static analysis tests
            await this.runStaticAnalysis();
            
            // Dependency vulnerability tests
            await this.runDependencyTests();
            
            // Code quality and security tests
            await this.runCodeQualityTests();
            
            // Configuration security tests
            await this.runConfigurationTests();
            
            // Mobile security tests
            await this.runMobileSecurityTests();
            
            // Runtime security tests
            await this.runRuntimeTests();

            this.generateReport();
            return this.results.summary.critical === 0 && this.results.summary.failed === 0;
        } catch (error) {
            console.error('❌ Security testing failed:', error.message);
            return false;
        }
    }

    /**
     * Static analysis security tests
     */
    async runStaticAnalysis() {
        console.log('📋 Running static analysis tests...');

        // ESLint security rules
        await this.runTest('eslint-security', 'ESLint Security Rules', async () => {
            try {
                execSync('npx eslint . --ext .ts,.tsx,.js,.jsx --config .eslintrc.security.js', { stdio: 'pipe' });
                return { status: 'pass', details: 'No security issues found by ESLint' };
            } catch (error) {
                const output = error.stdout?.toString() || error.stderr?.toString() || '';
                const issues = output.split('\n').filter(line => line.includes('error') || line.includes('warning'));
                return { 
                    status: issues.length > 0 ? 'fail' : 'warning', 
                    details: `ESLint found ${issues.length} security issues`,
                    evidence: issues.slice(0, 10) // First 10 issues
                };
            }
        });

        // TypeScript strict mode check
        await this.runTest('typescript-strict', 'TypeScript Strict Mode', async () => {
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
            if (fs.existsSync(tsconfigPath)) {
                const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
                const strict = tsconfig.compilerOptions?.strict;
                return {
                    status: strict ? 'pass' : 'warning',
                    details: strict ? 'TypeScript strict mode enabled' : 'TypeScript strict mode disabled'
                };
            }
            return { status: 'warning', details: 'tsconfig.json not found' };
        });

        // Hardcoded secrets check
        await this.runTest('hardcoded-secrets', 'Hardcoded Secrets Detection', async () => {
            const secretPatterns = [
                /password\s*[:=]\s*['"][^'"]+['"]/gi,
                /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
                /secret\s*[:=]\s*['"][^'"]+['"]/gi,
                /token\s*[:=]\s*['"][^'"]+['"]/gi,
                /private[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi
            ];

            const sourceFiles = this.getSourceFiles();
            const secrets = [];

            for (const file of sourceFiles) {
                const content = fs.readFileSync(file, 'utf8');
                for (const pattern of secretPatterns) {
                    const matches = content.match(pattern);
                    if (matches) {
                        secrets.push({ file: path.relative(process.cwd(), file), matches });
                    }
                }
            }

            return {
                status: secrets.length === 0 ? 'pass' : 'fail',
                details: secrets.length === 0 ? 'No hardcoded secrets found' : `Found ${secrets.length} potential secrets`,
                evidence: secrets.slice(0, 5) // First 5 findings
            };
        });
    }

    /**
     * Dependency vulnerability tests
     */
    async runDependencyTests() {
        console.log('📦 Running dependency security tests...');

        // npm audit
        await this.runTest('npm-audit', 'NPM Security Audit', async () => {
            try {
                const output = execSync('npm audit --json', { stdio: 'pipe' }).toString();
                const audit = JSON.parse(output);
                
                const vulnerabilities = audit.vulnerabilities || {};
                const critical = Object.values(vulnerabilities).filter(v => v.severity === 'critical').length;
                const high = Object.values(vulnerabilities).filter(v => v.severity === 'high').length;
                const total = Object.keys(vulnerabilities).length;

                return {
                    status: critical > 0 ? 'fail' : high > 0 ? 'warning' : 'pass',
                    details: `Found ${total} vulnerabilities (${critical} critical, ${high} high)`,
                    evidence: { total, critical, high, moderate: total - critical - high }
                };
            } catch (error) {
                return { status: 'warning', details: 'npm audit failed to run' };
            }
        });

        // Check for known vulnerable packages
        await this.runTest('vulnerable-packages', 'Known Vulnerable Packages', async () => {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            const knownVulnerable = [
                'event-stream@3.3.6',
                'eslint-scope@3.7.2',
                'flatmap-stream',
                'lodash@<4.17.19'
            ];

            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            const vulnerable = [];

            for (const [pkg, version] of Object.entries(dependencies)) {
                for (const vuln of knownVulnerable) {
                    if (vuln.includes(pkg)) {
                        vulnerable.push({ package: pkg, version, issue: vuln });
                    }
                }
            }

            return {
                status: vulnerable.length === 0 ? 'pass' : 'fail',
                details: vulnerable.length === 0 ? 'No known vulnerable packages' : `Found ${vulnerable.length} vulnerable packages`,
                evidence: vulnerable
            };
        });

        // License compliance check
        await this.runTest('license-check', 'License Compliance', async () => {
            try {
                execSync('npx license-checker --summary', { stdio: 'pipe' });
                return { status: 'pass', details: 'License check completed' };
            } catch (error) {
                return { status: 'warning', details: 'License checker not available' };
            }
        });
    }

    /**
     * Code quality and security tests
     */
    async runCodeQualityTests() {
        console.log('🔍 Running code quality security tests...');

        // Complexity analysis
        await this.runTest('complexity-analysis', 'Code Complexity Analysis', async () => {
            const sourceFiles = this.getSourceFiles();
            let highComplexityFiles = 0;

            for (const file of sourceFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const lines = content.split('\n').length;
                const functions = (content.match(/function\s+\w+|=>\s*{|\w+\s*\([^)]*\)\s*{/g) || []).length;
                
                if (lines > 500 || functions > 20) {
                    highComplexityFiles++;
                }
            }

            return {
                status: highComplexityFiles === 0 ? 'pass' : 'warning',
                details: `${highComplexityFiles} files with high complexity`,
                evidence: { totalFiles: sourceFiles.length, highComplexity: highComplexityFiles }
            };
        });

        // TODO/FIXME security analysis
        await this.runTest('todo-security', 'Security TODOs Analysis', async () => {
            const sourceFiles = this.getSourceFiles();
            const securityTodos = [];

            for (const file of sourceFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const lines = content.split('\n');
                
                lines.forEach((line, index) => {
                    if (line.includes('TODO') || line.includes('FIXME')) {
                        if (line.toLowerCase().includes('security') || 
                            line.toLowerCase().includes('auth') ||
                            line.toLowerCase().includes('encrypt')) {
                            securityTodos.push({
                                file: path.relative(process.cwd(), file),
                                line: index + 1,
                                content: line.trim()
                            });
                        }
                    }
                });
            }

            return {
                status: securityTodos.length === 0 ? 'pass' : 'warning',
                details: `Found ${securityTodos.length} security-related TODOs`,
                evidence: securityTodos.slice(0, 10)
            };
        });
    }

    /**
     * Configuration security tests
     */
    async runConfigurationTests() {
        console.log('⚙️ Running configuration security tests...');

        // Environment file security
        await this.runTest('env-file-security', 'Environment File Security', async () => {
            const envFiles = ['environment.production.js', 'environment.staging.js', '.env', '.env.local'];
            const issues = [];

            for (const envFile of envFiles) {
                if (fs.existsSync(envFile)) {
                    const content = fs.readFileSync(envFile, 'utf8');
                    
                    // Check for hardcoded secrets
                    if (content.includes('password') || 
                        content.includes('secret') || 
                        content.includes('private_key')) {
                        issues.push(`${envFile} may contain hardcoded secrets`);
                    }
                    
                    // Check for production secrets in wrong files
                    if (envFile.includes('development') && 
                        (content.includes('production') || content.includes('mainnet'))) {
                        issues.push(`${envFile} may contain production configuration`);
                    }
                }
            }

            return {
                status: issues.length === 0 ? 'pass' : 'warning',
                details: issues.length === 0 ? 'Environment files are secure' : `Found ${issues.length} configuration issues`,
                evidence: issues
            };
        });

        // Git security check
        await this.runTest('git-security', 'Git Security Configuration', async () => {
            const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
            const requiredIgnores = ['.env', '*.key', '*.pem', 'secrets/', 'node_modules/'];
            const missing = requiredIgnores.filter(pattern => !gitignore.includes(pattern));

            return {
                status: missing.length === 0 ? 'pass' : 'warning',
                details: missing.length === 0 ? 'Git ignore properly configured' : `Missing ${missing.length} security patterns`,
                evidence: missing
            };
        });

        // Package.json security
        await this.runTest('package-security', 'Package.json Security', async () => {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            const issues = [];

            // Check for private flag
            if (!packageJson.private) {
                issues.push('Package should be marked as private');
            }

            // Check for security scripts
            const scripts = packageJson.scripts || {};
            if (!scripts['security:audit'] && !scripts['security:check']) {
                issues.push('Missing security audit scripts');
            }

            return {
                status: issues.length === 0 ? 'pass' : 'warning',
                details: issues.length === 0 ? 'Package.json is secure' : `Found ${issues.length} package issues`,
                evidence: issues
            };
        });
    }

    /**
     * Mobile security tests
     */
    async runMobileSecurityTests() {
        console.log('📱 Running mobile security tests...');

        // React Native security configuration
        await this.runTest('rn-security-config', 'React Native Security Config', async () => {
            const issues = [];

            // Check for debug mode in production
            const appJson = fs.existsSync('app.json') ? JSON.parse(fs.readFileSync('app.json', 'utf8')) : {};
            if (appJson.expo?.development?.developmentClient !== false) {
                issues.push('Development client should be disabled in production');
            }

            // Check for clear text traffic
            const androidManifest = 'android/app/src/main/AndroidManifest.xml';
            if (fs.existsSync(androidManifest)) {
                const content = fs.readFileSync(androidManifest, 'utf8');
                if (content.includes('android:usesCleartextTraffic="true"')) {
                    issues.push('Clear text traffic should be disabled');
                }
            }

            return {
                status: issues.length === 0 ? 'pass' : 'warning',
                details: issues.length === 0 ? 'Mobile configuration is secure' : `Found ${issues.length} mobile security issues`,
                evidence: issues
            };
        });

        // Expo security configuration
        await this.runTest('expo-security', 'Expo Security Configuration', async () => {
            const appJson = fs.existsSync('app.json') ? JSON.parse(fs.readFileSync('app.json', 'utf8')) : {};
            const expo = appJson.expo || {};
            const issues = [];

            // Check for security plugins
            const plugins = expo.plugins || [];
            const hasSecurityPlugins = plugins.some(plugin => 
                plugin.includes('security') || plugin.includes('pinning')
            );

            if (!hasSecurityPlugins) {
                issues.push('Consider adding security plugins');
            }

            // Check scheme configuration
            if (expo.scheme && expo.scheme === 'exp') {
                issues.push('Should use custom URL scheme for security');
            }

            return {
                status: issues.length === 0 ? 'pass' : 'warning',
                details: issues.length === 0 ? 'Expo configuration is secure' : `Found ${issues.length} Expo security suggestions`,
                evidence: issues
            };
        });
    }

    /**
     * Runtime security tests
     */
    async runRuntimeTests() {
        console.log('🏃 Running runtime security tests...');

        // Bundle analysis
        await this.runTest('bundle-analysis', 'Bundle Security Analysis', async () => {
            const bundleFiles = ['dist/', 'build/', 'web-build/'];
            let bundleExists = false;

            for (const dir of bundleFiles) {
                if (fs.existsSync(dir)) {
                    bundleExists = true;
                    break;
                }
            }

            if (!bundleExists) {
                return { status: 'warning', details: 'No build artifacts found - run build first' };
            }

            // Check for source maps in production
            const sourceMapFiles = this.findFiles('.', /\.map$/);
            
            return {
                status: sourceMapFiles.length === 0 ? 'pass' : 'warning',
                details: sourceMapFiles.length === 0 ? 'No source maps in build' : `Found ${sourceMapFiles.length} source map files`,
                evidence: sourceMapFiles.slice(0, 5)
            };
        });

        // Runtime configuration check
        await this.runTest('runtime-config', 'Runtime Configuration Security', async () => {
            const issues = [];

            // Check for console logs in production code
            const sourceFiles = this.getSourceFiles();
            let consoleLogCount = 0;

            for (const file of sourceFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const matches = content.match(/console\.(log|warn|error|info)/g);
                if (matches) {
                    consoleLogCount += matches.length;
                }
            }

            if (consoleLogCount > 10) {
                issues.push(`Found ${consoleLogCount} console statements - consider removing for production`);
            }

            return {
                status: issues.length === 0 ? 'pass' : 'warning',
                details: issues.length === 0 ? 'Runtime configuration is clean' : `Found ${issues.length} runtime issues`,
                evidence: issues
            };
        });
    }

    /**
     * Run individual test
     */
    async runTest(id, name, testFunction) {
        console.log(`  🔹 ${name}...`);
        
        try {
            const result = await testFunction();
            const test = {
                id,
                name,
                timestamp: new Date().toISOString(),
                ...result
            };

            this.results.tests.push(test);
            this.updateSummary(test);

            const icon = {
                'pass': '✅',
                'warning': '⚠️',
                'fail': '❌'
            }[result.status] || '❓';

            console.log(`    ${icon} ${result.details}`);

            return test;
        } catch (error) {
            const test = {
                id,
                name,
                timestamp: new Date().toISOString(),
                status: 'fail',
                details: `Test failed: ${error.message}`,
                evidence: { error: error.message }
            };

            this.results.tests.push(test);
            this.updateSummary(test);

            console.log(`    ❌ Test failed: ${error.message}`);
            return test;
        }
    }

    /**
     * Update test summary
     */
    updateSummary(test) {
        this.results.summary.total++;
        
        switch (test.status) {
            case 'pass':
                this.results.summary.passed++;
                break;
            case 'warning':
                this.results.summary.warnings++;
                break;
            case 'fail':
                this.results.summary.failed++;
                if (test.severity === 'critical') {
                    this.results.summary.critical++;
                }
                break;
        }
    }

    /**
     * Generate comprehensive security report
     */
    generateReport() {
        console.log('\n📊 Security Test Summary');
        console.log('=' .repeat(50));
        console.log(`Total Tests: ${this.results.summary.total}`);
        console.log(`✅ Passed: ${this.results.summary.passed}`);
        console.log(`⚠️  Warnings: ${this.results.summary.warnings}`);
        console.log(`❌ Failed: ${this.results.summary.failed}`);
        console.log(`🔴 Critical: ${this.results.summary.critical}`);

        const score = Math.round(((this.results.summary.passed + this.results.summary.warnings * 0.5) / this.results.summary.total) * 100);
        console.log(`📈 Security Score: ${score}%`);
        console.log();

        // Save detailed report
        const reportPath = 'security-test-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`📄 Detailed report saved to ${reportPath}`);

        // Generate recommendations
        this.generateRecommendations();
    }

    /**
     * Generate security recommendations
     */
    generateRecommendations() {
        const failedTests = this.results.tests.filter(t => t.status === 'fail');
        const warningTests = this.results.tests.filter(t => t.status === 'warning');

        if (failedTests.length > 0 || warningTests.length > 0) {
            console.log('\n🔧 Security Recommendations:');
            console.log('=' .repeat(50));

            failedTests.forEach(test => {
                console.log(`❌ HIGH PRIORITY: Fix ${test.name}`);
                console.log(`   ${test.details}`);
            });

            warningTests.forEach(test => {
                console.log(`⚠️  MEDIUM PRIORITY: Review ${test.name}`);
                console.log(`   ${test.details}`);
            });
        }
    }

    /**
     * Utility methods
     */
    getSourceFiles() {
        return this.findFiles('src', /\.(ts|tsx|js|jsx)$/);
    }

    findFiles(dir, pattern) {
        const files = [];
        
        if (!fs.existsSync(dir)) return files;

        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                files.push(...this.findFiles(fullPath, pattern));
            } else if (stat.isFile() && pattern.test(item)) {
                files.push(fullPath);
            }
        }
        
        return files;
    }
}

// Run security tests if script is executed directly
if (require.main === module) {
    const tester = new SecurityTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Security testing failed:', error);
        process.exit(1);
    });
}

module.exports = SecurityTester;

