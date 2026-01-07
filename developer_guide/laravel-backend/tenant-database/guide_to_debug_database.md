# **Developer Guide: Debugging Database Migration Issues**

## 📋 **Today's Problem Recap**

### **What Happened**
1. **Symptoms**: BrandingControllerTest failing with `SQLSTATE[42P01]: Undefined table: 7 FEHLER: Relation »tenants« existiert nicht`
2. **Root Cause**: Migrations not executing in correct order during tests
3. **Dependencies**: `tenant_brandings` table has foreign key to `tenants.numeric_id`, but `numeric_id` column added by separate migration

### **The Debugging Journey**
```
1. Initial Error: "tenants table doesn't exist"
   → Checked: Test migration configuration
   → Found: Only base migrations running

2. Manual Test: "migrate --path=..." works
   → Realized: Migration files exist but order wrong

3. Foreign Key Error: "numeric_id column doesn't exist"
   → Discovered: tenants.numeric_id added by separate migration (2025_12_13_120310_...)

4. WCAG Error: "Branding violates WCAG standards"
   → Debugged: Domain layer validation failing
   → Fixed: Use BrandingColor::defaultPrimary()/defaultSecondary()

5. Solution: Specify exact migration order in tests
```

## 🔧 **Essential Debugging Skills for Laravel DDD Projects**

### **1. Database Investigation Skills**

#### **Check Database State**
```bash
# PostgreSQL specific
psql -h localhost -U postgres -d publicdigit_test -c "\dt"  # List tables
psql -h localhost -U postgres -d publicdigit_test -c "\d tenants"  # Describe table

# Laravel Tinker
php artisan tinker --env=testing
> \DB::connection('landlord_test')->getSchemaBuilder()->getColumnListing('tenants')
> \DB::connection('landlord_test')->select("SELECT * FROM pg_tables WHERE schemaname = 'public'")
```

#### **Migration Status**
```bash
# Check what migrations have run
php artisan migrate:status --database=landlord_test --env=testing

# Check migration files
find . -name "*create_tenants*" -type f
find . -name "*numeric_id*" -type f
```

### **2. Laravel Test Debugging Skills**

#### **Test Execution Flow**
```php
// Add debug to understand test lifecycle
protected function setUp(): void
{
    parent::setUp();
    \Log::debug('Test setUp() executing');
}

protected function beforeRefreshingDatabase(): void
{
    \Log::debug('beforeRefreshingDatabase: ' . config('database.default'));
}

protected function afterRefreshingDatabase(): void
{
    \Log::debug('afterRefreshingDatabase: Checking tables...');
    $tables = \DB::connection('landlord_test')
        ->select("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    \Log::debug('Tables: ' . json_encode(array_column($tables, 'tablename')));
}
```

#### **Check Laravel Logs**
```bash
# Tail logs during test execution
tail -f storage/logs/laravel.log | grep -E "(ERROR|DEBUG|tenants|migration)"

# Clear and watch
> storage/logs/laravel.log
php artisan test --filter=BrandingControllerTest 2>&1 | tee test_output.log
```

### **3. Domain-Driven Design Debugging Skills**

#### **Follow the Data Flow**
```
API Request → Controller → Application Service → Domain Entity → Repository → Database
```

**Check each layer:**
```php
// 1. Check if controller receives request
\Log::debug('Controller hit: ' . request()->fullUrl());

// 2. Check Domain validation
// Look at Domain/Entities/TenantBranding.php validateWcagCompliance()

// 3. Check Repository queries
// Look at Infrastructure/Repositories/EloquentTenantBrandingRepository.php
```

#### **Value Object Debugging**
```php
// Test Value Objects in isolation
php artisan tinker --env=testing
> $color = new \App\Contexts\Platform\Domain\ValueObjects\BrandingColor('#1976D2')
> echo $color->isAccessibleOnWhite() ? 'PASS' : 'FAIL'
> echo "Contrast: " . $color->getContrastRatio(\App\Contexts\Platform\Domain\ValueObjects\BrandingColor::fromString('#FFFFFF'))
```

### **4. Migration Dependency Analysis**

#### **Create Migration Dependency Graph**
```bash
# Analyze foreign keys
grep -r "references\|foreign\|Foreign" database/migrations/ app/Contexts/ --include="*.php"

# Example output analysis:
# tenant_brandings references tenants(numeric_id)
# Need: tenants table → add numeric_id → tenant_brandings table
```

#### **Manual Migration Testing**
```bash
# Test migration sequence manually
php artisan db:wipe --database=landlord_test --env=testing --force

# Step 1: Just tenants
php artisan migrate --database=landlord_test \
  --path=database/migrations/2025_09_24_210000_create_tenants_table.php \
  --env=testing --force

# Step 2: Add numeric_id
php artisan migrate --database=landlord_test \
  --path=database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php \
  --env=testing --force

# Step 3: Platform tables
php artisan migrate --database=landlord_test \
  --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord \
  --env=testing --force
```

### **5. System Architecture Understanding**

#### **Know Your Project Structure**
```bash
# Context-based architecture
app/Contexts/
├── Platform/                    # Landlord/tenant management
│   ├── Domain/                 # Business rules
│   ├── Application/            # Use cases
│   └── Infrastructure/         # Database, APIs
├── ElectionSetup/              # Election management
└── Membership/                 # Member management

# Migration organization (Rule 13)
Context/Infrastructure/Database/Migrations/
├── Landlord/                   # Cross-tenant tables
└── Tenant/                     # Per-tenant tables
```

