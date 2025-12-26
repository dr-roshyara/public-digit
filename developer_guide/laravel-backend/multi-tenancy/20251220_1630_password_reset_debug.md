# **Developer Guide: PostgreSQL Multi-Tenant Migration & Password Setup Fix**

## **📋 Overview**

This guide documents the critical fixes made to resolve PostgreSQL multi-tenant password setup timeout issues after migrating from MySQL to PostgreSQL.

---

## **🔍 Problem Analysis**

### **Root Cause: Database Driver Conflict**
- **System:** Multi-tenant Laravel application with Spatie multi-tenancy
- **Original Setup:** MySQL-only implementation
- **Migration:** Switched to PostgreSQL for new tenants
- **Issue:** Password setup (`/setup/password/{token}`) failed with 30-second timeout

### **Technical Details:**

#### **Before Fix:**
```php
// Hardcoded MySQL configuration for ALL tenants
$config = [
    'driver' => 'mysql', // ❌ Always MySQL, even for PostgreSQL tenants
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '3306'),
    'database' => $tenant->database_name,
    // ... MySQL-specific settings
];
```

#### **The Failure Chain:**
1. PostgreSQL tenant clicks password setup link
2. System tries to connect with MySQL driver to PostgreSQL database
3. Connection attempts fail but don't timeout immediately
4. Laravel retries for 30 seconds → Timeout error

---

## **💡 Critical Lessons Learned**

### **1. Never Hardcode Database Drivers**
**❌ WRONG:**
```php
'driver' => 'mysql' // Hardcoded
```

**✅ CORRECT:**
```php
'driver' => $tenantDatabase->database_driver // Dynamic from database
```

### **2. Database Configuration Must Be Tenant-Aware**
Each tenant can have different:
- Database driver (MySQL, PostgreSQL, etc.)
- Connection parameters (host, port, credentials)
- Driver-specific settings (charset, schema, etc.)

### **3. Store Database Configuration Separately**
```php
// Database table structure
tenant_databases:
  - tenant_id (foreign key to tenants)
  - database_driver (mysql, pgsql, sqlite, etc.)
  - database_name
  - host
  - port  
  - database_username
  - database_password (encrypted)
  - status (active, fallback, etc.)
```

---

## **🔧 The Fix Implemented**

### **File 1: `SecureSetupTokenService.php`**

#### **Key Changes:**
```php
// BEFORE (Problematic):
$config = [
    'driver' => 'mysql', // ❌ Hardcoded
    'host' => env('DB_HOST', '127.0.0.1'),
    'database' => $tenant->database_name,
    // MySQL-only settings
];

// AFTER (Fixed):
// 1. Get tenant database configuration
$tenantDatabase = DB::table('tenant_databases')
    ->where('tenant_id', $tenant->id)
    ->first();

// 2. Use actual driver from database
$driver = $tenantDatabase->database_driver ?? env('DB_CONNECTION', 'mysql');

// 3. Build dynamic configuration
$config = [
    'driver' => $driver, // ✅ Dynamic
    'host' => $tenantDatabase->host, // ✅ Tenant-specific
    'port' => $tenantDatabase->port,
    'database' => $tenantDatabase->database_name,
    'username' => $tenantDatabase->database_username,
    'password' => decrypt($tenantDatabase->database_password),
    // ... driver-specific settings
];

// 4. Add driver-specific configuration
if ($driver === 'pgsql') {
    $config['charset'] = 'utf8';
    $config['schema'] = 'public';
    $config['sslmode'] = 'prefer';
} else {
    $config['charset'] = 'utf8mb4';
    $config['collation'] = 'utf8mb4_unicode_ci';
    $config['engine'] = null;
}
```

### **File 2: `TenantCredentialController.php`**

#### **Additional Fixes:**
```php
// Fix 1: Contact name combination
// Database has first_name + last_name, not contact_name
$contactName = trim(($application->first_name ?? '') . ' ' . ($application->last_name ?? ''));

// Fix 2: Add missing databaseDriver parameter
new TenantProvisioningCompletedMail(
    // ... other parameters
    databaseDriver: $databaseDriver, // ✅ Added
    // ...
);
```

---

## **🚨 What Developers Must Be Careful About**

### **1. Database Provisioning Pattern**
```php
// ❌ AVOID: Singleton binding with hardcoded implementation
$this->app->singleton(DatabaseProvisionerInterface::class, MySQLDatabaseProvisioner::class);

// ✅ USE: Factory pattern for multi-driver support
$this->app->singleton(DatabaseProvisionerInterface::class, function ($app) {
    $defaultConnection = config('database.default');
    return match ($defaultConnection) {
        'mysql' => $app->make(MySQLDatabaseProvisioner::class),
        'pgsql' => $app->make(PostgreSQLDatabaseProvisioner::class),
        default => throw new \Exception("Unsupported driver"),
    };
});
```

