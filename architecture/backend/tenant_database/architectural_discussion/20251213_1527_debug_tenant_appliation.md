Looking at your routes, I can see exactly where the issue is. The password setup is handled by `SecureSetupController::submitPassword()` at `/setup/password/{token}`. Let me debug this for you.

## Debug Analysis

Based on your routes:
1. `/setup/password/{token}` → `SecureSetupController::submitPassword()`
2. This is where the password update happens
3. This route is in the Platform Context

Let me create a debugging prompt to help you trace the issue:

## Claude CLI Debug Instructions

```bash
# 1. First, let's examine the SecureSetupController
cat app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php

# 2. Check what model is being used for password update
grep -n "password" app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php
grep -n "update" app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php
grep -n "TenantUser\|User" app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php

# 3. Check if there's a TenantUser model in Platform Context
find app/Contexts/Platform -name "*User*.php" -type f

# 4. Look for any traits being used
grep -n "use.*ResetsPasswords\|use.*Authenticatable" app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php

# 5. Check the database connection configuration
grep -n "connection.*tenant\|tenant.*connection" app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php

# 6. Look for tenant provisioning service
find app -name "*Provisioning*" -type f
find app -name "*TenantService*" -type f

# 7. Check if there's password column mapping
find app -name "*.php" -type f -exec grep -l "password_hash\|getAuthPassword\|setPasswordAttribute" {} \;

# 8. Let's also check the showPasswordSetup method
grep -A 10 -B 5 "showPasswordSetup" app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php

# 9. Check middleware or service providers
find app -name "*.php" -type f -exec grep -l "TenantConnection\|switch.*tenant" {} \;

# 10. Let's see what's actually in the SecureSetupController
echo "=== FULL CONTROLLER CONTENT ==="
cat app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php
echo "=== END ==="
```

## Quick Debug Script

Run this script to get immediate insights:

```bash
#!/bin/bash
echo "🔍 DEBUGGING TENANT PASSWORD SETUP ISSUE"
echo "========================================"

echo ""
echo "1. Checking SecureSetupController..."
if [ -f "app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php" ]; then
    CONTROLLER="app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php"
    
    echo "Controller found at: $CONTROLLER"
    echo ""
    echo "Methods in controller:"
    grep -n "function" "$CONTROLLER"
    
    echo ""
    echo "Looking for password update logic:"
    grep -n -B2 -A5 "password\|update\|save" "$CONTROLLER"
    
    echo ""
    echo "Looking for model usage:"
    grep -n "TenantUser\|User\|model" "$CONTROLLER"
    
    echo ""
    echo "Checking for database connections:"
    grep -n "DB\|connection\|Connection" "$CONTROLLER"
else
    echo "❌ Controller not found at expected location"
    
    # Try to find it elsewhere
    echo "Searching for SecureSetupController..."
    find . -name "SecureSetupController.php" -type f 2>/dev/null
fi

echo ""
echo "2. Checking TenantUser model..."
if [ -f "app/Models/TenantUser.php" ]; then
    echo "TenantUser model found"
    echo ""
    echo "Model properties:"
    grep -n "protected \$connection\|protected \$table\|extends\|use.*Authenticatable" app/Models/TenantUser.php
    
    echo ""
    echo "Password methods:"
    grep -n -B2 -A2 "password\|getAuthPassword\|setPasswordAttribute" app/Models/TenantUser.php
else
    echo "❌ TenantUser model not found at app/Models/TenantUser.php"
    find . -name "*TenantUser*.php" -type f 2>/dev/null
fi

echo ""
echo "3. Checking auth configuration..."
if [ -f "config/auth.php" ]; then
    echo "Checking tenant guard configuration:"
    grep -n -B5 -A5 "tenant" config/auth.php
else
    echo "❌ auth.php not found"
fi

echo ""
echo "4. Checking for recent logs..."
if [ -f "storage/logs/laravel.log" ]; then
    echo "Last 10 lines of laravel.log:"
    tail -10 storage/logs/laravel.log
fi

echo ""
echo "========================================"
echo "🎯 NEXT STEPS:"
echo "1. The issue is in SecureSetupController::submitPassword()"
echo "2. Check what model it's using to update password"
echo "3. Verify it's updating 'password_hash' not 'password' column"
echo "4. Check if connection is properly switched to tenant database"
```

## Expected Controller Structure

The SecureSetupController should look something like this:

```php
<?php

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\TenantSetupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SecureSetupController extends Controller
{
    protected $tenantSetupService;
    
    public function __construct(TenantSetupService $tenantSetupService)
    {
        $this->tenantSetupService = $tenantSetupService;
    }
    
    public function showPasswordSetup($token)
    {
        // Validate token and get tenant info
        $setupData = $this->tenantSetupService->validateSetupToken($token);
        
        return view('platform.secure-setup.password', [
            'token' => $token,
            'email' => $setupData['email'],
            'tenant' => $setupData['tenant']
        ]);
    }
    
    public function submitPassword(Request $request, $token)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|confirmed|min:8',
        ]);
        
        // THIS IS WHERE THE ERROR OCCURS
        // Find which line is causing the update with 'password' column
        
        try {
            // Switch to tenant database
            $setupData = $this->tenantSetupService->validateSetupToken($token);
            
            // ❌ PROBLEM AREA: This is where the update happens
            $user = $this->tenantSetupService->setupPassword(
                $setupData['tenant_id'],
                $request->email,
                $request->password
            );
            
            // OR maybe direct update:
            // $user = \App\Models\TenantUser::where('email', $request->email)->first();
            // $user->update(['password' => bcrypt($request->password)]); // ❌ Wrong column
            
            return redirect()->route('setup.credentials', ['token' => $token]);
            
        } catch (\Exception $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }
    
    public function showCredentials($token)
    {
        // Show database credentials
    }
}
```

## Most Likely Fix Location

The issue is in either:

1. **`TenantSetupService::setupPassword()`** - Check this service method
2. **Direct update in controller** - If updating directly in controller
3. **Model not configured properly** - If TenantUser model doesn't handle password correctly

Run this to check:

```bash
# Find the TenantSetupService
find app -name "*TenantSetupService*" -type f

# Or find any service that handles password setup
find app -name "*.php" -type f -exec grep -l "setupPassword\|setup.*password" {} \;

# Check what's actually in submitPassword method
grep -n -A 20 "submitPassword" app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php
```

## Quick Fix

Once you find the controller, look for this pattern and fix it:

```php
// ❌ WRONG - This causes your error:
$user->update([
    'password' => bcrypt($request->password),  // Column doesn't exist
    'email_verified_at' => now(),
]);

// ✅ CORRECT - Use password_hash column:
$user->update([
    'password_hash' => bcrypt($request->password),
    'email_verified_at' => now(),
]);

// ✅ OR BETTER - Use model mutator (if defined in TenantUser):
$user->password = $request->password;  // Calls setPasswordAttribute()
$user->email_verified_at = now();
$user->save();
```

Run the debug commands and share the output. I'll help you fix the exact line causing the issue.