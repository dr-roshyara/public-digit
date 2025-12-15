## Claude CLI Prompt Instructions to Solve Tenant Provisioning Admin User Problem

```bash
# ============================================================================
# CLAUDE CLI INSTRUCTIONS: FIX TENANT PROVISIONING ADMIN USER ISSUE
# ============================================================================
# Problem: "Admin user not found in tenant database" during password setup
# Root Cause: initializeTenantConfiguration() doesn't create admin user
# ============================================================================

# PHASE 1: DIAGNOSTIC - Check Current State
echo "🔍 PHASE 1: DIAGNOSTIC - Checking Current State"
echo "================================================"

# 1. Check tenant_uml database
mysql -u softcrew -p << 'MYSQL'
-- Check landlord database for tenant info
USE election;
SELECT id, slug, name, email, database_name, status FROM tenants WHERE slug = 'uml';

-- Check tenant_uml database
SHOW DATABASES LIKE 'tenant_uml';
USE tenant_uml;
SHOW TABLES;
SELECT COUNT(*) as user_count FROM tenant_users;
SELECT email, status FROM tenant_users;
MYSQL

# 2. Check provisioning code
echo ""
echo "📁 Checking provisioning code structure..."
grep -n -A 20 "initializeTenantConfiguration" packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/TenantProvisioningService.php

# 3. Check SecureSetupTokenService
echo ""
echo "🔎 Looking for SecureSetupTokenService..."
find packages/laravel-backend -name "*SecureSetupTokenService*.php" -type f 2>/dev/null

# ============================================================================
# PHASE 2: MANUAL FIX - Create Admin User for Existing Tenant
# ============================================================================
echo ""
echo "🔧 PHASE 2: MANUAL FIX - Create Admin User for tenant_uml"
echo "=========================================================="

# Create Tinker script to fix tenant_uml
cat > fix_tenant_uml.php << 'PHP'
<?php
// Run in Tinker: php artisan tinker < fix_tenant_uml.php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;

echo "🔧 Fixing tenant_uml admin user...\n";

// 1. Connect to tenant_uml
config(['database.connections.tenant.database' => 'tenant_uml']);
DB::purge('tenant');

// 2. Check if migrations ran
$tables = DB::connection('tenant')->select('SHOW TABLES');
echo "Tables in tenant_uml:\n";
foreach ($tables as $table) {
    echo "- " . $table->Tables_in_tenant_uml . "\n";
}

// 3. Run migrations if tenant_users doesn't exist
$hasTenantUsers = collect($tables)->contains(function($t) {
    return $t->Tables_in_tenant_uml === 'tenant_users';
});

if (!$hasTenantUsers) {
    echo "Running migrations...\n";
    Artisan::call('migrate', [
        '--database' => 'tenant',
        '--path' => 'packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
        '--force' => true,
    ]);
    echo Artisan::output();
}

// 4. Create admin user
$adminEmail = 'krish.hari.sharma@gmail.com';
$userExists = DB::connection('tenant')
    ->table('tenant_users')
    ->where('email', $adminEmail)
    ->exists();

if ($userExists) {
    echo "✅ Admin user already exists\n";
    $user = DB::connection('tenant')
        ->table('tenant_users')
        ->where('email', $adminEmail)
        ->first();
    echo "User ID: {$user->id}, Status: {$user->status}\n";
} else {
    echo "Creating admin user...\n";
    
    // Extract name from email
    $emailUsername = explode('@', $adminEmail)[0];
    $nameParts = explode('.', $emailUsername);
    
    $firstName = ucfirst($nameParts[0] ?? 'Krish');
    $lastName = '';
    
    if (isset($nameParts[1])) $lastName .= ucfirst($nameParts[1]) . ' ';
    if (isset($nameParts[2])) $lastName .= ucfirst($nameParts[2]);
    $lastName = trim($lastName) ?: 'Hari Sharma';
    
    // Insert admin user with all required columns
    $userId = DB::connection('tenant')->table('tenant_users')->insertGetId([
        'email' => $adminEmail,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'uuid' => \Illuminate\Support\Str::uuid(),
        'password_hash' => null,
        'status' => 'pending',
        'email_verified_at' => null,
        'phone' => null,
        'phone_country_code' => '+1',
        'phone_verified_at' => null,
        'failed_login_attempts' => 0,
        'locked_until' => null,
        'must_change_password' => 0,
        'tenant_id' => 1, // Adjust as needed
        'metadata' => json_encode(['is_initial_admin' => true]),
        'identity_data' => null,
        'address_data' => null,
        'professional_data' => null,
        'communication_preferences' => null,
        'last_login_at' => null,
        'created_at' => now(),
        'updated_at' => now(),
        'created_by_id' => null,
        'updated_by_id' => null,
        'deleted_at' => null,
    ]);
    
    echo "✅ Admin user created with ID: {$userId}\n";
    echo "Name: {$firstName} {$lastName}\n";
    echo "Status: pending (will activate after password setup)\n";
}

echo "\n✅ Fix completed. Try password setup again.\n";
?>
PHP

echo "✅ Created fix script: fix_tenant_uml.php"
echo "Run with: php artisan tinker < fix_tenant_uml.php"

# ============================================================================
# PHASE 3: CODE FIX - Update Provisioning Service
# ============================================================================
echo ""
echo "💻 PHASE 3: CODE FIX - Update Provisioning Service"
echo "=================================================="

# Create the updated initializeTenantConfiguration method
cat > update_provisioning_service.sh << 'BASH'
#!/bin/bash

echo "Updating TenantProvisioningService.php..."

# Backup original
cp packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/TenantProvisioningService.php \
   packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/TenantProvisioningService.php.backup

# Create sed commands to update the method
cat > update_provisioning.sed << 'SED'
/private function initializeTenantConfiguration/,/^    \}/ {
    /private function initializeTenantConfiguration/ {
        n
        n
        n
        n
        n
        n
        n
        n
        n
        n
        a\
        \        // Switch to tenant database\
        \        \$this->databaseManager->switchToTenantConnection(\$tenant);\
        \\n\
        \        // Get the tenant connection name\
        \        \$connectionName = \$this->databaseManager->getTenantConnectionName(\$tenant);\
        \\n\
        \        // Ensure we're connected to the right database\
        \        config([\
        \            "database.connections.{\$connectionName}.database" => \$tenant->getDatabaseName() \
        \                ?? \$this->databaseManager->generateDatabaseName(\$tenant->getSlug())->getValue()\
        \        ]);\
        \\n\
        \        DB::purge(\$connectionName);\
        \        DB::reconnect(\$connectionName);\
        \\n\
        \        // 1. CREATE ADMIN USER\
        \        \$this->createAdminUser(\$tenant);\
        \\n\
        \        // 2. INITIALIZE DEFAULT ROLES AND PERMISSIONS\
        \        \$this->initializeDefaultRolesAndPermissions(\$tenant);\
        \\n\
        \        // 3. ASSIGN ADMIN ROLE TO THE USER\
        \        \$this->assignAdminRole(\$tenant);\
        \\n\
        \        Log::info('Tenant configuration initialized', [\
        \            'tenant_id' => \$tenant->getId(),\
        \            'admin_email' => \$tenant->getAdminEmail(),\
        \        ]);
    }
    /\/\/ This would typically involve seeding the tenant database/d
    /Log::info('Tenant configuration initialized'/d
}
SED

# Apply the update
sed -i -f update_provisioning.sed packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/TenantProvisioningService.php

# Add the helper methods at the end of the class
cat >> packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/TenantProvisioningService.php << 'METHODS'

    /**
     * Create admin user in tenant database
     */
    private function createAdminUser(Tenant \$tenant): void
    {
        \$adminEmail = \$tenant->getAdminEmail();
        
        if (!\$adminEmail) {
            throw new Exception("No admin email found for tenant");
        }
        
        // Check if user already exists
        \$existingUser = DB::connection('tenant')
            ->table('tenant_users')
            ->where('email', \$adminEmail)
            ->first();
        
        if (\$existingUser) {
            Log::warning('Admin user already exists in tenant database', [
                'tenant_id' => \$tenant->getId(),
                'email' => \$adminEmail,
            ]);
            return;
        }
        
        // Extract name from email
        \$emailUsername = explode('@', \$adminEmail)[0];
        \$nameParts = explode('.', \$emailUsername);
        
        \$firstName = ucfirst(\$nameParts[0] ?? 'Admin');
        \$lastName = '';
        
        for (\$i = 1; \$i < count(\$nameParts); \$i++) {
            if (\$i > 1) \$lastName .= ' ';
            \$lastName .= ucfirst(\$nameParts[\$i]);
        }
        
        if (empty(\$lastName)) {
            \$lastName = 'User';
        }
        
        // Create the admin user
        \$userId = DB::connection('tenant')->table('tenant_users')->insertGetId([
            'email' => \$adminEmail,
            'first_name' => \$firstName,
            'last_name' => \$lastName,
            'uuid' => \\Illuminate\\Support\\Str::uuid(),
            'password_hash' => null,
            'status' => 'pending',
            'email_verified_at' => null,
            'phone' => null,
            'phone_country_code' => '+1',
            'phone_verified_at' => null,
            'failed_login_attempts' => 0,
            'locked_until' => null,
            'must_change_password' => 0,
            'tenant_id' => \$tenant->getId(),
            'metadata' => json_encode([
                'is_initial_admin' => true,
                'provisioned_at' => now()->toISOString(),
            ]),
            'identity_data' => null,
            'address_data' => null,
            'professional_data' => null,
            'communication_preferences' => null,
            'last_login_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
            'created_by_id' => null,
            'updated_by_id' => null,
            'deleted_at' => null,
        ]);
        
        Log::info('Admin user created in tenant database', [
            'tenant_id' => \$tenant->getId(),
            'user_id' => \$userId,
            'email' => \$adminEmail,
        ]);
    }

    /**
     * Initialize default roles and permissions for tenant
     */
    private function initializeDefaultRolesAndPermissions(Tenant \$tenant): void
    {
        // Create default roles
        \$adminRoleId = DB::connection('tenant')->table('roles')->insertGetId([
            'name' => 'Administrator',
            'guard_name' => 'web',
            'tenant_id' => \$tenant->getId(),
            'code' => 'admin',
            'scope_type' => 'global',
            'is_system_role' => true,
            'hierarchy_level' => 1,
            'default_permissions' => json_encode(['*']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        
        \$userRoleId = DB::connection('tenant')->table('roles')->insertGetId([
            'name' => 'User',
            'guard_name' => 'web',
            'tenant_id' => \$tenant->getId(),
            'code' => 'user',
            'scope_type' => 'global',
            'is_system_role' => true,
            'hierarchy_level' => 10,
            'default_permissions' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        
        Log::info('Default roles created', [
            'tenant_id' => \$tenant->getId(),
            'admin_role_id' => \$adminRoleId,
            'user_role_id' => \$userRoleId,
        ]);
    }

    /**
     * Assign admin role to the initial user
     */
    private function assignAdminRole(Tenant \$tenant): void
    {
        \$adminEmail = \$tenant->getAdminEmail();
        
        \$user = DB::connection('tenant')
            ->table('tenant_users')
            ->where('email', \$adminEmail)
            ->first();
        
        if (!\$user) {
            throw new Exception("Admin user not found for role assignment");
        }
        
        \$adminRole = DB::connection('tenant')
            ->table('roles')
            ->where('tenant_id', \$tenant->getId())
            ->where('code', 'admin')
            ->first();
        
        if (!\$adminRole) {
            throw new Exception("Admin role not found");
        }
        
        DB::connection('tenant')->table('model_has_roles')->insert([
            'role_id' => \$adminRole->id,
            'model_type' => 'App\\\\Models\\\\TenantUser',
            'model_id' => \$user->id,
            'tenant_id' => \$tenant->getId(),
            'assigned_by' => null,
            'assigned_at' => now(),
            'organizational_unit_id' => null,
        ]);
        
        Log::info('Admin role assigned to user', [
            'tenant_id' => \$tenant->getId(),
            'user_id' => \$user->id,
            'role_id' => \$adminRole->id,
        ]);
    }
METHODS

echo "✅ Updated TenantProvisioningService.php"
echo "⚠️  Backup created: TenantProvisioningService.php.backup"
BASH

chmod +x update_provisioning_service.sh

# ============================================================================
# PHASE 4: TEST - Verify Fix Works
# ============================================================================
echo ""
echo "🧪 PHASE 4: TEST - Verify Fix Works"
echo "===================================="

# Create test script
cat > test_password_setup.sh << 'TEST'
#!/bin/bash

echo "Testing password setup fix..."
echo ""

# 1. First fix the existing tenant_uml
echo "1. Fixing existing tenant_uml..."
php artisan tinker < fix_tenant_uml.php

echo ""
echo "2. Testing password setup..."
echo ""
echo "   Try accessing: http://localhost:8000/setup/password/GX9bIXhgpet3NbkXJL24iK2TMVyBFlrppy3cXuT8aTuDZGCUpdEiPmigG4ubZN3P"
echo ""
echo "   Expected: Password setup form should work"
echo "   If still fails, check:"
echo "   - Is the token valid/expired?"
echo "   - Does SecureSetupTokenService look in correct database?"
echo ""

# 3. Test with a new tenant
echo ""
echo "3. To test with new tenant:"
echo "   - Create new tenant application"
echo "   - Approve it"
echo "   - Check if admin user is created automatically"
echo "   - Try password setup"

echo ""
echo "✅ Test instructions complete"
TEST

chmod +x test_password_setup.sh

# ============================================================================
# PHASE 5: FIND SECURE SETUP TOKEN SERVICE
# ============================================================================
echo ""
echo "🔍 PHASE 5: Find SecureSetupTokenService"
echo "========================================"

# Search for the service
find packages/laravel-backend -type f -name "*.php" -exec grep -l "SecureSetupTokenService\|setPasswordWithToken" {} \;

echo ""
echo "If found, check these methods:"
echo "1. setPasswordWithToken() - should update password_hash column"
echo "2. Should find user in tenant database (not landlord)"
echo "3. Should handle tenant database connection properly"

# ============================================================================
# EXECUTION ORDER
# ============================================================================
echo ""
echo "🚀 EXECUTION ORDER:"
echo "==================="
echo "1. Run PHASE 1 diagnostic to see current state"
echo "2. Run PHASE 2 manual fix: php artisan tinker < fix_tenant_uml.php"
echo "3. Test password setup"
echo "4. If works: Update provisioning code with ./update_provisioning_service.sh"
echo "5. Test with new tenant"
echo ""
echo "✅ CLAUDE CLI INSTRUCTIONS COMPLETE"
echo "Run each phase in order, checking results at each step."
```