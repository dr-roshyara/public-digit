Here's a comprehensive Mermaid diagram showing the complete tenant database administration architecture with all relationships:

## 🏗️ **TENANT DATABASE ARCHITECTURE - MERMAID DIAGRAM**

```mermaid
erDiagram
    %% ========== LANDLORD DATABASE (Central Control) ==========
    
    tenants {
        char(36) id PK "UUID"
        varchar name
        varchar email
        varchar slug UK
        enum status
        varchar subdomain
        varchar domain UK
        varchar database_name
        json branding
        bigint template_id FK "References tenant_templates"
        varchar template_version
        json initial_schema
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    
    tenant_templates {
        bigint id PK
        char(36) uuid UK
        varchar name
        text description
        enum template_type
        varchar version
        json schema_snapshot
        json seed_data
        boolean is_active
        boolean is_locked
        json metadata
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    
    template_modules {
        bigint id PK
        bigint template_id FK
        varchar module_name
        enum module_type
        text schema_sql
        text seed_sql
        json dependencies
        timestamp created_at
    }
    
    tenant_migrations_history {
        bigint id PK
        char(36) tenant_id FK
        varchar migration_name
        enum migration_type
        timestamp applied_at
        bigint applied_by "tenant_user_id"
        enum status
        varchar checksum
        int execution_time_ms
        json rollback_snapshot
        json affected_tables
        text notes
    }
    
    tenant_customizations {
        bigint id PK
        char(36) tenant_id FK
        enum customization_type
        varchar object_name
        text definition_sql
        varchar template_base_version
        boolean is_active
        timestamp created_at
        bigint created_by
        timestamp updated_at
        timestamp deleted_at
    }
    
    tenant_users {
        bigint id PK
        varchar first_name
        varchar last_name
        char(36) uuid UK
        varchar email UK
        varchar phone UK
        varchar phone_country_code
        timestamp email_verified_at
        timestamp phone_verified_at
        varchar password_hash
        int failed_login_attempts
        timestamp locked_until
        tinyint must_change_password
        enum status
        bigint tenant_id FK
        json metadata
        json identity_data
        json address_data
        json professional_data
        json communication_preferences
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
        bigint created_by_id
        bigint updated_by_id
        timestamp deleted_at
    }
    
    tenant_databases {
        bigint id PK
        char(36) tenant_id FK
        varchar database_name UK
        varchar host
        int port
        varchar username
        varchar encrypted_password
        varchar connection_status
        timestamp last_health_check
        json performance_metrics
        timestamp created_at
        timestamp updated_at
    }
    
    template_migrations {
        bigint id PK
        bigint template_id FK
        varchar migration_name
        text sql_up
        text sql_down
        enum applies_to
        varchar min_template_version
        varchar max_template_version
        timestamp created_at
    }
    
    tenant_applied_migrations {
        char(36) tenant_id PK,FK
        bigint migration_id PK,FK
        timestamp applied_at
        enum status
        text notes
    }
    
    %% ========== TENANT DATABASE (Isolated Instance) ==========
    
    tenant_info {
        char(36) tenant_id "From landlord"
        varchar template_version
        timestamp last_sync
        varchar current_schema_hash
    }
    
    custom_tables {
        varchar table_name PK
        bigint customization_id "Links to landlord"
        timestamp created_at
        varchar created_by
        json table_metadata
    }
    
    %% ========== RELATIONSHIPS ==========
    
    tenants ||--o{ tenant_users : "has"
    tenants }o--|| tenant_templates : "created_from"
    tenants ||--|| tenant_databases : "uses"
    tenants ||--o{ tenant_migrations_history : "records"
    tenants ||--o{ tenant_customizations : "customizes"
    
    tenant_templates ||--o{ template_modules : "contains"
    tenant_templates ||--o{ template_migrations : "defines"
    
    template_migrations ||--o{ tenant_applied_migrations : "applied_to"
    tenants ||--o{ tenant_applied_migrations : "has_applied"
    
    %% ========== VIRTUAL RELATIONSHIPS (Cross-database) ==========
    tenants ||--o{ tenant_info : "mirrors_to"
    tenant_customizations ||--o{ custom_tables : "creates"
```

