# 🚀 **SENIOR SOLUTION ARCHITECT - CLAUDE CLI PROMPT ENGINEERING GUIDE**

## 📋 **PROMPT ENGINEERING FRAMEWORK FOR MULTI-TENANCY SYSTEM**

### **Core Philosophy:**
```
Think → Plan → Generate → Validate → Iterate
```

### **System Requirements:**
```
1. Multi-tenant database architecture
2. Template-based tenant creation  
3. Nepali political party context
4. Membership digitization
5. Scalable to 1000+ tenants
```

## 🎯 **PHASE 1: STRATEGY & PLANNING PROMPTS**

### **Prompt 1: System Architecture Blueprint**
```markdown
# CONTEXT: Multi-tenancy system for Nepali political parties
# ROLE: Senior Solution Architect
# TASK: Create comprehensive system architecture

As a Senior Solution Architect, design a complete multi-tenancy database system for Nepali political parties with these requirements:

## REQUIREMENTS:
1. **Isolation**: Each party gets separate database
2. **Templates**: Reusable schema blueprints
3. **Scalability**: Support 1000+ tenants
4. **Nepali Context**: Citizenship, provinces, districts
5. **Membership**: Digital member registration
6. **Elections**: Campaign and candidate management
7. **Compliance**: Nepal election commission requirements

## OUTPUT STRUCTURE:
- Database schema design (Landlord + Tenant)
- Template system architecture
- Migration strategy
- Security model
- Deployment architecture
- Monitoring and maintenance plan

## CONSTRAINTS:
- Use Laravel + MySQL
- Follow Nepal data privacy laws
- Support both web and mobile
- Offline-capable for field workers
- Real-time sync capabilities

Generate a comprehensive architecture document with:
1. ER diagrams (Mermaid format)
2. Database schema SQL
3. API design
4. Security implementation
5. Scalability patterns
```

### **Prompt 2: Template Design Specification**
```markdown
# CONTEXT: Template system for political party databases
# ROLE: Database Architect
# TASK: Design template structure for Nepali political parties

Design a template system that can generate complete databases for Nepali political parties with these components:

## TEMPLATE LAYERS:
1. **Core Layer** (Mandatory for all):
   - User authentication & authorization
   - Audit logging
   - Settings management
   - File storage

2. **Political Party Layer** (Party-specific):
   - Member registration (Nepali citizenship fields)
   - Committee hierarchy (Central → Province → District → Ward)
   - Election campaign management
   - Financial tracking (donations, expenses)
   - Event and meeting management

3. **Extension Layer** (Optional modules):
   - Volunteer management
   - Social media integration
   - SMS/Email campaign
   - Mobile app sync
   - Analytics dashboard

## NEPALI SPECIFIC FEATURES:
- Citizenship number validation
- Province/District/Municipality/Ward structure
- Nepali calendar integration
- Multi-language (Nepali/English)
- Voter database integration

## OUTPUT REQUIREMENTS:
1. Complete SQL for each template layer
2. Seed data for Nepali context
3. Migration files structure
4. Validation rules for Nepali data
5. Indexing strategy for performance
```

## 🛠️ **PHASE 2: TEMPLATE GENERATION PROMPTS**

### **Prompt 3: Generate Basic Template SQL**
```markdown
# CONTEXT: Base template for all tenants
# ROLE: Senior Database Engineer
# TASK: Generate core database schema SQL

Generate MySQL database schema for the BASE TEMPLATE that all tenants will inherit:

## REQUIREMENTS:
- UTF8mb4 encoding for Nepali support
- Optimized for Laravel Eloquent
- Proper indexing strategy
- Foreign key constraints
- Soft deletes where applicable
- Created/updated timestamps
- UUID for all primary keys

## CORE TABLES TO INCLUDE:
1. **users** - Party administrators and staff
2. **roles** - RBAC system (Spatie compatible)
3. **permissions** - Fine-grained access control
4. **audit_logs** - Complete change tracking
5. **settings** - Tenant configuration
6. **media_files** - Document and image storage
7. **notifications** - System notifications
8. **activity_logs** - User activity tracking

## NEPALI CONTEXT FIELDS:
- Phone format: +977XXXXXXXXX
- Address: Province → District → Municipality → Ward
- Date format: BS (Bikram Sambat) support
- Citizenship number validation

## OUTPUT FORMAT:
```sql
-- Complete MySQL DDL
-- With proper indexes
-- With foreign keys
-- With comments explaining Nepali context
```

Generate the complete SQL with:
1. Table definitions
2. Indexes (including fulltext for Nepali search)
3. Foreign key constraints
4. Triggers if needed
5. Stored procedures for common operations
6. Views for reporting
```

