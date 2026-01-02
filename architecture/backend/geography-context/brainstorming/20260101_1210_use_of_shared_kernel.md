In a multi-tenant political system, the **Geography Context** is your "Master Reference." Because a Ward in the physical world doesn't change based on which party is looking at it, this data must be a **Shared Kernel**.

However, in **Spatie Laravel Multitenancy**, you must be careful: tenants cannot "write" to shared data, and the landlord database is usually where this "Source of Truth" lives.

Here are the architectural steps to implement Geography as a Shared Kernel.

---

## 1. The "Read-Only" Shared Kernel Pattern

You will store the official geographical hierarchy in the **Landlord Database**. All Tenant databases will "view" this data but cannot modify it.

### Step 1: Define the Hierarchical Schema (Landlord)

Use a **Nested Set** or a simple **Adjacency List** (Parent IDs) in your Landlord database.

```php
// Landlord Migration: create_geography_tables.php
Schema::create('geography_nodes', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->enum('level', ['province', 'district', 'municipality', 'ward']);
    $table->foreignId('parent_id')->nullable()->constrained('geography_nodes');
    $table->string('external_code')->unique(); // Official gov code
    $table->timestamps();
});

```

### Step 2: Create a Cross-Database Eloquent Connection

Your Tenant models need to "reach out" of their tenant database to grab the Landlord's geography.

```php
// app/Models/Shared/GeographyNode.php
class GeographyNode extends Model {
    // Force this model to always use the Landlord connection
    protected $connection = 'landlord'; 
    
    public function children() {
        return $this->hasMany(GeographyNode::class, 'parent_id');
    }
}

```

---

## 2. Implementing the "Hierarchy-Aware" Member

Each member in a Tenant's database must point to a `geography_node_id`. This allows you to "roll up" data for your **Leader Scoring**.

### Step 3: Tenant-Side Foreign Keys

In the Tenant migration, you store the ID, but you cannot use a hard SQL `constrained()` foreign key because the table is in a different database.

```php
// Tenant Migration: add_geo_to_members.php
Schema::table('members', function (Blueprint $table) {
    // We store the ID, but validation happens at the application level
    $table->unsignedBigInteger('geography_node_id')->index();
});

```

### Step 4: The "Geo-Scope" Trait

Create a Trait to allow easy filtering of members by location. This is crucial for your **Committee Management**.

```php
// app/Traits/HasGeography.php
trait HasGeography {
    public function scopeInLocation($query, $nodeId) {
        // Logic to find all members in this node or any sub-node (recursive)
        $nodeIds = GeographyNode::find($nodeId)->descendantsAndSelf()->pluck('id');
        return $query->whereIn('geography_node_id', $nodeIds);
    }
}

```

---

## 3. Integration with Leader Scoring

The Shared Kernel allows you to calculate scores across the hierarchy. For example: *“How many members does this leader have in District X?”*

1. **The Event:** A member joins in a Tenant DB.
2. **The Enrichment:** The system looks up the `geography_node_id` hierarchy (Ward -> Municipality -> District).
3. **The Aggregation:** The **Scoring Context** increments the "Growth" points for the Ward Leader, the Municipality Leader, and the District Leader simultaneously.

---

## 4. Visualizing the Geography "Lookup" Flow

When a user registers on a Tenant's site:

1. **Request:** `GET api/geography/provinces` -> Fetches from Landlord.
2. **Selection:** User picks "Province A" -> `GET api/geography/districts?parent=A`.
3. **Storage:** User submits form -> Tenant DB saves `member` with `geography_node_id = 405` (the Ward ID).

---

## 🏗️ Architectural Checklist

* [ ] **Landlord Seeder:** Populate the `geography_nodes` table with the official national data.
* [ ] **Tenant Middleware:** Ensure the tenant has the "Geography" module enabled in the `ModuleRegistry`.
* [ ] **Caching:** Since geography data rarely changes, cache the `GeographyNode` queries globally to prevent constant cross-database overhead.

**Would you like me to write the Laravel Seeder that converts a flat JSON list of Wards/Districts into this hierarchical `geography_nodes` table?**