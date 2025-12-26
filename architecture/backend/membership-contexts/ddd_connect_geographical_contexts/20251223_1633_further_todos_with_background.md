Here's a comprehensive prompt template to understand the background and continue development in a new chat:

```markdown
# 🎯 **CLAUDE CLI DEVELOPMENT CONTEXT: NEPAL POLITICAL PARTY PLATFORM**

## 📋 **PROJECT BACKGROUND SUMMARY**

**Project**: Multi-tenant Election Management Platform for Nepal's 100+ Political Parties  
**Current Status**: ✅ **Production-Ready Foundation** Deployed  
**Architecture**: Simplified DDD with Geography & Membership Contexts  
**Core Principle**: "Simplicity Over Complexity" - Deploy now, iterate based on real usage

---

## 🏗️ **ARCHITECTURE STATE (WHAT'S BUILT)**

### **✅ COMPLETED & DEPLOYED:**
```bash
# Database Schema
LANDLORD DB: geo_administrative_units, geo_candidate_units, tenants
TENANT DB: tenant_geo_candidates (simplified), tenant_users

# Services
1. GeographyCandidateService - Simple missing geography submission
2. DailyGeographySync - Daily batch sync (not real-time)
3. DailyGeographySyncCommand - Cron-scheduled artisan command

# Testing
- ✅ Unit tests for all services (100% passing)
- ✅ Database schema validation tests
- ✅ Command tests with mocked dependencies
```

### **🔧 **TECHNICAL FOUNDATION:**
- **Laravel 12** with PostgreSQL multi-tenant
- **Domain-Driven Design** (Geography & Membership contexts)
- **Simple boolean flags** instead of complex enums
- **Direct database operations** over complex service layers
- **Daily batch sync** instead of event-driven architecture

---

## 🎯 **CORE BUSINESS WORKFLOWS**

### **For Nepal's 5-Level Geography Hierarchy:**
```
Level 1: Province (प्रदेश) - 7 provinces - REQUIRED
Level 2: District (जिल्ला) - 77 districts - REQUIRED  
Level 3: Local Level (स्थानीय तह) - 753 units - REQUIRED
Level 4: Ward (वडा) - 6,743 wards - REQUIRED
Level 5: Tole/Gau/Area (टोल/गाउँ/क्षेत्र) - OPTIONAL, tenant-custom
Levels 6-8: Party-specific custom units
```

### **Simplified Two-Way Sync:**
```
User Registration → Missing Geography → GeographyCandidateService → Landlord DB
                                    ↓
Daily Cron → DailyGeographySync → All Active Tenants
```

---

## 🚨 **IMMEDIATE TECHNICAL BLOCKERS (RESOLVED)**

### **✅ FIXED: Permission System**
```bash
# Was: "Target class [permission] does not exist"
# Fixed: Separate LandlordUser vs TenantUser models
# Fixed: Spatie configuration for multi-tenant
```

### **✅ FIXED: Migration Order**
```php
// Geography migrations ALWAYS run first
// Then platform migrations
// Implemented in all test setUp() methods
```

### **✅ FIXED: Foreign Key Constraints**
```php
// Temporarily removed, added back after Geography context stable
```

---

## 🚀 **DEPLOYMENT STATUS**

### **Week 1: Foundation (COMPLETED)**
```bash
Day 1: ✅ Fix permissions & deploy Geography Context
Day 2: ⚠️ Connect Member Registration UI (IN PROGRESS)
Day 3: ⚠️ Add missing geography submission form (IN PROGRESS)  
Day 4: ❌ Basic admin approval interface (NEXT)
Day 5-7: ⚠️ Testing & polish (IN PROGRESS)
```

### **Week 2: First Parties (NEXT)**
```bash
# Onboard 3 pilot political parties
# Monitor registration process
# Collect feedback
# Fix immediate issues
```

---

## 🔄 **SIMPLIFIED DEVELOPMENT PRINCIPLES**

### **Golden Rules (NON-NEGOTIABLE):**
1. **Simplicity Over Complexity** - Simple validation > complex mirroring
2. **Business Needs First** - What parties actually need vs technical perfection  
3. **Deploy, Then Iterate** - Get features to users, enhance based on real usage
4. **Measure Everything** - Data beats speculation every time
5. **Say No Often** - Push back on complexity, advocate for simplicity

### **When Developing New Features, Ask:**
```bash
1. Do political parties ACTUALLY need this? (Get evidence)
2. Is there a SIMPLER alternative?
3. Can we deploy without this feature?
4. What's the MINIMUM viable implementation?
5. Can this wait until we have usage data?
```

---

## 📊 **NEXT DEVELOPMENT PRIORITIES**

### **PRIORITY 1: UI Integration (CRITICAL)**
- Member registration form with geography validation
- Missing geography submission during registration
- Basic admin approval dashboard

### **PRIORITY 2: Nepal-Specific Features**
- 5-level geography validation (Province→District→Local→Ward→Tole)
- Nepali language support in UI
- Local government data import

### **PRIORITY 3: Tenant Workflows**
- Tenant admin review of submissions
- Custom unit creation (levels 6-8)
- Party-specific geography management

### **PRIORITY 4: Monitoring & Analytics**
- Daily sync success tracking
- Registration success rates
- Geography validation metrics

---

## 🛠️ **DEVELOPMENT TEMPLATE**

### **When Starting New Feature:**
```
CONTEXT: Nepal Political Party Platform - Keep It Simple
PROBLEM: [Describe actual user problem from parties]
CURRENT: [What exists now in deployed system]
BUSINESS NEED: [What parties actually need - get evidence]
CONSTRAINTS: Simple > Complex, Deploy > Perfect