### **Prompt 4: Generate Political Party Template**
```markdown
# CONTEXT: Political party specialization template
# ROLE: Political System Database Specialist
# TASK: Generate Nepali political party database schema

Generate COMPLETE MySQL schema for Nepali political party template with these modules:

## MODULE 1: MEMBER REGISTRATION
- `party_members` table with Nepali citizen fields:
  - Citizenship number (unique)
  - Province/District/Municipality/Ward
  - Date of birth (BS and AD)
  - Photo, signature, thumb impression
  - Membership number (auto-generated: PARTY-YY-XXXXX)
  - Membership status (active/pending/expired)
  - Membership type (ordinary/life/student)

## MODULE 2: COMMITTEE HIERARCHY
- `party_committees` (Central → Province → District → Ward)
- `committee_members` (Position: Chairman, Secretary, etc.)
- Hierarchy with parent-child relationships
- Jurisdiction mapping to geographical areas

## MODULE 3: ELECTION MANAGEMENT
- `constituencies` (Nepal's 165 HoR + 330 Provincial)
- `election_candidates` (Party candidates)
- `campaign_activities` (Rallies, meetings)
- `voter_contacts` (Voter outreach tracking)

## MODULE 4: FINANCIAL MANAGEMENT
- `donors` (Individual/Corporate)
- `donations` (Transparent tracking)
- `expenditures` (Election Commission compliance)
- `budget_allocations` (Committee budgets)

## MODULE 5: EVENT MANAGEMENT
- `party_events` (Rallies, protests, celebrations)
- `meetings` (Committee meetings with minutes)
- `attendances` (Member participation tracking)

## NEPALI SPECIFICATIONS:
1. All tables must have Nepali/English field names
2. Province numbers (1-7) with names
3. District references (77 districts)
4. Municipalities and wards
5. Election commission reporting formats
6. Financial limits as per Nepali law

## OUTPUT:
Complete SQL with:
- All table definitions
- Relationships and constraints
- Indexes for geographical queries
- Validation triggers
- Reporting views
- Seed data for Nepali constituencies
```

### **Prompt 5: Generate Migration System**
```markdown
# CONTEXT: Template migration and versioning system
# ROLE: Database Migration Architect
# TASK: Design migration system for template evolution

Design a comprehensive migration system for template-based multi-tenancy:

## REQUIREMENTS:
1. **Template Versioning**: Semantic versioning (v1.0.0 → v1.1.0)
2. **Migration Types**:
   - Schema migrations (add/remove columns/tables)
   - Data migrations (update seed data)
   - Rollback migrations (safe undo)
3. **Tenant Synchronization**: Apply migrations to existing tenants
4. **Conflict Detection**: Handle tenant customizations
5. **Dry-run Mode**: Test migrations before applying

## MIGRATION WORKFLOW:
```
Template Developer → Creates Migration → Tests on Staging → 
Approval → Queue for Production → Apply to Tenants (with rollback plan)
```

## OUTPUT NEEDED:
1. **Migration Table Schema** (store migrations in landlord DB)
2. **Migration Application Logic** (PHP/Laravel)
3. **Conflict Detection Algorithm**
4. **Rollback Strategy**
5. **Monitoring and Reporting**

## SQL FOR MIGRATION TABLES:
```sql
-- Tables needed in landlord database
1. template_migrations
2. tenant_migration_history  
3. migration_conflicts
4. migration_rollback_points
```

## MIGRATION TYPES TO SUPPORT:
- CREATE TABLE / DROP TABLE
- ALTER TABLE (add/drop/modify columns)
- CREATE/DROP INDEX
- CREATE/DROP VIEW
- CREATE/DROP TRIGGER
- DATA migrations (UPDATE/INSERT/DELETE)

Generate complete implementation with:
1. Database schema for migration tracking
2. PHP classes for migration management
3. Conflict resolution strategies
4. Rollback mechanisms
5. Testing procedures
```

## 🚀 **PHASE 3: TENANT CREATION PROMPTS**