### **2. Connection Switching Safety**
```php
public function switchToTenantDatabase($tenantId)
{
    // Store original connection
    $originalDefault = DB::getDefaultConnection();
    
    try {
        // Configure and switch to tenant connection
        $this->configureTenantConnection($tenantId);
        DB::setDefaultConnection('tenant');
        
        // Perform tenant operations
        
    } finally {
        // ALWAYS restore original connection
        DB::setDefaultConnection($originalDefault);
    }
}
```

### **3. Password Column Consistency**
```sql
-- Migration: Ensure consistent password column names
ALTER TABLE tenant_users RENAME COLUMN password TO password_hash;
```

### **4. Token Management**
```php
// Token should have clear lifecycle
$token->update([
    'used' => true,           // Boolean flag
    'used_at' => now(),       // Timestamp
    'updated_at' => now(),    // Last update
]);
```

---

## **🔗 How to Edit Tenant Password Reset Process**

### **A. Password Reset Link Generation**

#### **1. Token Creation Service:**
```php
class TenantSetupTokenService
{
    public function createPasswordResetToken($tenantUserId, $email)
    {
        $token = Str::random(64);
        $hashedToken = hash('sha256', $token);
        
        return DB::table('tenant_setup_tokens')->insert([
            'token' => $hashedToken,
            'tenant_user_id' => $tenantUserId,
            'email' => $email,
            'type' => 'password_reset',
            'expires_at' => now()->addHours(24),
            'used' => false,
            'created_at' => now(),
        ]);
    }
    
    public function generatePasswordResetLink($tenant, $token)
    {
        // Dynamic URL based on tenant slug
        return url("/{$tenant->slug}/password-reset/{$token}");
        
        // OR system-wide setup URL
        return url("/setup/password/{$token}");
    }
}
```

#### **2. Email Template Customization:**
```blade
{{-- resources/views/emails/tenant/password-reset.blade.php --}}
@component('mail::message')
# Password Reset Request

Hello {{ $userName }},

You requested a password reset for your {{ $tenantName }} account.

@component('mail::button', ['url' => $resetLink])
Reset Password
@endcomponent

This link will expire in 24 hours.

Thanks,<br>
{{ config('app.name') }}
@endcomponent
```

### **B. Password Reset Flow Configuration**

#### **1. Routes Configuration:**
```php
// Tenant-specific password reset
Route::prefix('{tenant}')->group(function () {
    Route::get('/password-reset/{token}', [TenantAuthController::class, 'showResetForm'])
        ->name('tenant.password.reset');
    
    Route::post('/password-reset/{token}', [TenantAuthController::class, 'resetPassword'])
        ->name('tenant.password.update');
});

// System-wide setup (for initial setup)
Route::prefix('setup')->group(function () {
    Route::get('/password/{token}', [SecureSetupController::class, 'showPasswordForm'])
        ->name('setup.password.form');
    
    Route::post('/password/{token}', [SecureSetupController::class, 'submitPassword'])
        ->name('setup.password.submit');
});
```

#### **2. Controller Implementation:**
```php
class SecureSetupController extends Controller
{
    public function showPasswordForm($token)
    {
        // Validate token
        $tokenData = $this->validateToken($token);
        
        // Show password form
        return Inertia::render('Setup/Password', [
            'token' => $token,
            'email' => $tokenData['email'],
            'tenant' => $tokenData['tenant'],
        ]);
    }
    
    public function submitPassword(Request $request, $token)
    {
        $request->validate([
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);
        
        // Use the fixed SecureSetupTokenService
        $service = app(SecureSetupTokenService::class);
        $result = $service->setPasswordWithToken($token, $request->password);
        
        // Redirect to success page or credentials
        return redirect()->route('setup.credentials', ['token' => $token])
            ->with('success', 'Password updated successfully');
    }
}
```

### **C. Customizing Reset Email Content**

#### **1. Mail Class:**
```php
class TenantPasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;
    
    public $tenant;
    public $user;
    public $resetLink;
    public $expiryHours;
    
    public function __construct($tenant, $user, $resetLink, $expiryHours = 24)
    {
        $this->tenant = $tenant;
        $this->user = $user;
        $this->resetLink = $resetLink;
        $this->expiryHours = $expiryHours;
    }
    
    public function build()
    {
        return $this->subject("Password Reset for {$this->tenant->name}")
            ->markdown('emails.tenant.password-reset')
            ->with([
                'userName' => $this->user->name,
                'tenantName' => $this->tenant->name,
                'resetLink' => $this->resetLink,
                'expiryHours' => $this->expiryHours,
            ]);
    }
}
```

