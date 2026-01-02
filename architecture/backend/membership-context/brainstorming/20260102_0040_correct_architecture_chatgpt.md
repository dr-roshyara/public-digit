Below is the **clean, frozen, and optimized architecture** for **Membership** and **Geography** contexts, written as a **senior solution architect** with strict DDD discipline, Laravel 12 pragmatism, and scalability in mind.

This is **not brainstorming**.
This is an **architecture contract** you can implement and defend.

---

# 🧭 ARCHITECTURE CONTRACT

## Membership & Geography Contexts (DDD + Hexagonal)

---

## 1️⃣ Strategic Design (Bounded Contexts)

### 1.1 Geography Context (Landlord – Shared Kernel)

**Purpose**

> Provide a **single source of truth** for political–administrative hierarchy
> (Nepal Levels 1–8), optimized for hierarchy queries and cross-tenant reuse.

**Context Type**

* **Shared Kernel (Read-Heavy)**
* Owned by Platform
* Referenced by Tenants via ACL

**Data Ownership**

* **ONLY landlord database**
* Tenants **never mutate** geography

---

### 1.2 Membership Context (Tenant)

**Purpose**

> Manage political members, their identity, eligibility, residence, committee
> participation, and lifecycle.

**Context Type**

* Core Domain
* Tenant-owned
* Strong invariants

**Dependency Direction**

```
Membership → Geography (via ACL only)
```

❌ No reverse dependency
❌ No shared tables
❌ No shared ORM models

---

## 2️⃣ Geography Context – Internal Architecture

### 2.1 Aggregate Design

### Aggregate Root: `GeographyNode`

```text
GeographyNode
 ├─ id (UUID)
 ├─ name
 ├─ level (1–8)
 ├─ path (ltree)
 ├─ parent_id
 ├─ is_active
```

**Invariants**

* A node’s `path` uniquely defines its position
* Level is immutable after creation
* Deactivation cascades logically (not physically)

---

### 2.2 Persistence Model (PostgreSQL)

```sql
CREATE TABLE geography_nodes (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  level SMALLINT NOT NULL,
  path LTREE NOT NULL,
  parent_id UUID NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_geo_path ON geography_nodes USING GIN (path);
CREATE INDEX idx_geo_level ON geography_nodes (level);
```

✔ Optimized subtree queries
✔ Political-hierarchy aligned

---

### 2.3 Geography Domain Events

Only **structural** events are emitted:

```text
GeographyNodeCreated
GeographyNodeDeactivated
GeographyHierarchyChanged
```

Example payload:

```json
{
  "node_id": "uuid",
  "path": "1.5.12",
  "level": 4,
  "occurred_at": "2026-01-01T10:00:00Z"
}
```

---

### 2.4 Geography Public Contract (ACL)

Tenants see **only this**:

```php
interface GeographyQueryPort
{
    public function findById(string $id): GeographyReference;
    public function findDescendants(string $path): GeographyCollection;
    public function isDescendantOf(string $childPath, string $parentPath): bool;
}
```

**Value Object (Shared Contract)**

```php
final class GeographyReference
{
    public function __construct(
        public readonly string $id,
        public readonly int $level,
        public readonly string $path
    ) {}
}
```

---

## 3️⃣ Membership Context – Internal Architecture

### 3.1 Aggregate Root: `Member`

```text
Member
 ├─ MemberId
 ├─ PersonalIdentity
 ├─ ResidenceGeography (VO)
 ├─ Status
 ├─ CommitteeRoles (Entity collection)
```

✔ Geography is **intrinsic to political identity**
✔ Committee participation is **role-based**, not identity-based

---

### 3.2 Member Aggregate (Domain Model)

