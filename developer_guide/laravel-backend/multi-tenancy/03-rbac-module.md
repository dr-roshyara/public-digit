# RBAC Module - Developer Guide

**Role-Based Access Control for Multi-Tenant System**

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Nepali Political Party Roles](#nepali-political-party-roles)
4. [Permission System](#permission-system)
5. [Multi-Tenant Isolation](#multi-tenant-isolation)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)

---

## Overview

The RBAC (Role-Based Access Control) module provides a complete permission and role management system for tenant databases. It is a **required core module** included in all templates.

### Key Features

- ✅ Role-based access control (users → roles → permissions)
- ✅ Direct user permissions (bypass roles for exceptions)
- ✅ Hierarchical role structures
- ✅ Tenant-isolated permissions (no cross-tenant access)
- ✅ Pre-configured Nepali political party roles
- ✅ Flexible permission system (38 default permissions)

### Module Metadata

```php
TemplateModule {
    slug: 'rbac'
    name: 'RBAC Module'
    module_type: 'core'
    is_optional: false
    is_active: true
    template_id: null  // Global module (all templates)
    dependencies: null
}
```

---

## Database Schema

The RBAC module creates **5 tables** in each tenant database:

### 1. permissions

Defines available actions in the system.

```sql
CREATE TABLE permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE COMMENT 'Permission identifier (e.g., elections.create)',
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guard (guard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Defines all available permissions in the system';
```

**Sample Permissions:**

| id | name | guard_name |
|----|------|------------|
| 1 | elections.view | web |
| 2 | elections.create | web |
| 3 | elections.update | web |
| 4 | elections.delete | web |
| 5 | members.view | web |
| 6 | members.create | web |
| 7 | members.update | web |
| 8 | members.delete | web |

### 2. roles

Defines groups of permissions.

```sql
CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE COMMENT 'Role identifier (e.g., party_president)',
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guard (guard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Defines roles that can be assigned to users';
```

**Sample Roles:**

| id | name | guard_name |
|----|------|------------|
| 1 | super_admin | web |
| 2 | party_president | web |
| 3 | general_secretary | web |
| 4 | treasurer | web |
| 5 | election_officer | web |

### 3. model_has_permissions

Assigns permissions directly to users (bypasses roles).

```sql
CREATE TABLE model_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(255) NOT NULL COMMENT 'Typically: App\\Models\\User',
    model_id BIGINT UNSIGNED NOT NULL COMMENT 'User ID',
    PRIMARY KEY (permission_id, model_id, model_type),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    INDEX idx_model (model_type, model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Direct user-to-permission assignments (overrides role permissions)';
```

**Usage Example:**
```php
// Give user ID 5 direct permission to delete elections (bypass their role)
INSERT INTO model_has_permissions VALUES (4, 'App\\Models\\User', 5);
```

### 4. model_has_roles

Assigns roles to users.

```sql
CREATE TABLE model_has_roles (
    role_id BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(255) NOT NULL COMMENT 'Typically: App\\Models\\User',
    model_id BIGINT UNSIGNED NOT NULL COMMENT 'User ID',
    PRIMARY KEY (role_id, model_id, model_type),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    INDEX idx_model (model_type, model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Assigns roles to users';
```

**Usage Example:**
```php
// Assign user ID 10 the 'party_president' role
INSERT INTO model_has_roles VALUES (2, 'App\\Models\\User', 10);
```

### 5. role_has_permissions

Defines which permissions each role has.

```sql
CREATE TABLE role_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (permission_id, role_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Defines which permissions each role has';
```

**Usage Example:**
```php
// Give 'election_officer' role permission to create elections
INSERT INTO role_has_permissions VALUES (2, 5);
```

---

## Nepali Political Party Roles

### Default Role Hierarchy

The RBAC module seeds **18 pre-configured roles** for Nepali political parties:

#### 1. Super Admin
```php
Role: 'super_admin'
Permissions: ALL (38 permissions)
Description: System administrator with full access
```

#### 2. Party Leadership Roles

**Party President** (`party_president`)
- Permissions: All except system configuration
- Can: Manage elections, members, committees, donations, events
- Cannot: Modify system settings

**General Secretary** (`general_secretary`)
- Permissions: Elections, members, committees, events
- Can: Organize elections, manage members, coordinate events
- Cannot: Financial management

**Treasurer** (`treasurer`)
- Permissions: Financial management (donations, expenditures)
- Can: Record donations, track expenses, generate financial reports
- Cannot: Manage elections or members

#### 3. Central Committee Roles

**Central Committee Member** (`central_committee_member`)
- Permissions: View all, create events, manage own profile
- Can: Participate in decision-making, organize events
- Cannot: Modify elections or financial records

**Vice President** (`vice_president`)
- Permissions: Similar to Party President (limited)
- Can: Assist president in all operations
- Cannot: Delete critical records

#### 4. Election Roles

**Election Officer** (`election_officer`)
- Permissions: Elections, candidates, voting
- Can: Create elections, add candidates, manage voting process
- Cannot: Access financial data or member personal info

**Election Observer** (`election_observer`)
- Permissions: View elections, candidates, results
- Can: Monitor election process, generate reports
- Cannot: Modify any election data

#### 5. Committee Roles

**District Committee Member** (`district_committee_member`)
- Permissions: View members, manage district events
- Can: Organize local events, view district members
- Cannot: Access central data or finances

**Province Committee Member** (`province_committee_member`)
- Permissions: View province members, events
- Can: Coordinate province-level activities
- Cannot: Access financial records

#### 6. Membership Roles

**Membership Coordinator** (`membership_coordinator`)
- Permissions: Members (create, update, view)
- Can: Add new members, update member info, approve memberships
- Cannot: Delete members or access financial data

**Member** (`member`)
- Permissions: View own profile, view public elections
- Can: Participate in voting, view own membership details
- Cannot: Access other members' data

### Permission Matrix

| Role | Elections | Members | Committees | Finance | Events | Settings |
|------|-----------|---------|------------|---------|--------|----------|
| Super Admin | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| Party President | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ❌ |
| General Secretary | ✅ All | ✅ All | ✅ All | ❌ | ✅ All | ❌ |
| Treasurer | ❌ | ❌ | ❌ | ✅ All | ❌ | ❌ |
| Election Officer | ✅ All | 👁️ View | ❌ | ❌ | ❌ | ❌ |
| Membership Coordinator | ❌ | ✅ All | 👁️ View | ❌ | 👁️ View | ❌ |
| Member | 👁️ View | 👁️ Own | ❌ | ❌ | 👁️ View | ❌ |

---

## Permission System

### Permission Naming Convention

```
{resource}.{action}
```

**Examples:**
- `elections.create` - Create new elections
- `elections.view` - View election list
- `elections.update` - Modify existing elections
- `elections.delete` - Delete elections
- `members.view` - View member list
- `members.update` - Edit member information

### Complete Permission List (38 permissions)

#### Elections (5 permissions)
```php
elections.view
elections.create
elections.update
elections.delete
elections.results
```

#### Members (4 permissions)
```php
members.view
members.create
members.update
members.delete
```

#### Committees (4 permissions)
```php
committees.view
committees.create
committees.update
committees.delete
```

#### Candidates (4 permissions)
```php
candidates.view
candidates.create
candidates.update
candidates.delete
```

#### Donations (4 permissions)
```php
donations.view
donations.create
donations.update
donations.delete
```

#### Expenditures (4 permissions)
```php
expenditures.view
expenditures.create
expenditures.update
expenditures.delete
```

#### Events (4 permissions)
```php
events.view
events.create
events.update
events.delete
```

#### Constituencies (3 permissions)
```php
constituencies.view
constituencies.create
constituencies.update
```

#### Settings (3 permissions)
```php
settings.view
settings.update
settings.delete
```

#### Users (3 permissions)
```php
users.view
users.create
users.update
```

---

## Multi-Tenant Isolation

### How Isolation Works

1. **Separate Database per Tenant**
   - Each tenant has its own database: `tenant_nepal_congress`, `tenant_uml`
   - RBAC tables exist in EACH tenant database (not shared)

2. **No Cross-Tenant Access**
   - Roles and permissions are tenant-specific
   - User in Tenant A cannot access Tenant B's roles/permissions
   - Database connection switches automatically per request

3. **Guard Names**
   - All permissions use `guard_name = 'web'`
   - Ensures Laravel's auth system uses correct guard

### Example: Two Tenants with Same Role Name

**Tenant: Nepal Congress (database: tenant_nepal_congress)**
```sql
-- roles table
id | name             | guard_name
1  | party_president  | web
2  | treasurer        | web

-- users assigned to roles (in this tenant's database)
user_id | role_id
10      | 1        -- User 10 is party_president in Nepal Congress
```

**Tenant: UML (database: tenant_uml)**
```sql
-- roles table (completely separate)
id | name             | guard_name
1  | party_president  | web
2  | treasurer        | web

-- users assigned to roles (in this tenant's database)
user_id | role_id
25      | 1        -- User 25 is party_president in UML
```

**Result:**
- User 10 has NO access to UML database
- User 25 has NO access to Nepal Congress database
- Same role name, completely isolated contexts

---

## Usage Examples

### Example 1: Check User Permission

```php
use Illuminate\Support\Facades\Auth;

// In controller or middleware
$user = Auth::user();

if ($user->hasPermissionTo('elections.create')) {
    // User can create elections
    return view('elections.create');
} else {
    abort(403, 'Unauthorized');
}
```

### Example 2: Assign Role to User

```php
use App\Models\User;
use Spatie\Permission\Models\Role;

$user = User::find(10);
$role = Role::findByName('election_officer');

$user->assignRole($role);

// OR using role name directly
$user->assignRole('election_officer');
```

### Example 3: Check Role

```php
if ($user->hasRole('party_president')) {
    // User is party president
    return view('admin.dashboard');
}

// Check multiple roles (OR logic)
if ($user->hasAnyRole(['party_president', 'general_secretary'])) {
    // User is either president or secretary
}

// Check all roles (AND logic)
if ($user->hasAllRoles(['election_officer', 'central_committee_member'])) {
    // User has both roles
}
```

### Example 4: Direct Permission Assignment

```php
use Spatie\Permission\Models\Permission;

$user = User::find(5);
$permission = Permission::findByName('elections.delete');

// Give user direct permission (bypasses role)
$user->givePermissionTo($permission);

// Remove direct permission
$user->revokePermissionTo($permission);
```

### Example 5: Create Custom Role

```php
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

// Create role
$role = Role::create(['name' => 'social_media_manager']);

// Assign permissions
$role->givePermissionTo([
    'events.view',
    'events.create',
    'events.update',
    'members.view',
]);

// Assign role to user
$user->assignRole('social_media_manager');
```

### Example 6: Middleware Protection

```php
// routes/tenant-web.php

Route::prefix('{tenant}')
    ->middleware(['web', 'identify.tenant', 'auth'])
    ->group(function () {

        // Only users with 'elections.create' permission
        Route::get('elections/create', [ElectionController::class, 'create'])
            ->middleware('permission:elections.create');

        // Only users with specific roles
        Route::get('admin', [AdminController::class, 'index'])
            ->middleware('role:party_president|general_secretary');
    });
```

### Example 7: Blade Directives

```blade
{{-- Check permission in Blade template --}}
@can('elections.create')
    <a href="{{ route('elections.create') }}">Create Election</a>
@endcan

{{-- Check role --}}
@role('party_president')
    <div class="admin-panel">
        <!-- Admin controls -->
    </div>
@endrole

{{-- Check multiple roles --}}
@hasanyrole('party_president|general_secretary')
    <button>Approve Member</button>
@endhasanyrole
```

---

## Best Practices

### 1. Role Design

✅ **DO:**
- Create roles based on actual organizational positions
- Use descriptive role names (not just "admin", "user")
- Assign minimal necessary permissions to each role
- Document role responsibilities

❌ **DON'T:**
- Create overlapping roles with identical permissions
- Give all roles full permissions
- Use role names that don't match organization structure
- Create roles for every single permission combination

### 2. Permission Naming

✅ **DO:**
- Use consistent naming: `{resource}.{action}`
- Use plural resource names: `elections.view` not `election.view`
- Use standard actions: view, create, update, delete
- Document custom permissions

❌ **DON'T:**
- Use inconsistent naming: `create_election`, `elections.new`
- Create permissions for UI elements (use feature flags instead)
- Combine multiple actions in one permission: `elections.create_and_update`

### 3. Performance

✅ **DO:**
- Cache permission checks for frequently accessed pages
- Use middleware for route-level protection (faster than controller checks)
- Eager load roles and permissions when querying users:
  ```php
  $users = User::with('roles.permissions')->get();
  ```

❌ **DON'T:**
- Check permissions in loops without caching
- Load all users with all roles/permissions by default
- Query permission tables directly (use Eloquent methods)

### 4. Security

✅ **DO:**
- Always validate permissions server-side (never trust frontend)
- Use guard names consistently
- Audit permission changes (log role assignments)
- Regularly review role permissions

❌ **DON'T:**
- Rely only on UI hiding (always enforce backend checks)
- Share roles across tenants (defeats isolation)
- Give users permissions they don't need
- Allow users to modify their own permissions

---

## Testing RBAC

### Unit Test Example

```php
// tests/Feature/RbacTest.php

use App\Models\User;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_with_role_has_permissions()
    {
        $user = User::factory()->create();

        $role = Role::create(['name' => 'election_officer']);
        $permission = Permission::create(['name' => 'elections.create']);

        $role->givePermissionTo($permission);
        $user->assignRole($role);

        $this->assertTrue($user->hasPermissionTo('elections.create'));
        $this->assertTrue($user->hasRole('election_officer'));
    }

    public function test_direct_permission_overrides_role()
    {
        $user = User::factory()->create();

        $role = Role::create(['name' => 'member']);
        // Role 'member' does NOT have 'elections.create'

        $user->assignRole($role);

        // Give direct permission
        $permission = Permission::create(['name' => 'elections.create']);
        $user->givePermissionTo($permission);

        $this->assertTrue($user->hasPermissionTo('elections.create'));
    }

    public function test_permission_isolation_across_tenants()
    {
        // This requires multi-database testing setup
        // Each tenant database has separate roles/permissions

        // Test that user in Tenant A cannot access Tenant B's roles
        // (Implementation depends on your multi-tenancy test setup)
    }
}
```

---

**Next:** [05 - Models & Relationships](05-models-relationships.md)