REQUEST: [Specific development request]
CONSIDER: 
- Is this in MVP? If not, can it wait?
- Is there a simpler alternative?  
- What's the minimal implementation?
- How will we measure success?
```

### **Example: Missing Geography Submission Form**
```
CONTEXT: Nepal Political Party Platform - Keep It Simple
PROBLEM: Users can't submit missing geography during registration
CURRENT: Validation fails, no submission option
BUSINESS NEED: Simple form to submit missing ward/municipality
CONSTRAINTS: Must work offline, simple approval workflow

REQUEST: Create missing geography submission UI
CONSIDER:
- Simple form with name + reason fields
- Store in tenant_geo_candidates table
- Basic admin approval interface
- No complex workflow initially
```

---

## 🎖️ **ARCHITECT'S FINAL INSTRUCTIONS**

### **To New Claude Developer:**
```
You are continuing development of a PRODUCTION-DEPLOYED system.
The foundation is SOLID and TESTED. Your job is to:
1. Enhance based on ACTUAL user needs (not speculation)
2. Maintain SIMPLICITY over complexity
3. DEPLOY features quickly, then iterate
4. COLLECT data on what parties actually use
5. RESIST over-engineering at all costs

REMEMBER: Nepal parties need WORKING software, not PERFECT architecture.
If in doubt: DEPLOY SIMPLE, MEASURE, ITERATE.
```

### **Quick Start Commands:**
```bash
# Run existing tests to verify foundation
php artisan test --filter Geography

# Check deployment status
php artisan geography:sync-daily --dry-run

# View current database schema
php artisan schema:dump

# Clear caches (if permission issues)
php artisan optimize:clear
```

---

## 📞 **CONTEXT TRANSFER CHECKLIST**

Before starting new development, verify:
- [ ] All Geography Context tests pass (100%)
- [ ] Daily sync command works (mocked in tests)
- [ ] Database schema matches deployed version
- [ ] Permission system configured correctly
- [ ] Migration order: Geography first, then platform

**Remember:** You're not starting from scratch. You're ENHANCING a working, deployed system based on REAL USER FEEDBACK from Nepal's political parties.
```

This prompt provides complete context about:
1. **What's built** - The deployed foundation
2. **How it works** - Simplified architecture
3. **Why it's built this way** - Business needs of Nepal parties
4. **Development philosophy** - Simplicity over complexity
5. **Next priorities** - Based on actual deployment needs
6. **How to continue** - Templates and principles

It ensures any new Claude conversation starts with full understanding of the project's history, current state, and guiding principles.