## 📊 **ARCHITECTURE FLOW DIAGRAM**

```mermaid
flowchart TD
    A[Template Management] --> B[Create/Update Template]
    B --> C{Template Repository}
    C --> D[Basic Template]
    C --> E[NGO Template]
    C --> F[Political Party Template]
    C --> G[Corporate Template]
    
    H[New Tenant Request] --> I{Select Template}
    I --> J[Apply Template Schema]
    J --> K[Create Tenant Database]
    K --> L[Seed Default Data]
    L --> M[Register in Landlord]
    
    M --> N{Tenant Evolution Path}
    N --> O[Use As-Is<br/>No Customization]
    N --> P[Add Custom Tables/Columns]
    N --> Q[Request Template Updates]
    
    P --> R[Track in tenant_customizations]
    Q --> S[Check Schema Compatibility]
    S --> T{Conflict?}
    T -->|No| U[Apply Migration]
    T -->|Yes| V[Generate Merge Script]
    
    U --> W[Record in tenant_migrations_history]
    V --> X[Manual Review Required]
    
    %% Monitoring & Administration
    Y[Admin Dashboard] --> Z[Monitor All Tenants]
    Z --> AA[Schema Drift Detection]
    Z --> BB[Performance Metrics]
    Z --> CC[Backup Management]
    
    AA --> DD{Drift Level}
    DD -->|None| EE[All Good]
    DD -->|Low| FF[Monitor]
    DD -->|Medium| GG[Alert Admin]
    DD -->|High| HH[Immediate Action]
    
    %% Backup & Recovery
    II[Backup System] --> JJ[Schema Backups]
    II --> KK[Data Backups]
    II --> LL[Point-in-Time Recovery]
    
    JJ --> MM[Store in Landlord]
    KK --> NN[Secure Storage]
```

## 🔄 **TENANT LIFECYCLE DIAGRAM**

```mermaid
stateDiagram-v2
    [*] --> TemplateSelection
    
    state TemplateSelection {
        [*] --> ReviewTemplates
        ReviewTemplates --> ChooseTemplate : Select
        ChooseTemplate --> ConfigureOptions : Next
        ConfigureOptions --> [*] : Confirm
    }
    
    TemplateSelection --> TenantProvisioning
    
    state TenantProvisioning {
        [*] --> CreateDatabase
        CreateDatabase --> ApplySchema
        ApplySchema --> SeedData
        SeedData --> SetupAdmin
        SetupAdmin --> [*] : Complete
    }
    
    TenantProvisioning --> ActiveTenant
    
    state ActiveTenant {
        [*] --> Operational
        Operational --> CustomizationRequest : Request Change
        Operational --> TemplateUpdate : Update Available
        
        CustomizationRequest --> ReviewCustomization
        ReviewCustomization --> Approved : Yes
        ReviewCustomization --> Rejected : No
        
        Approved --> ApplyCustomization
        ApplyCustomization --> Operational
        
        TemplateUpdate --> CheckCompatibility
        CheckCompatibility --> Compatible : Yes
        CheckCompatibility --> Conflict : No
        
        Compatible --> ApplyUpdate
        ApplyUpdate --> Operational
        
        Conflict --> ManualMerge
        ManualMerge --> Operational
    }
    
    ActiveTenant --> Maintenance
    
    state Maintenance {
        [*] --> Backup
        Backup --> HealthCheck
        HealthCheck --> Cleanup
        Cleanup --> [*] : Done
    }
    
    ActiveTenant --> Archived : Inactive/Suspended
    Archived --> [*] : Purged
```

## 🗺️ **DATABASE CONNECTION MAP**