#### **Configuration Checks**
```bash
# Check database connections
php artisan tinker --env=testing
> config('database.connections.landlord_test')
> config('database.default')

# Check .env.testing
cat .env.testing | grep -i "test\|database"
```

## 🛠️ **Debugging Toolkit Commands**

### **Quick Diagnostic Script**
Create `scripts/diagnose.sh`:
```bash
#!/bin/bash
echo "🔍 Running diagnostics..."

echo "1. Database Connections:"
php artisan tinker --env=testing << 'EOD'
echo "Default: " . config('database.default');
$conn = \DB::connection('landlord_test');
echo "Landlord Test DB: " . ($conn->getDatabaseName() ?? 'NOT CONNECTED');
EOD

echo "\n2. Migration Files:"
find . -path ./vendor -prune -o -name "*tenant*" -name "*.php" -type f -print | head -10

echo "\n3. Recent Errors:"
tail -5 storage/logs/laravel.log

echo "\n4. Test Database State:"
php artisan tinker --env=testing << 'EOD'
try {
    $tables = \DB::connection('landlord_test')
        ->select("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    echo "Tables: " . count($tables) . "\n";
    foreach ($tables as $t) echo "  - " . $t->tablename . "\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
EOD
```

### **Test-Specific Debug Commands**
```bash
# Run single test with maximum output
php artisan test --filter=test_show_returns_custom_branding_for_tenant \
  --env=testing \
  --stop-on-failure \
  --verbose

# Clear test database and start fresh
php artisan db:wipe --database=landlord_test --env=testing --force
php artisan migrate:status --database=landlord_test --env=testing

# Check what the test actually does
grep -n "createTestTenant\|createTestBranding" tests/Feature/Contexts/Platform/Api/V1/Public/BrandingControllerTest.php -B2 -A2
```

## 📚 **Learning Resources for Developers**

### **Must-Know Concepts**
1. **Laravel Testing Lifecycle**: `setUp()`, `RefreshDatabase`, `before/afterRefreshingDatabase()`
2. **Database Migrations**: Order dependencies, foreign keys, rollbacks
3. **DDD Layers**: Domain (business rules), Application (use cases), Infrastructure (implementation)
4. **PostgreSQL**: `\dt`, `\d table`, foreign key constraints
5. **PHP Debugging**: `dd()`, `dump()`, `\Log::debug()`, exception tracing

### **Common Pitfalls to Watch For**
1. **Migration Order**: Tables with foreign keys must be created after referenced tables
2. **Test Database**: `.env.testing` vs `.env`, different connections
3. **Domain Validation**: Value Objects may have strict validation (like WCAG colors)
4. **Context Isolation**: Platform vs Tenant contexts, Landlord vs Tenant databases
5. **RefreshDatabase Trait**: May not work with custom migration paths

## 🎯 **Step-by-Step Debugging Checklist**

**When Tests Fail with Database Errors:**

### **Phase 1: Initial Diagnosis**
- [ ] Check error message - what's missing? (table, column, constraint)
- [ ] Run `migrate:status` - what migrations have run?
- [ ] Check test database - what tables exist?
- [ ] Look at test `setUp()` and `migrateFreshUsing()` methods

### **Phase 2: Manual Verification**
- [ ] Can you run migrations manually? (`php artisan migrate --path=...`)
- [ ] Does the database schema look correct? (`psql \d table`)
- [ ] Are foreign key dependencies satisfied?
- [ ] Do Value Objects validate correctly? (test in tinker)

### **Phase 3: System Analysis**
- [ ] Check migration dependencies (grep for `references`, `foreign`)
- [ ] Verify `.env.testing` configuration
- [ ] Check if context migrations are registered (`loadMigrationsFrom()`)
- [ ] Look at Domain layer validation rules

### **Phase 4: Solution Design**
- [ ] Determine correct migration order
- [ ] Fix test configuration or create helper methods
- [ ] Consider architectural changes (consolidate migrations, better organization)
- [ ] Document the fix for other developers

## 📝 **Post-Mortem Documentation Template**

```markdown
## Issue: [Brief description]
**Date**: 2026-01-06
**Symptoms**: Tests failing with [error]
**Root Cause**: [What was actually wrong]
**Solution**: [What fixed it]
**Prevention**: [How to avoid in future]

### Debugging Steps Taken:
1. [Step 1 with command/output]
2. [Step 2 with command/output]
3. [Step 3 with command/output]

### Lessons Learned:
- [Architectural insight]
- [Debugging technique]
- [Configuration requirement]

### Code Changes Required:
- [ ] File 1: Change description
- [ ] File 2: Change description
- [ ] Documentation update
```

## 🚀 **Final Advice for Developers**

1. **Start Simple**: Test migrations manually before debugging complex test failures
2. **Check Logs**: Laravel logs contain valuable context
3. **Isolate Problems**: Use `tinker` to test components in isolation
4. **Understand DDD**: Know which layer is failing (Domain, Application, Infrastructure)
5. **Document Findings**: Create runbooks for common issues

**Remember**: Today's problem was a **migration dependency issue** masked by **test configuration problems** and **domain validation errors**. Each layer needed separate debugging.

---

*This guide based on actual debugging session from 2026-01-06. Save it for onboarding new developers and future reference.*