### **Prompt 6: Generate Tenant Provisioning System**
```markdown
# CONTEXT: Automated tenant database creation
# ROLE: DevOps & Database Automation Engineer
# TASK: Create tenant provisioning system

Design and generate code for automated tenant database provisioning:

## WORKFLOW REQUIREMENTS:
```
Party Registration → Validation → Database Creation → 
Template Application → Seed Data → User Creation → 
Branding Setup → Email Notification → Activation
```

## TECHNICAL REQUIREMENTS:
1. **Database Creation**: `CREATE DATABASE tenant_{slug}`
2. **Template Application**: Apply SQL from selected template
3. **Data Seeding**: Insert party-specific initial data
4. **User Setup**: Create admin user with credentials
5. **Connection Setup**: Configure Laravel database connection
6. **Branding**: Apply party colors/logo
7. **Monitoring**: Add to monitoring system

## SECURITY REQUIREMENTS:
1. Unique database credentials per tenant
2. SSL connections mandatory
3. IP whitelisting for admin access
4. Regular security audits
5. Backup automation

## SCALABILITY REQUIREMENTS:
1. Support 1000+ databases on single server
2. Connection pooling
3. Read replicas for large tenants
4. Automatic resource scaling
5. Performance monitoring

## OUTPUT NEEDED:
1. **Laravel Job** for async provisioning
2. **Database Manager** class
3. **Template Applier** service
4. **Seed Data Generator**
5. **Security Setup** scripts
6. **Monitoring Integration**
7. **Error Handling & Rollback**

## CODE STRUCTURE:
```php
// Main provisioning flow
class TenantProvisioner {
    public function provision(Tenant $tenant, Template $template) {
        // 1. Create database
        // 2. Apply template schema  
        // 3. Seed initial data
        // 4. Create admin user
        // 5. Setup monitoring
        // 6. Send notifications
    }
}
```

Generate complete implementation with:
1. Database creation scripts
2. Template application logic
3. Error handling and rollback
4. Security best practices
5. Performance optimizations
```

### **Prompt 7: Generate Nepali Party Tenant Setup**
```markdown
# CONTEXT: Specific setup for Nepali political parties
# ROLE: Nepal Political System Specialist
# TASK: Create tenant setup for major Nepali parties

Generate complete setup configuration for these Nepali political parties:

## PARTIES TO CONFIGURE:
1. **Nepali Congress (NC)**
   - Established: 1950
   - Color: Green
   - Structure: Central Committee → Province → District → Ward
   - Membership: ~1 million

2. **CPN UML**
   - Established: 1991  
   - Color: Red
   - Structure: Similar to NC
   - Membership: ~800,000

3. **CPN Maoist Centre (MC)**
   - Established: 1994
   - Color: Pink
   - Structure: Central Committee → ...
   - Membership: ~500,000

4. **Rastriya Swatantra Party (RSP)**
   - Established: 2022
   - Color: Yellow
   - Structure: Modern, tech-focused
   - Membership: ~200,000

5. **Rastriya Prajatantra Party (RPP)**
   - Established: 1990
   - Color: Blue
   - Structure: Traditional
   - Membership: ~300,000

## SETUP REQUIREMENTS PER PARTY:
1. **Database Configuration**:
   - Database name: `tenant_{party_slug}`
   - Admin credentials: Secure generation
   - Connection pooling settings

2. **Initial Data**:
   - Party name, abbreviation, logo
   - Contact information
   - Headquarters address
   - Key committee members

3. **Branding**:
   - Primary color (from party flag)
   - Logo URL
   - Email templates
   - SMS templates

4. **Settings**:
   - Membership fee (if any)
   - Renewal period
   - Notification preferences
   - Election commission compliance settings

5. **Structure**:
   - Committee hierarchy setup
   - District committees (based on party strength)
   - Initial admin users

## OUTPUT NEEDED:
1. **Seed Data SQL** for each party
2. **Configuration Files** (JSON/YAML)
3. **Setup Scripts** for automation
4. **Verification Scripts** to validate setup
5. **Documentation** for party administrators

## EXAMPLE OUTPUT FORMAT:
```yaml
# nepali_congress_config.yaml
party:
  name: "Nepali Congress"
  slug: "nepali-congress"
  abbreviation: "NC"
  established_year: 1950
  primary_color: "#008000"
  logo_url: "https://storage/nc-logo.png"
  
database:
  name: "tenant_nepali_congress"
  users:
    admin:
      email: "admin@nepalicongress.digital"
      name: "NC System Admin"
  
