#!/usr/bin/env node
/**
 * Architecture Health Check Script
 *
 * Cross-platform compatible health monitoring for DDD architecture
 *
 * @version 1.0.0
 * @generated 2025-11-22
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ArchitectureHealthCheck {
  constructor() {
    this.violations = [];
    this.checks = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const symbols = { info: '🔍', success: '✅', error: '❌', warning: '⚠️' };
    console.log(`${symbols[type]} [${timestamp.split('T')[1].split('.')[0]}] ${message}`);
  }

  async runCheck(name, checkFn) {
    try {
      this.log(`Running: ${name}`);
      await checkFn();
      this.checks.push({ name, status: 'passed' });
      this.log(`${name}: PASSED`, 'success');
    } catch (error) {
      this.checks.push({ name, status: 'failed', error: error.message });
      this.violations.push(`${name}: ${error.message}`);
      this.log(`${name}: FAILED - ${error.message}`, 'error');
    }
  }

  // Cross-platform file search
  findFiles(pattern, directory) {
    const results = [];
    const searchDir = directory || process.cwd();

    function walk(dir) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          let stat;
          try {
            stat = fs.statSync(filePath);
          } catch (err) {
            continue; // Skip inaccessible files
          }

          if (stat.isDirectory()) {
            walk(filePath);
          } else if (file.match(pattern)) {
            results.push(filePath);
          }
        }
      } catch (error) {
        // Directory might not exist or be inaccessible
      }
    }

    try {
      walk(searchDir);
    } catch (error) {
      // Directory doesn't exist
    }
    return results;
  }

  countImports(filePath, importPattern) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      return lines.filter(line => line.includes('import') && line.includes(importPattern)).length;
    } catch (error) {
      return 0;
    }
  }

  async checkModuleBoundaries() {
    try {
      execSync('npx nx run mobile:validate-architecture', {
        stdio: 'pipe',
        encoding: 'utf8'
      });
    } catch (error) {
      throw new Error('Module boundary violations detected');
    }
  }

  async checkLayerSeparation() {
    // Check Presentation → Domain violations
    const presentationFiles = this.findFiles(/\.ts$/, 'apps/mobile/src/app/presentation');
    let domainImports = 0;

    for (const file of presentationFiles) {
      domainImports += this.countImports(file, 'from "@domain');
      domainImports += this.countImports(file, "from '@domain");
    }

    if (domainImports > 0) {
      throw new Error(`Presentation layer contains ${domainImports} direct domain imports`);
    }

    // Check Domain → Infrastructure violations
    const domainFiles = this.findFiles(/\.ts$/, 'apps/mobile/src/app/domain');
    let infrastructureImports = 0;

    for (const file of domainFiles) {
      infrastructureImports += this.countImports(file, 'from "@infrastructure');
      infrastructureImports += this.countImports(file, "from '@infrastructure");
    }

    if (infrastructureImports > 0) {
      throw new Error(`Domain layer contains ${infrastructureImports} infrastructure imports`);
    }

    // Check Domain → Presentation violations
    let presentationImportsInDomain = 0;

    for (const file of domainFiles) {
      presentationImportsInDomain += this.countImports(file, 'from "@presentation');
      presentationImportsInDomain += this.countImports(file, "from '@presentation");
    }

    if (presentationImportsInDomain > 0) {
      throw new Error(`Domain layer contains ${presentationImportsInDomain} presentation imports`);
    }
  }

  async checkBuildConfiguration() {
    const projectJsonPath = 'apps/mobile/project.json';
    if (!fs.existsSync(projectJsonPath)) {
      throw new Error('Project configuration not found');
    }

    const projectConfig = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    const buildTarget = projectConfig.targets?.build;

    if (!buildTarget) {
      throw new Error('Build target not found in project configuration');
    }

    if (!buildTarget?.dependsOn?.includes('validate-architecture')) {
      throw new Error('Build target missing architecture validation dependency');
    }
  }

  async checkGenerators() {
    const generatorsPath = 'tools/generators/domain-layer';
    if (!fs.existsSync(generatorsPath)) {
      throw new Error('Domain layer generators not found');
    }

    const requiredTemplates = [
      'entity/__fileName__.entity.ts__tmpl__',
      'value-object/__fileName__.vo.ts__tmpl__',
      'repository/__fileName__.repository.ts__tmpl__',
      'service/__fileName__.service.ts__tmpl__',
      'event/__fileName__.event.ts__tmpl__'
    ];

    const missingTemplates = [];
    for (const template of requiredTemplates) {
      const templatePath = path.join(generatorsPath, 'files', template);
      if (!fs.existsSync(templatePath)) {
        missingTemplates.push(template);
      }
    }

    if (missingTemplates.length > 0) {
      throw new Error(`Missing generator templates: ${missingTemplates.join(', ')}`);
    }
  }

  async checkValidationScript() {
    const validationScriptPath = 'tools/scripts/validate-architecture.js';
    if (!fs.existsSync(validationScriptPath)) {
      throw new Error('Architecture validation script not found');
    }
  }

  async run() {
    console.log('🏥 Architecture Health Check');
    console.log('=============================\n');

    await this.runCheck('Module Boundaries', () => this.checkModuleBoundaries());
    await this.runCheck('Layer Separation', () => this.checkLayerSeparation());
    await this.runCheck('Build Configuration', () => this.checkBuildConfiguration());
    await this.runCheck('Code Generators', () => this.checkGenerators());
    await this.runCheck('Validation Script', () => this.checkValidationScript());

    console.log('\n📊 Health Check Summary');
    console.log('=====================');

    const passed = this.checks.filter(c => c.status === 'passed').length;
    const failed = this.checks.filter(c => c.status === 'failed').length;

    console.log(`Total Checks: ${this.checks.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (this.violations.length > 0) {
      console.log('\n🚨 Architecture Violations Detected:');
      this.violations.forEach(violation => {
        console.log(`   • ${violation}`);
      });
      process.exit(1);
    } else {
      console.log('\n🎉 Architecture Health: EXCELLENT');
      console.log('All systems operational and boundaries respected.');
      process.exit(0);
    }
  }
}

// Run the health check
new ArchitectureHealthCheck().run().catch(error => {
  console.error('💥 Health check failed:', error);
  process.exit(1);
});