```mermaid
graph TB
    subgraph "Landlord Database (Central Control)"
        L1[tenants]
        L2[tenant_templates]
        L3[tenant_migrations_history]
        L4[tenant_customizations]
        L5[tenant_databases]
    end
    
    subgraph "Template Databases"
        T1[basic_template]
        T2[ngo_template]
        T3[political_template]
        T4[corporate_template]
    end
    
    subgraph "Tenant Databases"
        TD1[tenant_nrna]
        TD2[tenant_uml]
        TD3[tenant_ncp]
        TD4[tenant_bkt]
        TD5[...]
    end
    
    %% Connections
    L1 -.->|template_id| L2
    L1 -.->|database_name| L5
    L2 -->|schema_source| T1
    L2 -->|schema_source| T2
    L2 -->|schema_source| T3
    L2 -->|schema_source| T4
    
    T1 -->|clone| TD1
    T2 -->|clone| TD2
    T3 -->|clone| TD3
    T4 -->|clone| TD4
    
    L3 -.->|tracks| TD1
    L3 -.->|tracks| TD2
    L3 -.->|tracks| TD3
    L3 -.->|tracks| TD4
    
    L4 -.->|records| TD1
    L4 -.->|records| TD2
    L4 -.->|records| TD3
    L4 -.->|records| TD4
    
    %% Admin Access
    Admin[Administrator] --> L1
    Admin --> L2
    Admin --> L3
    Admin --> L4
    Admin --> L5
    
    %% Tenant Access
    User1[Tenant User] --> TD1
    User2[Tenant User] --> TD2
    User3[Tenant User] --> TD3
    User4[Tenant User] --> TD4
```

## 📈 **MIGRATION WORKFLOW DIAGRAM**

```mermaid
sequenceDiagram
    participant A as Template Developer
    participant L as Landlord DB
    participant T as Template DB
    participant TD as Tenant DB
    participant AM as Admin/Monitor
    
    A->>T: Create New Migration
    T->>L: Register Migration (template_migrations)
    
    loop For Each Tenant
        AM->>L: Check Tenant Compatibility
        L->>TD: Analyze Schema Drift
        TD-->>L: Return Drift Report
        
        alt No Conflicts
            L->>TD: Apply Migration
            TD-->>L: Success Confirmation
            L->>L: Record in tenant_migrations_history
        else Conflicts Detected
            L->>AM: Flag for Manual Review
            AM->>AM: Review & Create Merge Script
            AM->>TD: Apply Custom Migration
            TD-->>L: Success with Notes
            L->>L: Record as 'customized' status
        end
    end
    
    AM->>L: Generate Migration Report
    L-->>AM: Summary Statistics
```

## 🔧 **IMPLEMENTATION PRIORITY MAP**

```mermaid
gantt
    title Tenant Database Architecture Implementation Timeline
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d
    
    section Foundation Phase
    Database Schema Updates        :2024-01-01, 5d
    Template System               :2024-01-03, 7d
    Tenant Creation Pipeline      :2024-01-08, 5d
    
    section Customization Phase
    Migration Tracking            :2024-01-10, 5d
    Customization System          :2024-01-12, 7d
    Schema Comparison Tools       :2024-01-15, 5d
    
    section Administration Phase
    Multi-Template Support        :2024-01-18, 7d
    Bulk Operations              :2024-01-22, 5d
    Backup/Restore System        :2024-01-24, 7d
    
    section Evolution Phase
    Schema Drift Detection       :2024-01-29, 7d
    Safe Migration Application   :2024-02-03, 5d
    Rollback Capabilities        :2024-02-05, 5d
    Performance Optimization     :2024-02-08, 7d
```

These diagrams provide a complete visual representation of your tenant database administration architecture. Would you like me to:

1. **Focus on a specific diagram** in more detail?
2. **Create implementation code** for any component shown?
3. **Generate the actual SQL** for all the tables in the ER diagram?
4. **Build the Laravel models** with the relationships shown?

The ER diagram is the most important one as it shows all the actual database tables and their relationships. The flow diagrams show how the system operates at different levels.