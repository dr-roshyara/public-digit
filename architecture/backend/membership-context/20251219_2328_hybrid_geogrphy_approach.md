As a senior solution architect, the "Hybrid Geography Approach" is the most robust way to balance **Data Sovereignty** (for the tenant) with **Systemic Consistency** (for the platform).

By using the naming convention `np_geo_administrative_units`, you explicitly denote the "Master Record" origin, which is crucial for cross-tenant reporting and platform-wide updates.

---

### 🏛️ 1. Architecture: Table Placement

| Layer | Database | Table Name | Purpose |
| --- | --- | --- | --- |
| **Landlord** | `landlord` (publicdigit) | **`np_geo_administrative_units`** | The "Golden Source" of Nepal's official 753 local levels + 7 provinces. |
| **Tenant** | `tenant_{slug}` | **`geo_administrative_units`** | Mirrored official data + Custom party-specific units (Level 5-8). |
| **Tenant** | `tenant_{slug}` | **`members`** | All 8 level IDs (`admin_unit_level1_id`...`level8_id`) pointing locally. |

---

### 🤖 2. Claude/AI Prompt Instructions

Use this prompt to guide the generation of your Model, Repository, and Service layers. This follows **Domain-Driven Design (DDD)** principles to keep the logic clean and testable.

#### **The Prompt Template**

> **Context:** I am building a multi-tenant Laravel system for political party membership. We are using a hybrid geography approach.
> **Instructions:**
> 1. **Model (Landlord):** Create a `MasterGeoUnit` model. It should connect to the `landlord` connection and use the table `np_geo_administrative_units`.
> 2. **Model (Tenant):** Create a `GeoAdministrativeUnit` model. It should connect to the `tenant` connection. Add a `parent()` and `children()` self-referencing relationship.
> 3. **Migration (Tenant):** Write a migration for `geo_administrative_units` in the tenant DB. Include `external_geo_id` (nullable) to link back to the landlord ID, `is_official` (boolean), and `admin_level` (tinyint).
> 4. **Repository Pattern:** >    - Create a `GeoRepositoryInterface` with methods `findChildren(int $parentId)`, `getHierarchy()`, and `createCustomUnit(array $data)`.
> * Create an Eloquent implementation `TenantGeoRepository` that targets the tenant database.
> 
> 
> 5. **Service Layer:** Create a `GeographyMirrorService`. It must have a method `mirrorOfficialData()` that:
> * Switches context to Landlord.
> * Fetches all records from `np_geo_administrative_units`.
> * Switches context to Tenant and inserts them, maintaining the correct `parent_id` hierarchy.
> 
> 
> 6. **Naming:** Strictly use `admin_unit_level{n}_id` naming for the 8 levels of hierarchy in the `members` table.
> 
> 

---

### 🛠️ 3. Strategic Coding Guide

#### **The Model Definition**

To handle the two databases, your models must explicitly state their connections to prevent "Connection Leaks."

```php
// app/Models/Landlord/MasterGeoUnit.php
class MasterGeoUnit extends Model {
    protected $connection = 'landlord';
    protected $table = 'np_geo_administrative_units';
}

// app/Models/Tenant/GeoAdministrativeUnit.php
class GeoAdministrativeUnit extends Model {
    protected $connection = 'tenant'; // Handled by Tenancy middleware
    protected $table = 'geo_administrative_units';
    
    public function children() {
        return $this->hasMany(self::class, 'parent_id');
    }
}

```

#### **The Repository Pattern**

The repository acts as the gatekeeper. By using an Interface, you can later swap the "Tenant DB" implementation for a "Redis Cache" implementation for the 8-level reports without changing your controllers.

```php
interface GeoRepositoryInterface {
    public function getPathToRoot(int $unitId): Collection; // Essential for Level 8 -> Level 1 breadcrumbs
    public function getDescendantsCount(int $unitId): int;  // For density reports
}

```

#### **The Service Layer (The Mirror)**

The most complex part is the **ID Mapping** during mirroring. When you copy from Landlord to Tenant, the `id` will change. Your service must use a map to ensure the `parent_id` in the tenant DB points to the *new* local ID, not the old landlord ID.

---

### 📊 4. The "Safety" Checklist