#### **2. Sending the Email:**
```php
public function sendPasswordResetEmail($tenant, $user)
{
    $tokenService = app(TenantSetupTokenService::class);
    $token = $tokenService->createPasswordResetToken($user->id, $user->email);
    $resetLink = $tokenService->generatePasswordResetLink($tenant, $token);
    
    Mail::to($user->email)->send(
        new TenantPasswordResetMail($tenant, $user, $resetLink)
    );
    
    Log::info('Password reset email sent', [
        'tenant' => $tenant->slug,
        'user' => $user->email,
        'token' => substr($token, 0, 16) . '...',
    ]);
}
```

---

## **🔐 Security Considerations**

### **1. Token Security:**
```php
// Always hash tokens before storing
$hashedToken = hash('sha256', $plainToken);

// Use strong random tokens
use Illuminate\Support\Str;
$token = Str::random(64); // 64-character random string

// Set reasonable expiration
'expires_at' => now()->addHours(24), // 24 hours for password reset
'expires_at' => now()->addDays(7),   // 7 days for initial setup
```

### **2. Password Requirements:**
```php
// Enforce strong passwords
$request->validate([
    'password' => [
        'required',
        'confirmed',
        Password::min(8)
            ->letters()
            ->mixedCase()
            ->numbers()
            ->symbols()
            ->uncompromised(),
    ],
]);
```

### **3. Rate Limiting:**
```php
// Apply rate limiting to prevent abuse
Route::post('/setup/password/{token}', [/* ... */])
    ->middleware('throttle:5,15'); // 5 attempts per 15 minutes
```

---

## **📊 Monitoring & Debugging**

### **1. Essential Logging:**
```php
Log::info('[PASSWORD_SETUP] Starting password setup', [
    'token_preview' => substr(hash('sha256', $token), 0, 16) . '...',
    'tenant_id' => $tenant->id,
    'driver' => $driver,
]);

Log::error('[PASSWORD_SETUP] Failed', [
    'error' => $e->getMessage(),
    'driver' => $driver,
    'database' => $databaseName,
]);
```

### **2. Health Checks:**
```php
// Database connection test
public function testTenantConnection($tenantId)
{
    $tenantDatabase = DB::table('tenant_databases')
        ->where('tenant_id', $tenantId)
        ->first();
    
    try {
        $pdo = new \PDO(
            "{$tenantDatabase->database_driver}:host={$tenantDatabase->host};dbname={$tenantDatabase->database_name}",
            $tenantDatabase->database_username,
            decrypt($tenantDatabase->database_password),
            [\PDO::ATTR_TIMEOUT => 5]
        );
        return true;
    } catch (\PDOException $e) {
        return false;
    }
}
```

---

## **🚀 Best Practices Summary**

### **DO:**
- ✅ Store database configuration per tenant
- ✅ Use dynamic driver selection
- ✅ Implement proper error handling and logging
- ✅ Use factory pattern for multi-driver support
- ✅ Always restore original database connection
- ✅ Hash tokens before storing
- ✅ Set reasonable token expiration

### **DON'T:**
- ❌ Hardcode database drivers
- ❌ Assume all tenants use the same database type
- ❌ Leave database connections switched
- ❌ Store plain text tokens
- ❌ Use weak password requirements
- ❌ Skip input validation

---

## **📈 Future Improvements**

### **1. Database Provisioner Factory:**
```php
class DatabaseProvisionerFactory
{
    public static function createForDriver($driver)
    {
        return match($driver) {
            'mysql' => new MySQLDatabaseProvisioner(),
            'pgsql' => new PostgreSQLDatabaseProvisioner(),
            'sqlite' => new SQLiteDatabaseProvisioner(),
            default => throw new UnsupportedDriverException($driver),
        };
    }
}
```

### **2. Connection Pooling:**
```php
// Implement connection pooling for better performance
'tenant' => [
    'driver' => 'pgsql',
    'host' => $tenantDb->host,
    // ...
    'pool' => [
        'min' => 1,
        'max' => 10,
        'timeout' => 30,
    ],
],
```

### **3. Automated Testing:**
```php
// Test both MySQL and PostgreSQL tenants
public function test_password_setup_for_all_drivers()
{
    $drivers = ['mysql', 'pgsql'];
    
    foreach ($drivers as $driver) {
        $tenant = Tenant::factory()->create([
            'database_driver' => $driver,
        ]);
        
        $this->assertPasswordSetupWorks($tenant);
    }
}
```

---

## **🎯 Quick Reference: Critical Files**

1. **`SecureSetupTokenService.php`** - Password setup logic
2. **`TenantCredentialController.php`** - Credential resending
3. **`PlatformServiceProvider.php`** - Database provisioner binding
4. **Database migrations** - `tenant_databases` table structure
5. **`.env` configuration** - Default database connection

**Remember:** Always test with both MySQL and PostgreSQL tenants after any database-related changes!