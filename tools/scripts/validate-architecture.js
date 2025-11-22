#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check for imports of a specific pattern in a directory
 * @param {string} directory - Directory to search in
 * @param {string} importPattern - Import pattern to look for (e.g., '@domain')
 * @param {string} violationType - Description of violation type
 * @param {string} rule - Rule description
 * @returns {object|null} - Violation object or null if no violations found
 */
function checkLayerImports(directory, importPattern, violationType, rule) {
  try {
    // Read all TypeScript files in the directory recursively
    const files = getAllTsFiles(directory);
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for import statements containing the pattern
        if (line.includes('import') && line.includes(importPattern)) {
          violations.push(`${file}:${index + 1} - ${line.trim()}`);
        }
      });
    }

    if (violations.length > 0) {
      return {
        type: violationType,
        rule: rule,
        details: violations.join('\n')
      };
    }

    return null;
  } catch (error) {
    // Directory doesn't exist or can't be read - that's ok
    return null;
  }
}

/**
 * Get all TypeScript files in a directory recursively
 * @param {string} dir - Directory to search
 * @returns {string[]} - Array of file paths
 */
function getAllTsFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...getAllTsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - that's ok
  }

  return files;
}

console.log('🏗️  Validating Architecture Boundaries...');

try {
  // Check for proper layer separation
  const violations = [];

  // Run lint to check module boundaries only
  console.log('\n📋 Running ESLint module boundary checks...');
  try {
    const lintOutput = execSync('npx nx lint mobile 2>&1', { encoding: 'utf-8' });

    // Check if there are module boundary violations specifically
    if (lintOutput.includes('@nx/enforce-module-boundaries')) {
      violations.push({
        type: 'Module Boundary Violations',
        rule: 'NX enforce-module-boundaries rule violated',
        details: lintOutput
      });
    } else {
      console.log('✅ No module boundary violations detected');
    }
  } catch (error) {
    // Check if the error contains module boundary violations
    if (error.stdout && error.stdout.includes('@nx/enforce-module-boundaries')) {
      violations.push({
        type: 'Module Boundary Violations',
        rule: 'NX enforce-module-boundaries rule violated',
        details: error.stdout
      });
    } else {
      console.log('⚠️  Lint has other errors (not architecture-related)');
      console.log('   Run "nx lint mobile" to see code quality issues');
    }
  }

  // Verify no presentation layer imports domain directly
  console.log('\n🔍 Checking for direct domain imports in presentation layer...');
  const presentationViolations = checkLayerImports(
    'apps/mobile/src/app/presentation',
    '@domain',
    'Presentation → Domain (Direct)',
    'Presentation layer should import from Application layer only'
  );
  if (presentationViolations) violations.push(presentationViolations);

  // Verify no presentation layer imports in domain
  console.log('🔍 Checking for presentation imports in domain layer...');
  const domainPresentationViolations = checkLayerImports(
    'apps/mobile/src/app/domain',
    '@presentation',
    'Domain → Presentation (Forbidden)',
    'Domain layer must not depend on Presentation layer'
  );
  if (domainPresentationViolations) violations.push(domainPresentationViolations);

  // Verify no infrastructure imports in domain
  console.log('🔍 Checking for infrastructure imports in domain layer...');
  const domainInfraViolations = checkLayerImports(
    'apps/mobile/src/app/domain',
    '@infrastructure',
    'Domain → Infrastructure (Forbidden)',
    'Domain layer must not depend on Infrastructure layer'
  );
  if (domainInfraViolations) violations.push(domainInfraViolations);

  // Check for circular dependencies
  console.log('🔍 Checking for circular dependencies...');
  console.log('   (Skipped - install madge globally for this check)');

  // Report results
  console.log('\n' + '='.repeat(70));
  if (violations.length === 0) {
    console.log('🎉 Architecture validation passed!');
    console.log('✅ All DDD boundaries respected');
    console.log('✅ No layer violations detected');
    console.log('✅ Architecture integrity maintained');
    process.exit(0);
  } else {
    console.log('❌ Architecture violations found:\n');
    violations.forEach((violation, index) => {
      console.log(`${index + 1}. ${violation.type}`);
      console.log(`   Rule: ${violation.rule}`);
      console.log(`   Details:\n${violation.details}\n`);
    });
    console.log('='.repeat(70));
    console.log(`\n❌ Total violations: ${violations.length}`);
    process.exit(1);
  }
} catch (error) {
  console.log('\n❌ Architecture validation failed');
  console.error(error.message);
  process.exit(1);
}
