As a senior architect, I have synthesized our brainstorming sessions into a **5-Phase Implementation Roadmap**. This plan ensures that your 8-level "Safe Side" hierarchy is built with high performance, scalability, and tenant isolation in mind.

---

### 🗺️ Project Overview: The Hybrid SaaS Strategy

* **Landlord (Central DB):** Holds `np_geo_administrative_units` (The Master Nepal Map).
* **Tenant (Client DB):** Holds local `geo_administrative_units` (Official Mirror + Custom Party Units).
* **Member Record:** Stores 8 denormalized columns (`admin_unit_level1_id`...`level8_id`) for  query speed.

---

### 📅 Phase 1: Foundation & Master Geography (Week 1)

**Goal:** Establish the "Golden Source" of truth in the Landlord database.

1. **Landlord Schema:** Create `np_geo_administrative_units` with levels 1–4 (Province, District, Local, Ward).
2. **Model Layer:** Define `MasterGeoUnit` with a fixed connection to the `landlord` database.
3. **Data Ingestion:** Seed the Landlord DB with official Nepal government data (7 Provinces, 77 Districts, 753 Local Levels, ~6,743 Wards).
4. **CLI Tools:** Build a `Geo:ValidateMaster` command to ensure tree integrity (no orphans).

---

### 📅 Phase 2: Tenant Isolation & Mirroring (Week 2)

**Goal:** Automate the "Grafting" of geography when a new party signs up.

1. **Tenant Migration:** Create the local `geo_administrative_units` table with `external_geo_id` and `is_official` flags.
2. **The Mirror Service:** Develop `GeographyMirrorService` to copy data from Landlord to Tenant.
* *Algorithm:* Use an ID-Mapping array to rebuild the `parent_id` relationships in the new database context.


3. **Tenant Middleware:** Configure multi-tenancy logic to switch database connections based on the domain or header.

---

### 📅 Phase 3: The 8-Level "Safe Side" Expansion (Week 3)

**Goal:** Enable parties to extend the hierarchy down to the household level.

1. **Level 5-8 Logic:** Update Tenant models to allow adding units with `is_official = false` down to Level 8.
2. **Member Schema:** Add 8 indexed foreign key columns to the `members` table.
3. **Recursive Repository:** Build `GeoRepository` using **Recursive Common Table Expressions (CTE)** to fetch full paths (e.g., getting all 8 parents of a specific Tole in one query).
4. **Validation:** Implement the `RegisterMemberRequest` logic we discussed to ensure parent-child constraints are never broken.

---

### 📅 Phase 4: Frontend & Drill-Down UI (Week 4)

**Goal:** Create a high-performance user experience for managing deep hierarchies.

1. **Chained Dropdowns:** Build the Vue 3 component that lazy-loads children from the API as the user selects each level.
2. **Custom Unit UI:** Create the "Add Custom Unit" interface allowing admins to graft Internal Committees onto the Official Ward structure.
3. **The Migration Service:** Implement `GeoUnitMigrationService` to handle moving members between units (automatically updating all 8 parent columns on the backend).

---

### 📅 Phase 5: Analytics & Membership Cards (Week 5+)

**Goal:** Turn the data into value for the political party.

1. **Density Reports:** Create the API for "Regional Heatmaps," aggregating member counts using the 8 indexed columns.
2. **Card Generator:** Implement the PDF Service to generate Membership IDs displaying the member's full 8-level address and a verification QR code.
3. **Bulk Importer:** Build the CSV tool that maps string names (e.g., "Kathmandu") to the correct local `geo_unit_id`.

---

### 🏆 Why this Phase Plan is the "Best Approach"

* **Risk Mitigation:** By starting with the Landlord mirror (Phase 1-2), you ensure the system is usable immediately with official data.
* **Performance:** By denormalizing the 8 levels in Phase 3, you avoid "N+1" query problems during the Reporting phase.
* **Scalability:** The architecture is built to handle millions of members across thousands of tenants without cross-contamination.

**Would you like me to generate the Phase 1 Landlord Migration and Model code to get you started immediately?**
As a senior architect, I’ve mapped out this project to ensure **data sovereignty** for tenants while maintaining a **single source of truth** for official geography.

Here is your phase-wise implementation guide, followed by the specific Claude CLI instructions.

