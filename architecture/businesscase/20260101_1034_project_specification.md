---

# Project Specification: Multi-Tenant SaaS Platform

# 📋 PROJECT OVERVIEW
    We're building a multi-tenant SaaS platform for political parties using Laravel with Domain-Driven Design (DDD) and Hexagonal Architecture. The system supports:

    Multi-tenancy: Each political party gets isolated database

    Module system: Contexts can be installed/uninstalled per tenant

    Geography integration: Nepal administrative hierarchy (levels 1-8)

# 🏗️ CURRENT ARCHITECTURE
    Platform Context System (Implemented)
    Automatic discovery: Scans app/Contexts/{Name}/Infrastructure/Database/Migrations/

    Landlord/Tenant separation: Migrations in Landlord/ or Tenant/ folders

    ModuleRegistry: Central catalog in landlord database

    ContextInstaller: Standardized installation engine


## 1. Technical Architecture & System Context

The platform utilizes a **PostgreSQL multi-tenant architecture** (database-per-tenant isolation model) to ensure data security and scalability.

* **Central Management (Landard Database):** Acts as the primary control plane. It houses global system administrators and service provider configurations.
* **Tenant Environment:** Each customer operates within a dedicated database instance identified by a unique `tenant_slug` (e.g., `tenant_uml`).
* **Single Source of Truth (SSoT):** Global geographic administrative data (Levels 1–5) is maintained centrally in the Landard database to ensure consistency across all tenants.

## 2. Functional Domains (Contexts)

### 2.1 Tenant Onboarding & Authentication

The **TenantAuth Context** manages the lifecycle of a tenant from application to activation.

* **Provisioning Workflow:** Prospective tenants submit an application (currently handled via backend; frontend form in development).
* **Administrative Approval:** Global administrators review applications within the Landard database. Upon approval, the system programmatically generates a new PostgreSQL database and initializes the `tenant_users` table.
* **Primary Admin:** The initial applicant is automatically designated as the First User and Tenant Administrator.

### 2.2 Membership & Module Management

The **Membership Context** is a specialized subset of the Tenant User base.

* **Modular Architecture:** A sophisticated Membership Module has been developed, allowing tenants to activate and install extended functionality via their local administrative dashboard.

### 2.3 Geographic Context

* **Centralized Repository:** Maintains standardized country names and hierarchical administrative units.
* **Integration:** This data serves as the foundation for both user residential addresses and organizational committee structures.

---

## 3. Product Roadmap (Pending Tasks)

| Category | Requirement | Description |
| --- | --- | --- |
| **User Experience** | **Public Registration** | Implement self-service user registration and onboarding. |
| **Membership** | **Integration Plans** | Develop tiered subscription/integration plans for members. |
| **Data Sync** | **Geo-Sync Frontend** | Build a UI to manage and monitor two-way synchronization of geographic units between Landard and Tenant databases. |
| **Architecture** | **Geo-Schema Design** | Finalize logic for geographic data use: Residential addresses (User level) vs. Committee jurisdiction (Member level). |

---

## 4. Quality Assurance & Defect Log (Current Blockers)

The following issues were identified following the migration from MySQL to PostgreSQL:

### High Priority: Authentication & Access Failures

* **Defect - Password Reset Workflow:** The initial setup link redirects users to the password change page; however, the submission fails to persist in the database. Users remain unable to set initial credentials.
* **Defect - Database Credential Visibility:** The secure endpoint for viewing database credentials (`/setup/credentials/` token) is currently returning null or inaccessible data.
* **Defect - Tenant Login Persistence:** While the tenant login UI (`/{slug}/login`) renders correctly, authentication attempts fail, preventing system access.

> **Status Note:** These features were functional in the MySQL environment. The current regression is likely due to PostgreSQL-specific schema constraints or connection handling in the multi-tenant logic.

---

**Would you like me to help you draft the specific "Logic Diagram" for how the Geography units should sync between the central database and the tenant databases?**