```php
final class Member
{
    private MemberId $id;
    private ResidenceGeography $residence;
    private MemberStatus $status;

    /** @var CommitteeRole[] */
    private array $committeeRoles;

    public function assignResidence(ResidenceGeography $geo): void
    {
        $this->residence = $geo;
        DomainEvent::raise(new MemberResidenceAssigned($this->id, $geo));
    }

    public function assignCommitteeRole(CommitteeRole $role): void
    {
        $this->committeeRoles[] = $role;
        DomainEvent::raise(new MemberAssignedToCommittee($this->id, $role));
    }
}
```

---

### 3.3 Geography in Membership (Value Objects)

```php
final class ResidenceGeography
{
    public function __construct(
        public readonly string $geoId,
        public readonly string $path,
        public readonly int $level
    ) {}
}
```

❗ No GeographyEntity inside Membership
❗ Only immutable references

---

### 3.4 Committee Role Entity

```text
CommitteeRole
 ├─ committee_id
 ├─ role_type (President, Secretary, Member)
 ├─ geo_path
 ├─ term_start
 ├─ term_end
```

**Reason**

* Members can hold **multiple roles**
* Roles are **time-bound**
* Geography is contextual to role

---

### 3.5 Persistence (Tenant Database)

```sql
members
- id
- name
- residence_geo_id
- residence_geo_path
- residence_geo_level
- status

committee_roles
- id
- member_id
- committee_id
- role
- geo_path
- term_start
- term_end
```

✔ Reporting-friendly
✔ Indexable
✔ No joins to landlord DB

---

## 4️⃣ Integration: Membership ↔ Geography

### 4.1 Anti-Corruption Layer (ACL)

```php
final class GeographyACL
{
    public function validateResidence(string $geoId): GeographyReference
    {
        $geo = $this->client->findById($geoId);

        if ($geo->level !== 8) {
            throw new InvalidResidenceException();
        }

        return $geo;
    }

    public function validateCommitteeAssignment(
        GeographyReference $residence,
        GeographyReference $committee
    ): void {
        if (!$this->client->isDescendantOf(
            $committee->path,
            $residence->path
        )) {
            throw new InvalidCommitteeAssignment();
        }
    }
}
```

✔ All cross-context rules isolated
✔ Geography changes do not break Membership

---

## 5️⃣ Application Layer (Use Cases)

### 5.1 Register Member

```text
RegisterMemberCommand
 ├─ Validate residence via GeographyACL
 ├─ Create Member aggregate
 ├─ Persist
 ├─ Emit MemberRegistered
```

---

### 5.2 Assign Committee Role

```text
AssignCommitteeRoleCommand
 ├─ Load Member
 ├─ Validate hierarchy (ACL)
 ├─ Assign role
 ├─ Persist
 ├─ Emit MemberAssignedToCommittee
```

---

## 6️⃣ Performance Characteristics

| Operation                   | Complexity        |
| --------------------------- | ----------------- |
| Member residence lookup     | O(1)              |
| Committee eligibility check | O(1)              |
| “All members in district”   | O(log n) via path |
| Committee roll-up           | O(n) bounded      |

✔ No N+1
✔ No cross-DB joins
✔ Cacheable read models

---

## 7️⃣ What This Architecture Avoids (Intentionally)

❌ Shared tables
❌ Tenant writes to geography
❌ Deep ORM relationships
❌ Distributed transactions
❌ Event sourcing everywhere

---

## 8️⃣ Final Architecture Summary

### Geography

* Landlord-owned
* Read-heavy
* Shared Kernel
* Materialized Path
* Emits structural events

### Membership

* Tenant-owned
* Strong invariants
* Geography as Value Object
* Committee roles as entities
* ACL enforced

---

## 🏁 Final Architect Statement

> This architecture is **politically correct**, **technically scalable**,
> **DDD-compliant**, and **Laravel-realistic**.

It will:

* Scale to millions of members
* Survive administrative boundary changes
* Support analytics, finance, and campaigning
* Remain understandable to future teams

If you want next, I can:

* Write **exact Laravel 12 folder structure**
* Define **REST API contracts**
* Design **read models for dashboards**
* Draft **ADR-001 (Architecture Decision Record)**

Just tell me.