---

### 🗺️ High-Level Project Architecture

| Component | Database | Model Class | Responsibility |
| --- | --- | --- | --- |
| **Landlord Master** | `publicdigit` | `MasterGeoUnit` | Store official 7 provinces, 77 districts, 753 local levels. |
| **Tenant Local** | `tenant_db` | `GeoAdministrativeUnit` | Store local copy of official data + custom party units (Levels 5-8). |
| **Member Record** | `tenant_db` | `Member` | Stores IDs for all 8 levels for  reporting speed. |

---

### 📅 Phase 1: The "Golden Source" (Landlord)

**Objective:** Set up the Nepal official map in the central `publicdigit` database.

* **Tasks:** * Create migration for `np_geo_administrative_units`.
* Implement the `MasterGeoUnit` model with the `landlord` connection.
* Seed official government data (Levels 1–4).



### 📅 Phase 2: Isolation & Mirroring (The Bridge)

**Objective:** Copy the official map to a new tenant's database automatically.

* **Tasks:** * Create the tenant-side `geo_administrative_units` table.
* Build the `GeographyMirrorService` to handle the cross-database ID mapping.
* Link tenant units back to master units via `external_geo_id`.



### 📅 Phase 3: 8-Level Expansion & Validation

**Objective:** Enable deep party hierarchy (Toles/Cells/Households).

* **Tasks:** * Update `Member` schema with 8 indexed foreign keys.
* Implement `GeoRepository` with **Recursive CTEs** to fetch ancestry.
* Write `RegisterMemberRequest` to validate 8-level parent-child integrity.



### 📅 Phase 4: Intelligence & Analytics

**Goal:** Generate value from the data.

* **Tasks:** * Create high-speed "Density Reports" using the denormalized member columns.
* Build the **Membership Card Service** with QR code and auto-filled 8-level address.



---

### 🤖 Claude CLI Prompt Instructions (Hybrid Implementation)

Copy and paste this into Claude/AI to generate the high-precision backend code.

> **Role:** Senior Backend Developer & Solution Architect.
> **Objective:** Build a hybrid multi-tenant geography system for a Laravel 12 application.
> **Architecture Requirements:**
> 1. **Landlord Model:** Create `MasterGeoUnit` in `app/Models/Landlord/`.
> * Connection: `landlord` (Table: `np_geo_administrative_units`).
> * Levels: 1 (Province), 2 (District), 3 (Municipality), 4 (Ward).
> 
> 
> 2. **Tenant Model:** Create `GeoAdministrativeUnit` in `app/Models/Tenant/`.
> * Connection: `tenant`.
> * Fields: `id`, `parent_id`, `name_en`, `name_np`, `admin_level` (1-8), `is_official` (bool), `external_geo_id` (nullable).
> * Relations: Self-referencing `parent()` and `children()`.
> 
> 
> 3. **The Mirror Service:** Create `GeographyMirrorService` to sync data.
> * Logic: It must fetch `MasterGeoUnit` records and recreate them in the `tenant` database.
> * Key Constraint: Use an associative array map to correctly link `parent_id` values in the tenant DB to their new local primary keys.
> 
> 
> 4. **The Repository:** Create a `GeoRepositoryInterface` and Eloquent implementation.
> * Method `getAncestry(int $unitId)`: Must use a recursive loop or CTE to return all parent IDs up to level 1.
> 
> 
> 5. **Member Service:** Create `MemberGeographyService` with `updateMemberLocation(Member $member, int $lowestUnitId)`.
> * Logic: Use the Repository to find the ancestry of `$lowestUnitId`. Update the member's `admin_unit_level1_id` through `admin_unit_level8_id` columns accordingly.
> 
> 
> 6. **Coding Style:** Strict typing, Repository pattern, and Domain-Driven Design.
> 
> 

---

### 🛡️ Why this makes you "Safe"

* **Speed:** Storing 8 levels on the member record makes your "How many members in District X?" query a simple `COUNT` without joins.
* **Isolation:** A party can add a "Youth Cell" at Level 6 without touching your master Nepal data.
* **Resilience:** If the Landlord DB goes offline, the tenant's data is already local and fully functional.

**Would you like me to output the specific migration file for Phase 1 to get your Landlord DB ready?**