committees:
  central:
    name: "Central Working Committee"
    members:
      - name: "Sher Bahadur Deuba"
        position: "President"
      - name: "Purna Bahadur Khadka"
        position: "General Secretary"
  
settings:
  membership_fee: 100
  currency: "NPR"
  requires_citizenship_verification: true
```

Generate complete setup packages for all 5 major parties.
```

## 🔧 **PHASE 4: ADMINISTRATION & MONITORING PROMPTS**

### **Prompt 8: Generate Admin Dashboard System**
```markdown
# CONTEXT: Multi-tenant administration dashboard
# ROLE: Full-Stack Architect
# TASK: Create admin dashboard for template and tenant management

Design and generate a comprehensive admin dashboard for managing:

## DASHBOARD MODULES:
1. **Template Management**:
   - Create/edit/delete templates
   - Version control
   - Migration management
   - Template testing

2. **Tenant Management**:
   - View all tenants
   - Tenant creation wizard
   - Tenant status monitoring
   - Resource usage
   - Billing and subscriptions

3. **Migration Management**:
   - Apply migrations to tenants
   - Conflict resolution interface
   - Rollback management
   - Migration history

4. **Monitoring**:
   - Database health checks
   - Performance metrics
   - Security alerts
   - Backup status

5. **Analytics**:
   - Tenant growth trends
   - Template usage statistics
   - System performance
   - Cost analysis

## TECHNICAL REQUIREMENTS:
1. **Frontend**: Laravel Livewire + Alpine.js + Tailwind CSS
2. **Real-time Updates**: WebSockets for monitoring
3. **Security**: Multi-level admin roles
4. **Export**: CSV/Excel/PDF reports
5. **API**: RESTful API for automation

## FEATURES NEEDED:
1. **Template Editor**: Visual schema editor with code view
2. **Tenant Wizard**: Step-by-step tenant creation
3. **Migration Dashboard**: Apply/rollback with preview
4. **Health Monitor**: Real-time database monitoring
5. **Alert System**: Email/SMS notifications for issues

## OUTPUT NEEDED:
1. **Complete Laravel Application** structure
2. **Database Schema** for admin system
3. **Livewire Components** for each module
4. **API Endpoints** for automation
5. **Job System** for background tasks
6. **Security Implementation** (roles/permissions)
7. **Testing Suite** for all features

## CODE STRUCTURE:
```
app/
├── Http/
│   ├── Controllers/Admin/
│   │   ├── TemplateController.php
│   │   ├── TenantController.php
│   │   └── MigrationController.php
│   └── Livewire/
│       ├── Templates/
│       ├── Tenants/
│       └── Dashboard/
└── Services/
    ├── TemplateService.php
    ├── TenantService.php
    └── MigrationService.php
```

Generate complete admin dashboard implementation.
```

### **Prompt 9: Generate Monitoring & Alert System**
```markdown
# CONTEXT: Multi-tenant database monitoring
# ROLE: DevOps & SRE Specialist
# TASK: Create monitoring system for 1000+ tenant databases

Design a comprehensive monitoring and alerting system for multi-tenant databases:

## MONITORING REQUIREMENTS:
1. **Database Health**:
   - Connection status
   - Query performance
   - Lock contention
   - Replication lag

2. **Performance Metrics**:
   - Query response times
   - Connection counts
   - CPU/Memory/Disk usage
   - Slow query detection

3. **Business Metrics**:
   - Member registration rate
   - Active users
   - Storage growth
   - API usage

4. **Security Monitoring**:
   - Failed login attempts
   - Unusual access patterns
   - Schema changes
   - Data export activities

## ALERTING REQUIREMENTS:
1. **Alert Channels**: Email, SMS, Slack, Mobile push
2. **Alert Levels**: Info, Warning, Critical
3. **Alert Rules**: Configurable thresholds
4. **Alert Groups**: Team-based routing
5. **Alert Suppression**: Maintenance windows

## INTEGRATION REQUIREMENTS:
1. **Prometheus** for metrics collection
2. **Grafana** for dashboards
3. **AlertManager** for alert routing
4. **Laravel Horizon** for queue monitoring
5. **Sentry** for error tracking

## OUTPUT NEEDED:
1. **Monitoring Agent** (collects metrics from each tenant DB)
2. **Alert Rules** configuration (YAML)
3. **Grafana Dashboards** (JSON)
4. **Laravel Commands** for health checks
5. **API Endpoints** for monitoring data
6. **Notification System** for alerts

## CODE EXAMPLES:
```php
// Monitoring agent
class DatabaseMonitor {
    public function collectMetrics(Tenant $tenant): array {
        return [
            'connections' => $this->getConnectionCount($tenant),
            'slow_queries' => $this->getSlowQueries($tenant),
            'table_sizes' => $this->getTableSizes($tenant),
            'replication_status' => $this->getReplicationStatus($tenant),
        ];
    }
}

