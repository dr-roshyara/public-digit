# Dynamic Modular SaaS Platform: Architectural Development Plan

## Executive Summary
**Vision:** Transform from a static multi-tenant database to a dynamic, plug-and-play SaaS platform for political organizations with global applicability.

**Core Challenge:** Bridge abstract geographic hierarchies with tenant-specific organizational realities through on-demand module installation.

**Architectural Philosophy:** Separation of concerns between **Membership Context** (who/where) and **Committee Context** (structure/power).

---

## Phase 1: Foundation & Membership Context (Weeks 1-6)

### 1.1 Database Architecture
**Primary Technology:** PostgreSQL with `ltree` and `pg_trgm` extensions
- Enable hierarchical queries via materialized paths (`1.24.5.32`)
- Implement fuzzy search for member names across languages

**Core Tables:**
1. **`org_units`** (Tenant DB)
   - Bridges Landlord geography with tenant organizational reality
   - Contains `path` (ltree), `landlord_geo_id`, `tenant_id`, `level_type`
   - **Index:** GiST on `path` for O(log n) hierarchical queries

2. **`members`** (Tenant DB)
   - Links to `tenant_users` (1:1 relationship)
   - Denormalized `unit_path` for performance
   - **Indexes:** 
     - GiST on `unit_path` for jurisdiction filtering
     - GIN trigram on `full_name` for fuzzy search

3. **`membership_permissions`** (Tenant DB)
   - Implements Attribute-Based Access Control (ABAC)
   - Scopes permissions by geographic path

### 1.2 Realization Service
**Pattern:** Service Layer + Repository Pattern
- `OrgUnitRealizationService`: Creates/retrieves org units based on geography + sector
- Automatically builds materialized paths
- Ensures data integrity through transactions

### 1.3 Jurisdiction & Security
**Implementation:**
- Laravel Policies for fine-grained access control
- Global Scope for automatic data filtering
- Middleware for tenant identification and path scoping

**ABAC Logic:** `User.scope_path` must be prefix of `Member.unit_path`

---

## Phase 2: Committee & Leadership Context (Weeks 7-10)

### 2.1 Abstract Committee Structure
**Tables:**
- `committees`: Links to `org_units`, defines committee type
- `post_templates`: Abstract definitions of roles/positions
- `posts`: Concrete titles with hierarchical weights
- `committee_assignments`: Bridges members to committees with posts

### 2.2 Design Patterns
- **Template Method:** Different post structures per committee type
- **Bridge Pattern:** Decouples geography from organizational power
- **Composite Pattern:** Recursive committee hierarchies

---

## Phase 3: Communication Layer (Weeks 11-14)

### 3.1 Scoped Forum System
**Architecture:** Recursive visibility with path-prefix filtering
- `forum_scopes`: Maps to `org_units`
- `threads`: Tagged with `unit_path` for scope filtering
- `posts`: Adjacency list with recursive CTE for threading

### 3.2 Broadcast System
**Implementation:**
- `announcements` table with `target_path` (ltree)
- PostgreSQL `@>` operator for efficient ancestor queries
- Vue 3 recursive components for hierarchical display

**Permission Inheritance:** Chain of Responsibility pattern up the hierarchy tree

---

## Phase 4: Advanced Features & Scaling (Weeks 15-20)

### 4.1 Search Optimization
**Algorithms:**
- B-Tree range scanning for geographic filters
- Trigram indexing (pg_trgm) for typo-tolerant name search
- Roaring Bitmaps for complex multi-attribute filtering
- Levenshtein distance for relevance scoring

### 4.2 Internationalization
**Geography Abstraction:**
- Landlord DB stores country-specific administrative levels
- Materialized path logic remains identical across countries
- Sector system accommodates cultural organizational differences

### 4.3 Performance Optimization
- Redis caching for rarely-changing geography names
- Database connection pooling
- Read replicas for analytics queries

---

## Technical Stack Recommendations

### Backend
- **PHP 8.3+ / Laravel 11**
- Multi-tenancy: `stancl/tenancy` package
- Admin UI: Filament PHP
- Authentication: SaaS solution (Clerk/Logto)

### Database
- **PostgreSQL 15+**
- Essential extensions: `ltree`, `pg_trgm`
- Connection: PgBouncer for pooling

### Frontend
- Vue 3 with Inertia.js
- Tailwind CSS for styling
- Recursive components for hierarchical data

### Development Tools
- Claude CLI / Aider for AI-assisted development
- Git with conventional commits
- Docker for environment consistency

---

## Solo Development Strategy

### 1. AI-Assisted Workflow
- **Phase 1:** Use Claude web interface for PRD and architectural validation
- **Phase 2:** Claude CLI for scaffolding and boilerplate generation
- **Phase 3:** Multi-agent review for security auditing

### 2. Risk Mitigation
- **Critical:** Automated tests for data isolation (tenant A ≠ tenant B)
- **Essential:** Load testing for "noisy neighbor" scenarios
- **Recommended:** Third-party security audit before production

### 3. Master System Prompt
Create `.clauderules` file with:
- Multi-tenant isolation requirements
- Materialized path patterns
- ABAC security constraints
- Testing mandates

---

## Success Metrics

### Phase 1 Completion
- [ ] PostgreSQL extensions enabled
- [ ] `org_units` and `members` migrations with proper indexes
- [ ] Realization service with transaction support
- [ ] Jurisdiction policies working
- [ ] 100% test coverage for data isolation

### Phase 2 Completion
- [ ] Committee structure tables
- [ ] Post template system
- [ ] Member-to-committee assignment

### Phase 3 Completion
- [ ] Forum scoping by organizational unit
- [ ] Broadcast announcement system
- [ ] Permission inheritance up hierarchy

### Phase 4 Completion
- [ ] Fuzzy search with typo tolerance
- [ ] Multi-country geography support
- [ ] Caching layer implementation
- [ ] Load testing with simulated 10k users

---

## Next Immediate Actions

1. **Initialize Repository** with master system prompt
2. **Generate Core Migrations** using Claude CLI:
   - PostgreSQL extensions
   - `org_units` with ltree path
   - `members` with denormalized path and trigram index
3. **Implement Realization Service** with recursive parent resolution
4. **Create ABAC Policies** for jurisdiction checking

---

## Design Patterns Summary

| Pattern | Application | Benefit |
|---------|------------|---------|
| **Bridge** | Geography ↔ Organization | Decouples physical map from political structure |
| **Composite** | Org unit hierarchy | Uniform treatment of Ward ↔ Province |
| **Template Method** | Committee structures | Customizable posts per committee type |
| **Chain of Responsibility** | Permission inheritance | Efficient permission checks up hierarchy |
| **Materialized Path** | Geographic filtering | O(log n) descendant queries |

This plan maintains the sophisticated architecture needed for a global political platform while providing clear, phased implementation guidance for solo development with AI assistance.