* **Foreign Keys:** All 8 level columns in the `members` table should have `onDelete('restrict')` to prevent deleting a District that still has members.
* **Seeding:** Use the `Landlord` table to seed the `Tenant` table during the `TenantCreated` event.
* **Scalability:** Index all 8 columns (`admin_unit_level1_id`...`level8_id`) to ensure your "Member Density" reports remain sub-second.

[Implementing Multi-tenant Architectures in Laravel](https://www.youtube.com/watch?v=xkwSDZ2rqc4)

This video provides an excellent deep dive into how to manage data across multiple tenant databases, specifically addressing the separation of master data and tenant-specific data.
As a senior solution architect, the "Hybrid Geography Approach" is the most robust way to balance **Data Sovereignty** (for the tenant) with **Systemic Consistency** (for the platform).

By using the naming convention `np_geo_administrative_units`, you explicitly denote the "Master Record" origin, which is crucial for cross-tenant reporting and platform-wide updates.

---

### 🏛️ 1. Architecture: Table Placement

| Layer | Database | Table Name | Purpose |
| --- | --- | --- | --- |
| **Landlord** | `landlord` (publicdigit) | **`np_geo_administrative_units`** | The "Golden Source" of Nepal's official 753 local levels + 7 provinces. |
| **Tenant** | `tenant_{slug}` | **`geo_administrative_units`** | Mirrored official data + Custom party-specific units (Level 5-8). |
| **Tenant** | `tenant_{slug}` | **`members`** | All 8 level IDs (`admin_unit_level1_id`...`level8_id`) pointing locally. |

---

### 🤖 2. Claude/AI Prompt Instructions

Use this prompt to guide the generation of your Model, Repository, and Service layers. This follows **Domain-Driven Design (DDD)** principles to keep the logic clean and testable.

#### **The Prompt Template**

> **Context:** I am building a multi-tenant Laravel system for political party membership. We are using a hybrid geography approach.
> **Instructions:**
> 1. **Model (Landlord):** Create a `MasterGeoUnit` model. It should connect to the `landlord` connection and use the table `np_geo_administrative_units`.
> 2. **Model (Tenant):** Create a `GeoAdministrativeUnit` model. It should connect to the `tenant` connection. Add a `parent()` and `children()` self-referencing relationship.
> 3. **Migration (Tenant):** Write a migration for `geo_administrative_units` in the tenant DB. Include `external_geo_id` (nullable) to link back to the landlord ID, `is_official` (boolean), and `admin_level` (tinyint).
> 4. **Repository Pattern:** >    - Create a `GeoRepositoryInterface` with methods `findChildren(int $parentId)`, `getHierarchy()`, and `createCustomUnit(array $data)`.
> * Create an Eloquent implementation `TenantGeoRepository` that targets the tenant database.
> 
> 
> 5. **Service Layer:** Create a `GeographyMirrorService`. It must have a method `mirrorOfficialData()` that:
> * Switches context to Landlord.
> * Fetches all records from `np_geo_administrative_units`.
> * Switches context to Tenant and inserts them, maintaining the correct `parent_id` hierarchy.
> 
> 
> 6. **Naming:** Strictly use `admin_unit_level{n}_id` naming for the 8 levels of hierarchy in the `members` table.
> 
> 

---

### 🛠️ 3. Strategic Coding Guide

#### **The Model Definition**

To handle the two databases, your models must explicitly state their connections to prevent "Connection Leaks."

```php
// app/Models/Landlord/MasterGeoUnit.php
class MasterGeoUnit extends Model {
    protected $connection = 'landlord';
    protected $table = 'np_geo_administrative_units';
}

// app/Models/Tenant/GeoAdministrativeUnit.php
class GeoAdministrativeUnit extends Model {
    protected $connection = 'tenant'; // Handled by Tenancy middleware
    protected $table = 'geo_administrative_units';
    
    public function children() {
        return $this->hasMany(self::class, 'parent_id');
    }
}

```

#### **The Repository Pattern**

The repository acts as the gatekeeper. By using an Interface, you can later swap the "Tenant DB" implementation for a "Redis Cache" implementation for the 8-level reports without changing your controllers.

```php
interface GeoRepositoryInterface {
    public function getPathToRoot(int $unitId): Collection; // Essential for Level 8 -> Level 1 breadcrumbs
    public function getDescendantsCount(int $unitId): int;  // For density reports
}

```

#### **The Service Layer (The Mirror)**

The most complex part is the **ID Mapping** during mirroring. When you copy from Landlord to Tenant, the `id` will change. Your service must use a map to ensure the `parent_id` in the tenant DB points to the *new* local ID, not the old landlord ID.

---

### 📊 4. The "Safety" Checklist

* **Foreign Keys:** All 8 level columns in the `members` table should have `onDelete('restrict')` to prevent deleting a District that still has members.
* **Seeding:** Use the `Landlord` table to seed the `Tenant` table during the `TenantCreated` event.
* **Scalability:** Index all 8 columns (`admin_unit_level1_id`...`level8_id`) to ensure your "Member Density" reports remain sub-second.

[Implementing Multi-tenant Architectures in Laravel](https://www.youtube.com/watch?v=xkwSDZ2rqc4)

This video provides an excellent deep dive into how to manage data across multiple tenant databases, specifically addressing the separation of master data and tenant-specific data.
As a senior architect, you need a configuration that prioritizes **Query Speed** for public reports and **Ease of Maintenance** for party administrators. With 8 levels of hierarchy, a standard "Adjacency List" (the `parent_id` only approach) will eventually collapse under the weight of recursive queries.

To achieve a "Safe Side" architecture, I recommend a **Hybrid Adjacency + Flattened Path** strategy combined with a **Service-Driven Repository Pattern**.

---

### 🏛️ 1. The Core Architecture: "Adjacency List with Denormalized Ancestry"

While `parent_id` is great for editing, it is terrible for 8-level reporting. We solve this by combining two data structures.

#### **Pattern: Adjacency List + Path-to-Root**

* **Adjacency List (`parent_id`):** Used for simple "Get Children" or "Change Parent" operations.
* **Path-to-Root (The 8 Level Columns):** On the `members` table, we store all parent IDs (`admin_unit_level1_id`...`admin_unit_level8_id`). This is a form of **Materialized Path** optimization.

**Why this is the best:**

* **Read Speed:** To count members in a Province, you query one column. No recursion, no joins.
* **Integrity:** You maintain the "Single Source of Truth" for geography, but you cache the "location" of the member for performance.

---

### 🛠️ 2. The Design Patterns

#### **A. Repository Pattern (The Data Gatekeeper)**

Don't let your controllers talk to the database. Use a `GeoRepository`.

* **Algorithm:** Use **Recursive Common Table Expressions (CTEs)** within the repository for deep tree traversals (finding all descendants of a district). This offloads the heavy lifting to the SQL engine.

#### **B. Service Layer (The Business Orchestrator)**

Use a `MemberMigrationService`.

* **Logic:** When a member's Ward (Level 4) changes, the Service is responsible for looking up the new District (Level 2) and Province (Level 1) and updating those columns. The Controller should never "know" how to do this.

#### **C. Strategy Pattern (The "Custom Unit" Logic)**

Since you have a hybrid Landlord/Tenant approach, use a Strategy pattern to handle **Official vs. Custom** units.

* **Official Strategy:** Pulls from the mirrored `np_` data.
* **Custom Strategy:** Allows for Level 5-8 units that exist only in that tenant's DB.

---

### 📉 3. Performance Algorithms: "Lazy Tree Loading"

When building the 8-level UI, don't use a "Load All" algorithm (which would be 753+ units at once). Use **Adjacency Loading**:

1. **Step 1:** Load Level 1 (Provinces).
2. **Step 2:** User clicks a Province → Load only its direct children (Districts).
3. **Step 3:** Repeat.

* **Time Complexity:**  where  is the number of children for one node, rather than  where  is the total units in the system.

---

### 🚀 4. Technical Summary for your CLI Prompt

| Component | Recommended Technology / Pattern |
| --- | --- |
| **Hierarchy Logic** | **Adjacency List + Recursive CTE** (for deep trees). |
| **Reporting** | **Flattened Foreign Keys** (all 8 levels indexed on the member table). |
| **Multi-Tenancy** | **Identification-based switching** (Dynamic DB Connection per request). |
| **Models** | **Domain-Specific Models** (separated Landlord vs. Tenant models). |

This architecture ensures that your system remains fast whether the party has 100 members or 1,000,000. It also guarantees that your "Nepal Official" data remains the solid foundation for all internal party committees.

[Managing Hierarchical Data in Laravel](https://www.youtube.com/watch?v=IozGo2kwRYE)

This video provides a practical look at how to handle tree structures in a database, which is vital for managing your 8-level hierarchy effectively.