// Alert rule example
alert: HighConnectionCount
expr: database_connections > 100
for: 5m
labels:
  severity: warning
annotations:
  summary: "High connection count for {{ $labels.tenant }}"
```

Generate complete monitoring system implementation.
```

## 📊 **PHASE 5: OPTIMIZATION & SCALING PROMPTS**

### **Prompt 10: Generate Performance Optimization System**
```markdown
# CONTEXT: Performance optimization for multi-tenant system
# ROLE: Database Performance Architect
# TASK: Create automatic optimization system

Design an intelligent performance optimization system that:

## OPTIMIZATION AREAS:
1. **Database Optimization**:
   - Index analysis and creation
   - Query optimization
   - Table partitioning
   - Connection pooling

2. **Cache Optimization**:
   - Multi-level caching strategy
   - Cache invalidation
   - Cache warming
   - Redis clustering

3. **Query Optimization**:
   - Slow query detection
   - Query rewriting
   - Execution plan analysis
   - Materialized views

4. **Resource Optimization**:
   - Automatic scaling
   - Load balancing
   - Read/write splitting
   - Sharding strategy

## INTELLIGENT FEATURES:
1. **Machine Learning** for pattern detection
2. **Automated Recommendations** for optimization
3. **One-click Apply** for safe optimizations
4. **Rollback Capability** for every change
5. **Performance Baselines** and comparison

## OUTPUT NEEDED:
1. **Optimization Engine** (PHP/Python)
2. **Monitoring System** for performance metrics
3. **Recommendation Engine** with ML
4. **Automation Scripts** for applying optimizations
5. **Testing Framework** to validate optimizations
6. **Reporting System** for optimization results

## CODE STRUCTURE:
```python
# Optimization engine
class DatabaseOptimizer:
    def analyze(self, tenant_db) -> List[Optimization]:
        optimizations = []
        
        # Index analysis
        missing_indexes = self.find_missing_indexes(tenant_db)
        optimizations.extend(missing_indexes)
        
        # Query optimization
        slow_queries = self.analyze_slow_queries(tenant_db)
        optimizations.extend(slow_queries)
        
        # Table optimization
        table_issues = self.analyze_tables(tenant_db)
        optimizations.extend(table_issues)
        
        return self.prioritize(optimizations)
    
    def apply(self, optimization: Optimization) -> Result:
        # Apply with safety checks and rollback plan
        return self.safe_apply(optimization)
```

## OPTIMIZATION TYPES TO SUPPORT:
1. Add missing indexes
2. Remove unused indexes
3. Optimize query patterns
4. Partition large tables
5. Implement materialized views
6. Setup database replicas
7. Configure connection pooling

Generate complete optimization system with safety features.
```

## 🎯 **PROMPT ENGINEERING BEST PRACTICES**

### **Prompt Template for Specific Tasks:**
```markdown
# CONTEXT: [Brief context of what you're building]
# ROLE: [Specific role for Claude to assume]
# TASK: [Clear, specific task description]
# OUTPUT FORMAT: [Specify format: SQL, PHP, JSON, YAML, etc.]

## REQUIREMENTS:
[Detailed requirements with bullet points]

## CONSTRAINTS:
[Any limitations or constraints]

## EXAMPLES:
[Example input/output if available]

## OUTPUT STRUCTURE:
[How the output should be organized]

Please generate complete, production-ready code with:
✅ Proper error handling
✅ Security best practices  
✅ Performance optimizations
✅ Comprehensive comments
✅ Testing considerations
```

### **Advanced Prompt Techniques:**

1. **Chain of Thought Prompting:**
```markdown
Let's think step by step:

Step 1: Analyze the requirements for Nepali political party database
Step 2: Design the schema considering Nepal's administrative structure
Step 3: Create the SQL with proper indexing for Nepali data patterns
Step 4: Add validation for Nepali-specific data (citizenship, districts)
Step 5: Optimize for common Nepali political party workflows
```

2. **Few-Shot Prompting:**
```markdown
Here are examples of Nepali party database tables:

Example 1: Member table with Nepali fields
```sql
CREATE TABLE members (
    citizenship_number VARCHAR(50) UNIQUE,
    permanent_province ENUM('1','2','3','4','5','6','7'),
    permanent_district VARCHAR(100),
    -- ... more Nepali specific fields
);
```

Example 2: Committee hierarchy for Nepal
```sql
CREATE TABLE committees (
    level ENUM('central','province','district','municipality','ward'),
    province_number INT NULL,
    district_name VARCHAR(100) NULL,
    -- ... hierarchical structure
);
```

Now create a complete schema for election candidate management in Nepal...
```

3. **Role-Playing Prompt:**
```markdown
You are a Senior Database Architect who has worked with Nepal's Election Commission for 10 years. You understand:
- Nepal's political structure
- Election Commission requirements
- Data privacy laws in Nepal
- Scalability needs for political parties

Design a database system that...
```

## 🔄 **ITERATIVE PROMPTING WORKFLOW**

### **Workflow for Template Creation:**
```
1. Strategy Prompt → Get architecture overview
2. Refinement Prompt → Add specific Nepali context  
3. SQL Generation Prompt → Generate complete schema
4. Validation Prompt → Check for missing Nepali features
5. Optimization Prompt → Add indexes and performance
6. Testing Prompt → Generate test data and queries
```

### **Workflow for Tenant Setup:**
```
1. Party Analysis Prompt → Understand specific party needs
2. Configuration Prompt → Generate party-specific config
3. Seed Data Prompt → Create initial data for party
4. Validation Prompt → Verify setup completeness
5. Documentation Prompt → Generate admin guides
```

## 📝 **SPECIFIC PROMPTS FOR NEPALI CONTEXT**

### **Prompt: Nepali Data Validation Rules**
```markdown
# CONTEXT: Data validation for Nepali political system
# ROLE: Nepal Data Governance Specialist
# TASK: Create validation rules for Nepali data

Generate comprehensive validation rules for:

## CITIZENSHIP NUMBER VALIDATION:
- Format: DistrictCode-Year/Sequence (e.g., 01-05-123456)
- District code validation (77 districts)
- Year range validation (1964-present)
- Checksum validation if applicable

## PROVINCE/DISTRICT VALIDATION:
- 7 provinces with correct names in Nepali/English
- 77 districts mapping to correct provinces
- 753 local units (municipalities)
- Ward numbers (1-32 typically)

## PHONE NUMBER VALIDATION:
- Format: +977 98XXXXXXXX or 98XXXXXXXX
- Mobile prefixes: 98[0-9], 97[0-9]
- Landline patterns with area codes

## DATE VALIDATION:
- Both AD (Gregorian) and BS (Bikram Sambat)
- Age calculation for voting (18+)
- Election dates validation

## ELECTION-SPECIFIC VALIDATION:
- Constituency numbers (1-165 for HoR)
- Candidate nomination validation
- Financial limit compliance

Generate:
1. Laravel validation rules
2. Database constraints
3. JavaScript validation
4. API validation middleware
5. Test cases with Nepali examples
```

### **Prompt: Nepali Localization Setup**
```markdown
# CONTEXT: Multi-language support for Nepal
# ROLE: Localization Specialist
# TASK: Create Nepali/English localization system

Create a complete localization system for:

## LANGUAGES TO SUPPORT:
1. **Nepali** (नेपाली) - Primary
2. **English** - Secondary
3. **Maithili**, **Bhojpuri**, etc. - Optional

## LOCALIZATION AREAS:
1. **UI Texts**: Buttons, labels, messages
2. **Data Labels**: Province names, district names
3. **Documents**: Membership forms, certificates
4. **Notifications**: SMS, emails in Nepali
5. **Reports**: Government reports in Nepali format

## NEPALI SPECIFIC FEATURES:
1. **Date Display**: BS calendar with Nepali months
2. **Number Format**: Nepali numerals (१, २, ३)
3. **Currency**: NPR with Nepali formatting
4. **Address Format**: Ward → Municipality → District → Province
5. **Name Format**: First/Middle/Last with Nepali conventions

## OUTPUT NEEDED:
1. Laravel localization files (ne.json, en.json)
2. Database structure for translatable content
3. BS calendar integration
4. RTL support for Nepali UI
5. Font setup for Nepali script
6. Input methods for Nepali typing

Generate complete localization implementation.
```

## 🚀 **QUICK START PROMPT SEQUENCE**

### **For Immediate Implementation:**
```markdown
# URGENT: Need to deploy for Nepali Congress by next week
# ROLE: Rapid Deployment Specialist
# TASK: Create minimal viable system for first tenant

Generate ONLY the essential components needed to deploy for Nepali Congress:

## ESSENTIAL COMPONENTS:
1. Basic template with member registration
2. Tenant creation script for Nepali Congress
3. Admin dashboard for NC administrators
4. Member registration form with Nepali fields
5. Basic reporting for member count by district

## CAN SKIP (for now):
- Advanced election features
- Financial management
- Mobile app
- Advanced analytics

## TIMELINE: 3 days
- Day 1: Database setup and template
- Day 2: Tenant creation and basic UI
- Day 3: Testing and deployment

Generate code optimized for rapid deployment with:
✅ Minimal features that work
✅ Easy to extend later
✅ Basic security
✅ Simple deployment process
```

## 📊 **EVALUATION PROMPTS**

### **Prompt: Code Review & Security Audit**
```markdown
# CONTEXT: Security audit for multi-tenant system
# ROLE: Security Auditor
# TASK: Review generated code for security vulnerabilities

Review this multi-tenant database code for:

## SECURITY CHECKS:
1. SQL injection vulnerabilities
2. Cross-tenant data leakage
3. Authentication/authorization flaws
4. Data encryption gaps
5. Audit logging completeness

## NEPALI COMPLIANCE CHECKS:
1. Data privacy law compliance
2. Election commission requirements
3. Financial transparency rules
4. Member data protection

## PERFORMANCE CHECKS:
1. N+1 query problems
2. Missing indexes
3. Connection pooling issues
4. Cache strategy effectiveness

Provide:
1. Security vulnerability report
2. Compliance gap analysis
3. Performance improvement suggestions
4. Priority fixes (Critical/High/Medium/Low)
```

## 🎯 **FINAL IMPLEMENTATION CHECKLIST PROMPT**

```markdown
# CONTEXT: Complete multi-tenancy system implementation
# ROLE: Senior Solution Architect
# TASK: Create implementation checklist

Generate a comprehensive implementation checklist with:

## PHASE 1: TEMPLATE SYSTEM
- [ ] Landlord database schema created
- [ ] Basic template SQL generated
- [ ] Political party template SQL generated
- [ ] Migration system implemented
- [ ] Template versioning working

## PHASE 2: TENANT PROVISIONING
- [ ] Tenant creation workflow
- [ ] Database isolation working
- [ ] Nepali Congress tenant created
- [ ] UML tenant created
- [ ] Other parties as needed

## PHASE 3: ADMIN DASHBOARD
- [ ] Template management UI
- [ ] Tenant management UI
- [ ] Migration application UI
- [ ] Monitoring dashboard

## PHASE 4: NEPALI FEATURES
- [ ] Nepali localization complete
- [ ] BS calendar integration
- [ ] District/province validation
- [ ] Citizenship validation

## PHASE 5: SECURITY & COMPLIANCE
- [ ] Role-based access control
- [ ] Audit logging
- [ ] Data encryption
- [ ] Nepal compliance checks

## PHASE 6: DEPLOYMENT
- [ ] Production database setup
- [ ] Backup system
- [ ] Monitoring alerts
- [ ] Documentation complete

Generate a detailed checklist with:
- Task description
- Owner assignment
- Time estimate
- Dependencies
- Success criteria
```

---

## 💡 **PRO TIPS FOR PROMPT ENGINEERING:**

1. **Be Specific About Nepali Context** - Always mention "Nepali political parties", "citizenship validation", "province/district structure"

2. **Use Examples** - Provide sample Nepali data formats

3. **Specify Output Format** - Always ask for complete, runnable code

4. **Iterate** - Start with architecture, then implementation, then optimization

5. **Validate** - Ask Claude to review its own output for gaps

6. **Combine Roles** - Use "Senior Solution Architect + Nepal Election Expert" for specialized tasks

**Ready to start?** Begin with Phase 1 prompts and iterate through the system. Each prompt builds on the previous one, creating a complete, production-ready system for Nepali political parties!