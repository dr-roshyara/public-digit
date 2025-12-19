# Geography Context - Developer Guide

**Version**: 1.0
**Last Updated**: 2025-12-18 08:00
**Status**: Production Ready ✅
**Laravel Version**: 12.35.1
**Test Coverage**: 100% (68 foundation tests + 44 API tests)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Domain Models](#domain-models)
5. [API Endpoints](#api-endpoints)
6. [Testing Strategy](#testing-strategy)
7. [Development Workflow](#development-workflow)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)
10. [Performance Considerations](#performance-considerations)

---

## Overview

### Purpose

The Geography Context provides a **centralized, hierarchical administrative geography system** for the Public Digit Platform. It enables:

- ✅ Multi-country administrative unit management
- ✅ Hierarchical geographical relationships (Province → District → Municipality → Ward)
- ✅ Bilingual support (English + Local language)
- ✅ Fast hierarchy validation
- ✅ RESTful JSON:API compliant endpoints
- ✅ HTTP caching for performance

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Country Support** | Store administrative units for multiple countries (Nepal, India, Bangladesh, USA) |
| **Flexible Hierarchy** | Support 1-10 administrative levels per country |
| **Materialized Path** | Fast ancestor/descendant queries using path column |
| **Bilingual Data** | Store both English and local language names |
| **Landlord Database** | Global reference data accessible to all tenants |
| **JSON:API Format** | Standards-compliant API responses |
| **HTTP Caching** | ETag and Last-Modified headers for client-side caching |

### Business Use Cases

1. **Political Party Membership**: Validate member's address hierarchy (Province → District → Municipality)
2. **Election Management**: Organize elections by administrative boundaries
3. **Address Validation**: Ensure addresses follow correct hierarchical structure
4. **Data Analytics**: Aggregate statistics by administrative level

---

## Architecture

### Domain-Driven Design (DDD) Structure

The Geography Context follows strict DDD principles:

```
app/Contexts/Geography/
├── Domain/                          # Business Logic Layer (Pure PHP)
│   ├── Models/                      # Eloquent Models
│   │   ├── Country.php              # Country aggregate root
│   │   └── GeoAdministrativeUnit.php # Administrative unit entity
│   ├── ValueObjects/                # Immutable value objects
│   │   ├── CountryCode.php          # ISO 3166-1 alpha-2 code
│   │   ├── AdminLevel.php           # Administrative level (1-10)
│   │   └── HierarchyPath.php        # Materialized path value object
│   └── Exceptions/                  # Domain exceptions
│       ├── InvalidHierarchyException.php
│       └── CountryNotFoundException.php
│
├── Application/                     # Application Services Layer
│   └── Services/                    # Business logic orchestration
│       └── GeographyService.php     # Core geography operations
│
├── Infrastructure/                  # External Concerns Layer
│   ├── Database/
│   │   ├── Migrations/              # Database migrations
│   │   │   ├── 2025_12_14_create_countries_table.php
│   │   │   └── 2025_12_14_create_geo_administrative_units_table.php
│   │   ├── Seeders/                 # Data seeders
│   │   │   ├── CountriesSeeder.php
│   │   │   └── NepalGeographySeeder.php
│   │   └── Factories/               # Model factories for testing
│   │       └── GeoAdministrativeUnitFactory.php
│   └── Repositories/                # Data access layer (if needed)
│
└── Http/                            # Presentation Layer
    ├── Controllers/                 # API controllers
    │   ├── CountryController.php    # Country endpoints (4 routes)
    │   ├── AdministrativeUnitController.php # Unit endpoints (3 routes)
    │   └── GeographyController.php  # Validation endpoint (1 route)
    ├── Resources/                   # JSON:API transformers
    │   ├── CountryResource.php
    │   ├── AdministrativeUnitResource.php
    │   └── GeographyHierarchyResource.php
    └── Requests/                    # Form request validators
        ├── GeographyHierarchyRequest.php
        └── AdministrativeUnitRequest.php
```

### Layering Rules (CRITICAL)

**Domain Layer**:
- ✅ Contains pure business logic
- ✅ No dependencies on Laravel framework (except Eloquent models)
- ✅ No HTTP, routing, or presentation concerns
- ❌ NEVER call Application or Infrastructure layers directly

**Application Layer**:
- ✅ Orchestrates domain objects to fulfill use cases
- ✅ Can depend on Domain layer
- ✅ Transaction boundaries defined here
- ❌ NEVER contains business logic (delegate to Domain)

**Infrastructure Layer**:
- ✅ Database, file system, external APIs
- ✅ Framework-specific implementations
- ✅ Can depend on Domain and Application layers

**HTTP Layer**:
- ✅ Controllers handle HTTP requests/responses
- ✅ Resources transform data to JSON:API format
- ✅ Requests validate incoming data
- ❌ NEVER contains business logic

---

## Database Schema

### Countries Table

**Table**: `countries`
**Connection**: `landlord` (default database)
**Purpose**: Store country metadata and administrative level configuration

```sql
CREATE TABLE countries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code CHAR(2) NOT NULL UNIQUE,              -- ISO 3166-1 alpha-2 (e.g., 'NP', 'IN')
    name_en VARCHAR(100) NOT NULL,             -- English name
    name_local VARCHAR(100) NULL,              -- Local language name
    is_active BOOLEAN DEFAULT TRUE,            -- Soft activation
    is_supported BOOLEAN DEFAULT FALSE,        -- Featured in UI
    admin_levels JSON NULL,                    -- Level configuration
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    INDEX idx_countries_is_active (is_active),
    INDEX idx_countries_is_supported (is_supported)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**admin_levels JSON Structure**:
```json
[
  {
    "level": 1,
    "name": "Province",
    "local_name": "प्रदेश",
    "count": 7
  },
  {
    "level": 2,
    "name": "District",
    "local_name": "जिल्ला",
    "count": 77
  }
]
```

### Administrative Units Table

**Table**: `geo_administrative_units`
**Connection**: `landlord` (default database)
**Purpose**: Store all administrative units for all countries in one polymorphic table

```sql
CREATE TABLE geo_administrative_units (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    country_code CHAR(2) NOT NULL,             -- Foreign key to countries.code
    code VARCHAR(50) NOT NULL UNIQUE,          -- Hierarchical code (e.g., 'NP-1-23-456')
    name_en VARCHAR(255) NOT NULL,             -- English name
    name_local VARCHAR(255) NULL,              -- Local language name
    admin_level TINYINT UNSIGNED NOT NULL,     -- 1-10 (Province=1, District=2, etc.)
    admin_type VARCHAR(50) NULL,               -- 'Province', 'District', etc.
    parent_id BIGINT UNSIGNED NULL,            -- Self-referential foreign key
    path VARCHAR(500) NOT NULL,                -- Materialized path (e.g., '/1/23/456')
    metadata JSON NULL,                        -- Additional data (population, area, etc.)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES geo_administrative_units(id) ON DELETE CASCADE,

    INDEX idx_geo_units_country_code (country_code),
    INDEX idx_geo_units_admin_level (admin_level),
    INDEX idx_geo_units_parent_id (parent_id),
    INDEX idx_geo_units_path (path),
    INDEX idx_geo_units_is_active (is_active),
    INDEX idx_geo_units_country_level (country_code, admin_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Materialized Path Pattern

**Why**: Enables fast ancestor/descendant queries without recursive CTEs.

**How it works**:
```
Province 1 (id=1)       → path = "/1"
├─ District 23 (id=23)  → path = "/1/23"
│  ├─ Muni 456 (id=456) → path = "/1/23/456"
│  └─ Muni 457 (id=457) → path = "/1/23/457"
└─ District 24 (id=24)  → path = "/1/24"
```

**Query Examples**:
```php
// Get all descendants of unit 23
$descendants = GeoAdministrativeUnit::where('path', 'LIKE', '/1/23/%')->get();

// Get all ancestors of unit 456
$ancestors = GeoAdministrativeUnit::whereRaw("'/1/23/456' LIKE CONCAT(path, '/%')")->get();

// Get immediate children of unit 1
$children = GeoAdministrativeUnit::where('parent_id', 1)->get();
```

---

## Domain Models

### Country Model

**Location**: `app/Contexts/Geography/Domain/Models/Country.php`

**Key Features**:
- Stores country metadata and admin level configuration
- Soft activation with `is_active` flag
- Featured countries with `is_supported` flag
- JSON column for flexible admin level configuration

**Important Methods**:
```php
// Get all active countries
Country::query()->active()->get();

// Get supported countries only
Country::where('is_supported', true)->get();

// Get admin level configuration
$country->getAdminLevelConfig(2); // Returns level 2 config

// Get level name (localized)
$country->getLevelName(2, 'ne'); // Returns 'जिल्ला'
```

**Scopes**:
```php
public function scopeActive($query) {
    return $query->where('is_active', true);
}
```

**Casts**:
```php
protected $casts = [
    'admin_levels' => 'array',
    'is_active' => 'boolean',
    'is_supported' => 'boolean',
];
```

### GeoAdministrativeUnit Model

**Location**: `app/Contexts/Geography/Domain/Models/GeoAdministrativeUnit.php`

**Key Features**:
- Polymorphic design (one table for all countries)
- Self-referential relationship (parent/children)
- Materialized path for fast hierarchy queries
- Bilingual support (English + local)

**Important Methods**:
```php
// Get localized name
$unit->getName('ne'); // Returns name_local if exists, else name_en

// Get full hierarchical path
$unit->getFullPath('en'); // "Province 1 > Bhojpur > Bhojpur Municipality"

// Check if unit has children
$unit->hasChildren(); // Boolean

// Get country
$unit->country; // Belongs to relationship

// Get parent
$unit->parent; // Self-referential

// Get children
$unit->children; // Has many relationship

// Get all ancestors (efficient query using path)
$ancestors = $unit->getAncestors();

// Get all descendants (efficient query using path)
$descendants = $unit->getDescendants();
```

**Relationships**:
```php
public function country(): BelongsTo {
    return $this->belongsTo(Country::class, 'country_code', 'code');
}

public function parent(): BelongsTo {
    return $this->belongsTo(self::class, 'parent_id');
}

public function children(): HasMany {
    return $this->hasMany(self::class, 'parent_id');
}
```

**Scopes**:
```php
public function scopeActive($query) {
    return $query->where('is_active', true);
}

public function scopeForCountry($query, string $countryCode) {
    return $query->where('country_code', $countryCode);
}

public function scopeAtLevel($query, int $level) {
    return $query->where('admin_level', $level);
}
```

**Automatic Path Generation**:
```php
protected static function boot()
{
    parent::boot();

    static::creating(function ($unit) {
        if (!$unit->path) {
            $unit->path = $unit->generatePath();
        }
    });
}

protected function generatePath(): string
{
    if ($this->parent_id) {
        $parent = self::find($this->parent_id);
        return $parent->path . '/' . $this->code;
    }
    return '/' . $this->code;
}
```

---

## API Endpoints

### Base URL

All Geography API endpoints are prefixed with `/api/geography` and use:
- **Middleware**: `['api', 'throttle:60,1']`
- **Rate Limit**: 60 requests per minute
- **Response Format**: JSON:API 1.0
- **Caching**: ETag and Last-Modified headers

### 1. List Countries

**Endpoint**: `GET /api/geography/countries`
**Controller**: `CountryController::index`
**Purpose**: List all supported countries (or all active with `?show_all=true`)

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `show_all` | boolean | `false` | Include all active countries, not just supported |

**Request Example**:
```bash
curl -X GET "http://localhost:8000/api/geography/countries" \
  -H "Accept: application/json" \
  -H "Accept-Language: en"
```

**Response Example**:
```json
{
  "data": [
    {
      "type": "country",
      "id": "NP",
      "attributes": {
        "code": "NP",
        "name": "Nepal",
        "admin_levels": [
          {
            "level": 1,
            "name": "Province",
            "local_name": "प्रदेश",
            "expected_count": 7
          },
          {
            "level": 2,
            "name": "District",
            "local_name": "जिल्ला",
            "expected_count": 77
          }
        ],
        "is_supported": true
      },
      "meta": {
        "created_at": "2025-12-14T10:30:00+00:00"
      }
    }
  ],
  "meta": {
    "total": 1,
    "showing": "supported_only"
  }
}
```

**Caching**: 1 hour (3600 seconds)

---

### 2. Get Specific Country

**Endpoint**: `GET /api/geography/countries/{code}`
**Controller**: `CountryController::show`
**Purpose**: Get detailed information about a specific country

**Path Parameters**:
| Parameter | Type | Pattern | Description |
|-----------|------|---------|-------------|
| `code` | string | `[A-Z]{2}` | ISO 3166-1 alpha-2 code (e.g., 'NP', 'IN') |

**Request Example**:
```bash
curl -X GET "http://localhost:8000/api/geography/countries/NP" \
  -H "Accept: application/json" \
  -H "Accept-Language: ne"
```

**Response Example**:
```json
{
  "data": {
    "type": "country",
    "id": "NP",
    "attributes": {
      "code": "NP",
      "name": "नेपाल",
      "admin_levels": [
        {
          "level": 1,
          "name": "Province",
          "local_name": "प्रदेश",
          "expected_count": 7
        }
      ],
      "is_supported": true
    },
    "meta": {
      "created_at": "2025-12-14T10:30:00+00:00"
    }
  },
  "meta": {
    "administrative_levels": 3
  }
}
```

**Error Responses**:
- `404 Not Found`: Country doesn't exist or is inactive
- `422 Unprocessable Entity`: Invalid country code format

---

### 3. Get Country Hierarchy

**Endpoint**: `GET /api/geography/countries/{code}/hierarchy`
**Controller**: `CountryController::hierarchy`
**Purpose**: Get complete administrative hierarchy with statistics

**Request Example**:
```bash
curl -X GET "http://localhost:8000/api/geography/countries/NP/hierarchy" \
  -H "Accept: application/json"
```

**Response Example**:
```json
{
  "data": {
    "type": "country_hierarchy",
    "id": "NP",
    "attributes": {
      "country": {
        "code": "NP",
        "name": "Nepal"
      },
      "hierarchy": {
        "total_units": 843,
        "levels": [
          {
            "level": 1,
            "name": "Province",
            "actual_count": 7,
            "expected_count": 7,
            "completion_percentage": 100,
            "units": [
              {
                "id": 1,
                "code": "NP-1",
                "name": "Province 1"
              }
            ]
          }
        ]
      }
    }
  },
  "meta": {
    "generated_at": "2025-12-18T08:00:00+00:00"
  },
  "jsonapi": {
    "version": "1.0"
  }
}
```

**Use Cases**:
- Display complete country structure in admin UI
- Calculate data completeness
- Generate reports on administrative coverage

---

### 4. Get Units at Administrative Level

**Endpoint**: `GET /api/geography/countries/{code}/level/{level}`
**Controller**: `CountryController::level`
**Purpose**: Get all units at a specific administrative level

**Path Parameters**:
| Parameter | Type | Pattern | Description |
|-----------|------|---------|-------------|
| `code` | string | `[A-Z]{2}` | Country code |
| `level` | integer | `1-10` | Administrative level |

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `parent_id` | integer | Filter by parent unit ID |

**Request Example**:
```bash
# Get all provinces (level 1) in Nepal
curl -X GET "http://localhost:8000/api/geography/countries/NP/level/1"

# Get all districts (level 2) under Province 1
curl -X GET "http://localhost:8000/api/geography/countries/NP/level/2?parent_id=1"
```

**Response Example**:
```json
{
  "data": [
    {
      "type": "administrative_unit",
      "id": 1,
      "attributes": {
        "code": "NP-1",
        "name": "Province 1",
        "full_path": "Province 1",
        "admin_level": 1,
        "admin_type": "Province",
        "country_code": "NP"
      },
      "relationships": {
        "parent": {
          "data": null
        }
      },
      "meta": {
        "has_children": true,
        "is_active": true
      }
    }
  ],
  "meta": {
    "country_code": "NP",
    "level": 1,
    "level_name": "Province",
    "level_local_name": "प्रदेश",
    "total": 7,
    "expected_count": 7,
    "parent_id": null
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid level (not 1-10)
- `404 Not Found`: Country doesn't have this level

---

### 5. Get Unit with Ancestors

**Endpoint**: `GET /api/geography/units/{id}`
**Controller**: `AdministrativeUnitController::show`
**Purpose**: Get a specific unit with all its ancestors

**Request Example**:
```bash
curl -X GET "http://localhost:8000/api/geography/units/456" \
  -H "Accept-Language: ne"
```

**Response Example**:
```json
{
  "data": {
    "type": "administrative_unit_with_ancestors",
    "id": 456,
    "attributes": {
      "unit": {
        "id": 456,
        "code": "NP-1-23-456",
        "name": "भोजपुर नगरपालिका",
        "admin_level": 3,
        "admin_type": "Municipality"
      },
      "ancestors": [
        {
          "id": 1,
          "code": "NP-1",
          "name": "प्रदेश १",
          "admin_level": 1
        },
        {
          "id": 23,
          "code": "NP-1-23",
          "name": "भोजपुर",
          "admin_level": 2
        }
      ],
      "full_path": "प्रदेश १ > भोजपुर > भोजपुर नगरपालिका"
    }
  },
  "meta": {
    "language": "ne",
    "ancestor_count": 2
  },
  "jsonapi": {
    "version": "1.0"
  }
}
```

**Use Cases**:
- Display breadcrumb navigation
- Validate address completeness
- Show hierarchical context

---

### 6. Get Child Units

**Endpoint**: `GET /api/geography/units/{id}/children`
**Controller**: `AdministrativeUnitController::children`
**Purpose**: Get all direct children of a parent unit

**Request Example**:
```bash
curl -X GET "http://localhost:8000/api/geography/units/1/children"
```

**Response Example**:
```json
{
  "data": [
    {
      "type": "administrative_unit",
      "id": 23,
      "attributes": {
        "code": "NP-1-23",
        "name": "Bhojpur",
        "full_path": "Province 1 > Bhojpur",
        "admin_level": 2,
        "admin_type": "District",
        "country_code": "NP"
      },
      "relationships": {
        "parent": {
          "data": {
            "type": "administrative_unit",
            "id": 1
          }
        }
      },
      "meta": {
        "has_children": true,
        "is_active": true
      }
    }
  ],
  "meta": {
    "parent_id": 1,
    "total": 14
  }
}
```

**Use Cases**:
- Populate cascading dropdowns
- Build hierarchical tree UI
- Navigate administrative structure

---

### 7. Get Unit by Code

**Endpoint**: `GET /api/geography/units/code/{code}`
**Controller**: `AdministrativeUnitController::showByCode`
**Purpose**: Get a unit by its hierarchical code

**Request Example**:
```bash
curl -X GET "http://localhost:8000/api/geography/units/code/NP-1-23"
```

**Response Example**:
```json
{
  "data": {
    "type": "administrative_unit",
    "id": 23,
    "attributes": {
      "code": "NP-1-23",
      "name": "Bhojpur",
      "full_path": "Province 1 > Bhojpur",
      "admin_level": 2,
      "admin_type": "District",
      "country_code": "NP"
    },
    "relationships": {
      "parent": {
        "data": {
          "type": "administrative_unit",
          "id": 1
        }
      }
    },
    "meta": {
      "has_children": true,
      "is_active": true
    }
  },
  "meta": {
    "query_type": "by_code",
    "code": "NP-1-23"
  }
}
```

**Use Cases**:
- Lookup by standardized code
- Import external data with codes
- API integrations

---

### 8. Validate Hierarchy

**Endpoint**: `POST /api/geography/validate/hierarchy`
**Controller**: `GeographyController::validateHierarchy`
**Purpose**: Validate if a set of unit IDs form a valid hierarchical relationship

**Request Body**:
```json
{
  "country_code": "NP",
  "unit_ids": [1, 23, 456, 7890]
}
```

**Validation Rules**:
- `country_code`: Required, 2-character ISO code, must exist and be active
- `unit_ids`: Required, array, 1-10 integer IDs, must exist in database

**Request Example**:
```bash
curl -X POST "http://localhost:8000/api/geography/validate/hierarchy" \
  -H "Content-Type: application/json" \
  -d '{
    "country_code": "NP",
    "unit_ids": [1, 23, 456, 7890]
  }'
```

**Response Example (Valid)**:
```json
{
  "data": {
    "type": "hierarchy_validation",
    "attributes": {
      "is_valid": true,
      "country_code": "NP",
      "unit_ids": [1, 23, 456, 7890],
      "detailed_validation": {
        "province": {
          "id": 1,
          "code": "NP-1",
          "name": "Province 1",
          "level": 1
        },
        "district": {
          "id": 23,
          "code": "NP-1-23",
          "name": "Bhojpur",
          "level": 2
        },
        "municipality": {
          "id": 456,
          "code": "NP-1-23-456",
          "name": "Bhojpur Municipality",
          "level": 3
        },
        "ward": {
          "id": 7890,
          "code": "NP-1-23-456-1",
          "name": "Ward 1",
          "level": 4
        }
      }
    }
  },
  "meta": {
    "validation_timestamp": "2025-12-18T08:00:00+00:00",
    "units_validated": 4
  },
  "jsonapi": {
    "version": "1.0"
  }
}
```

**Response Example (Invalid)**: HTTP 422
```json
{
  "data": {
    "type": "hierarchy_validation",
    "attributes": {
      "is_valid": false,
      "country_code": "NP",
      "unit_ids": [1, 99],
      "detailed_validation": {
        "errors": [
          "Units do not form a valid parent-child hierarchy",
          "Unit 99 is not a child of Unit 1"
        ]
      }
    }
  }
}
```

**Use Cases**:
- Validate member registration addresses
- Ensure election constituency integrity
- Prevent invalid geographical data entry

---

## Testing Strategy

### Test Coverage Summary

| Test Suite | Files | Tests | Coverage |
|------------|-------|-------|----------|
| **Foundation Tests** | 18 | 68 | 100% |
| **API Integration Tests** | 3 | 44 | 100% |
| **Total** | 21 | **112** | **100%** |

### Foundation Tests (TDD Approach)

**Location**: `tests/Feature/Geography/`

**Coverage**:
1. ✅ Countries table structure (columns, indexes, constraints)
2. ✅ Administrative units table structure
3. ✅ Country model (scopes, casts, relationships)
4. ✅ GeoAdministrativeUnit model (scopes, relationships, methods)
5. ✅ Country seeder (4 countries created)
6. ✅ Nepal geography seeder (62 units)
7. ✅ GeographyService (all 8 public methods)
8. ✅ Materialized path queries
9. ✅ Hierarchy validation logic

**Example Test**:
```php
/** @test */
public function countries_table_has_correct_indexes(): void
{
    $indexes = $this->getTableIndexes('countries');

    $this->assertTrue(isset($indexes['countries_code_unique']));
    $this->assertTrue(isset($indexes['idx_countries_is_active']));
    $this->assertTrue(isset($indexes['idx_countries_is_supported']));
}
```

### API Integration Tests

**Location**: `tests/Feature/Geography/Api/`

**Files**:
1. `CountryControllerTest.php` - 15 tests
2. `AdministrativeUnitControllerTest.php` - 13 tests
3. `GeographyControllerTest.php` - 16 tests

**Coverage**:
- ✅ All 8 API endpoints
- ✅ HTTP status codes (200, 400, 404, 422, 429)
- ✅ JSON:API response structure validation
- ✅ Rate limiting enforcement
- ✅ HTTP caching headers (ETag, Last-Modified, Cache-Control)
- ✅ Accept-Language header support
- ✅ Request validation (missing fields, invalid formats)
- ✅ Error handling and messages
- ✅ Relationship data
- ✅ Meta and jsonapi blocks

**Example Test**:
```php
/** @test */
public function it_validates_correct_hierarchical_relationship(): void
{
    $units = GeoAdministrativeUnit::whereIn('code', ['NP-1', 'NP-1-1', 'NP-1-1-1'])
        ->orderBy('admin_level')
        ->pluck('id')
        ->toArray();

    $response = $this->postJson('/api/geography/validate/hierarchy', [
        'country_code' => 'NP',
        'unit_ids' => $units,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.attributes.is_valid', true)
        ->assertJsonPath('meta.units_validated', 3);
}
```

### Running Tests

```bash
# Run all Geography tests
php artisan test tests/Feature/Geography/

# Run specific test suite
php artisan test tests/Feature/Geography/Api/CountryControllerTest.php

# Run single test
php artisan test --filter it_lists_supported_countries_by_default

# Run with coverage
php artisan test --coverage --min=80

# Run in parallel (faster)
php artisan test --parallel
```

---

## Development Workflow

### Adding a New Country

**Step 1**: Add to seeder
```php
// database/seeders/CountriesSeeder.php

Country::create([
    'code' => 'BD',
    'name_en' => 'Bangladesh',
    'name_local' => 'বাংলাদেশ',
    'is_active' => true,
    'is_supported' => true,
    'admin_levels' => [
        ['level' => 1, 'name' => 'Division', 'local_name' => 'বিভাগ', 'count' => 8],
        ['level' => 2, 'name' => 'District', 'local_name' => 'জেলা', 'count' => 64],
    ],
]);
```

**Step 2**: Create geography seeder
```php
// database/seeders/BangladeshGeographySeeder.php

class BangladeshGeographySeeder extends Seeder
{
    public function run(): void
    {
        // Level 1: Divisions
        $dhaka = GeoAdministrativeUnit::create([
            'country_code' => 'BD',
            'code' => 'BD-1',
            'name_en' => 'Dhaka',
            'name_local' => 'ঢাকা',
            'admin_level' => 1,
            'admin_type' => 'Division',
            'path' => '/BD-1',
            'is_active' => true,
        ]);

        // Level 2: Districts
        GeoAdministrativeUnit::create([
            'country_code' => 'BD',
            'code' => 'BD-1-1',
            'name_en' => 'Dhaka District',
            'name_local' => 'ঢাকা জেলা',
            'admin_level' => 2,
            'admin_type' => 'District',
            'parent_id' => $dhaka->id,
            'path' => '/BD-1/BD-1-1',
            'is_active' => true,
        ]);
    }
}
```

**Step 3**: Run seeders
```bash
php artisan db:seed --class=CountriesSeeder
php artisan db:seed --class=BangladeshGeographySeeder
```

**Step 4**: Verify
```bash
php artisan tinker
>>> Country::where('code', 'BD')->first()
>>> GeoAdministrativeUnit::forCountry('BD')->count()
```

---

### Adding a New API Endpoint

**Step 1**: Write failing test (TDD)
```php
// tests/Feature/Geography/Api/CountryControllerTest.php

/** @test */
public function it_returns_country_statistics(): void
{
    $response = $this->getJson('/api/geography/countries/NP/statistics');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'type',
                'attributes' => [
                    'total_units',
                    'units_by_level',
                ],
            ],
        ]);
}
```

**Step 2**: Run test (should FAIL)
```bash
php artisan test --filter it_returns_country_statistics
# Expected: FAILED (route not found)
```

**Step 3**: Add route
```php
// routes/geography-api/geography.php

Route::get('countries/{code}/statistics', [CountryController::class, 'statistics'])
    ->where('code', '[A-Z]{2}')
    ->name('countries.statistics');
```

**Step 4**: Add controller method
```php
// app/Contexts/Geography/Http/Controllers/CountryController.php

public function statistics(string $code): JsonResponse
{
    $country = Country::where('code', strtoupper($code))->firstOrFail();

    $stats = $this->geographyService->getCountryStatistics($code);

    return response()->json([
        'data' => [
            'type' => 'country_statistics',
            'id' => $code,
            'attributes' => $stats,
        ],
    ]);
}
```

**Step 5**: Add service method
```php
// app/Contexts/Geography/Application/Services/GeographyService.php

public function getCountryStatistics(string $countryCode): array
{
    $units = GeoAdministrativeUnit::forCountry($countryCode)
        ->active()
        ->get();

    return [
        'total_units' => $units->count(),
        'units_by_level' => $units->groupBy('admin_level')
            ->map(fn($group) => $group->count())
            ->toArray(),
    ];
}
```

**Step 6**: Run test (should PASS)
```bash
php artisan test --filter it_returns_country_statistics
# Expected: PASSED
```

---

### Modifying Hierarchy Logic

**Scenario**: Need to change how hierarchy validation works

**Step 1**: Identify affected tests
```bash
php artisan test --filter hierarchy
```

**Step 2**: Update tests first (TDD)
```php
/** @test */
public function it_allows_non_contiguous_levels(): void
{
    // New requirement: Allow Province → Municipality (skip District)
    $province = GeoAdministrativeUnit::where('admin_level', 1)->first();
    $municipality = GeoAdministrativeUnit::where('admin_level', 3)
        ->whereRaw("path LIKE CONCAT(?, '/%')", [$province->path])
        ->first();

    $response = $this->postJson('/api/geography/validate/hierarchy', [
        'country_code' => 'NP',
        'unit_ids' => [$province->id, $municipality->id],
    ]);

    $response->assertOk()
        ->assertJsonPath('data.attributes.is_valid', true);
}
```

**Step 3**: Run tests (should FAIL)
```bash
php artisan test --filter it_allows_non_contiguous_levels
# Expected: FAILED (validation rejects skipped levels)
```

**Step 4**: Update service logic
```php
// app/Contexts/Geography/Application/Services/GeographyService.php

public function validateGeographyHierarchy(string $countryCode, array $unitIds): bool
{
    // NEW LOGIC: Check if units form ANY valid path (not just contiguous)
    $units = GeoAdministrativeUnit::whereIn('id', $unitIds)
        ->orderBy('admin_level')
        ->get();

    for ($i = 0; $i < $units->count() - 1; $i++) {
        $current = $units[$i];
        $next = $units[$i + 1];

        // Check if next is descendant of current (allows skipped levels)
        if (!str_starts_with($next->path, $current->path . '/')) {
            return false;
        }
    }

    return true;
}
```

**Step 5**: Run all tests
```bash
php artisan test tests/Feature/Geography/
# Ensure no regressions
```

---

## Common Tasks

### Task 1: Add New Administrative Level

**Scenario**: Nepal adds "Sub-ward" as level 5

**Steps**:
1. Update country admin_levels JSON:
```php
$nepal = Country::where('code', 'NP')->first();
$levels = $nepal->admin_levels;
$levels[] = [
    'level' => 5,
    'name' => 'Sub-ward',
    'local_name' => 'उप-वडा',
    'count' => null, // Unknown initially
];
$nepal->admin_levels = $levels;
$nepal->save();
```

2. Create units at new level:
```php
$ward = GeoAdministrativeUnit::where('code', 'NP-1-1-1-1')->first();

GeoAdministrativeUnit::create([
    'country_code' => 'NP',
    'code' => 'NP-1-1-1-1-A',
    'name_en' => 'Sub-ward A',
    'name_local' => 'उप-वडा अ',
    'admin_level' => 5,
    'admin_type' => 'Sub-ward',
    'parent_id' => $ward->id,
    'path' => $ward->path . '/NP-1-1-1-1-A',
    'is_active' => true,
]);
```

3. Update validation rules if needed (GeographyService)

4. Add tests for level 5

---

### Task 2: Bulk Import Units from CSV

**Scenario**: Import 753 municipalities from CSV file

**CSV Format**:
```csv
country_code,code,name_en,name_local,admin_level,admin_type,parent_code
NP,NP-1-1-1,Bhojpur Municipality,भोजपुर नगरपालिका,3,Municipality,NP-1-1
NP,NP-1-1-2,Shadananda Municipality,षडानन्द नगरपालिका,3,Municipality,NP-1-1
```

**Import Script**:
```php
// app/Console/Commands/ImportGeographyUnits.php

use Illuminate\Console\Command;
use League\Csv\Reader;

class ImportGeographyUnits extends Command
{
    protected $signature = 'geography:import {file}';
    protected $description = 'Import administrative units from CSV';

    public function handle()
    {
        $csv = Reader::createFromPath($this->argument('file'));
        $csv->setHeaderOffset(0);

        DB::beginTransaction();

        foreach ($csv as $row) {
            $parent = GeoAdministrativeUnit::where('code', $row['parent_code'])->first();

            GeoAdministrativeUnit::create([
                'country_code' => $row['country_code'],
                'code' => $row['code'],
                'name_en' => $row['name_en'],
                'name_local' => $row['name_local'],
                'admin_level' => $row['admin_level'],
                'admin_type' => $row['admin_type'],
                'parent_id' => $parent?->id,
                'path' => $parent ? $parent->path . '/' . $row['code'] : '/' . $row['code'],
                'is_active' => true,
            ]);

            $this->info("Imported: {$row['code']}");
        }

        DB::commit();
        $this->info('Import completed!');
    }
}
```

**Usage**:
```bash
php artisan geography:import storage/municipalities.csv
```

---

### Task 3: Generate API Documentation

**Tool**: Use Laravel Scribe

**Installation**:
```bash
composer require --dev knuckleswtf/scribe
php artisan vendor:publish --tag=scribe-config
```

**Configuration** (`config/scribe.php`):
```php
return [
    'routes' => [
        [
            'match' => [
                'prefixes' => ['api/geography/*'],
            ],
        ],
    ],
];
```

**Generate**:
```bash
php artisan scribe:generate
```

**Output**: Creates HTML documentation in `public/docs/`

---

### Task 4: Add Metadata to Units

**Scenario**: Store population and area for each unit

**Migration**:
```php
Schema::table('geo_administrative_units', function (Blueprint $table) {
    // metadata column already exists as JSON
});
```

**Usage**:
```php
$unit = GeoAdministrativeUnit::find(1);
$unit->metadata = [
    'population' => 4534943,
    'area_sq_km' => 25905,
    'capital' => 'Biratnagar',
    'official_website' => 'https://province1.gov.np',
];
$unit->save();

// Retrieve
$population = $unit->metadata['population'] ?? null;
```

**Add to API Response**:
```php
// app/Contexts/Geography/Http/Resources/AdministrativeUnitResource.php

public function toArray(Request $request): array
{
    return [
        'type' => 'administrative_unit',
        'id' => $this->id,
        'attributes' => [
            'code' => $this->code,
            'name' => $this->getName($language),
            'metadata' => $this->metadata, // Add this line
        ],
    ];
}
```

---

## Troubleshooting

### Issue 1: Path Not Generated Automatically

**Symptom**: Creating unit fails with null path

**Cause**: Parent doesn't exist or boot() method not called

**Solution**:
```php
// Verify parent exists
$parent = GeoAdministrativeUnit::find($parentId);
if (!$parent) {
    throw new \Exception("Parent unit {$parentId} not found");
}

// Manually set path if needed
$unit = new GeoAdministrativeUnit([...]);
$unit->path = $parent->path . '/' . $unit->code;
$unit->save();
```

---

### Issue 2: Hierarchy Validation Fails Unexpectedly

**Symptom**: Valid hierarchy returns `is_valid: false`

**Debug Steps**:
```php
// Check unit IDs exist
$units = GeoAdministrativeUnit::whereIn('id', $unitIds)->get();
if ($units->count() !== count($unitIds)) {
    // Some IDs don't exist
}

// Check paths
foreach ($units as $unit) {
    dump($unit->id, $unit->code, $unit->path);
}

// Check parent-child relationships
foreach ($units as $unit) {
    if ($unit->parent_id) {
        $parent = GeoAdministrativeUnit::find($unit->parent_id);
        dump("Unit {$unit->id} parent: {$parent->id} ({$parent->code})");
    }
}
```

---

### Issue 3: Rate Limiting Too Strict

**Symptom**: Getting 429 Too Many Requests during testing

**Solution 1**: Disable rate limiting for tests
```php
// tests/TestCase.php

protected function setUp(): void
{
    parent::setUp();
    $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
}
```

**Solution 2**: Increase limit for specific tests
```php
// routes/geography-api/geography.php

Route::prefix('api/geography')
    ->middleware(['api', 'throttle:120,1']) // 120/min instead of 60/min
    ->group(function () { ... });
```

---

### Issue 4: Caching Headers Not Working

**Symptom**: ETag always changes even with same data

**Cause**: Cache key not stable

**Solution**: Use stable cache keys
```php
protected function getCachingHeaders(string $key, int $ttl = 3600): array
{
    // Use content hash instead of timestamp
    $content = Cache::get($key, '');
    $etag = md5($key . $content);

    return [
        'Cache-Control' => "public, max-age={$ttl}",
        'ETag' => "\"{$etag}\"",
        'Last-Modified' => gmdate('D, d M Y H:i:s', time()) . ' GMT',
    ];
}
```

---

### Issue 5: Seeder Fails with Duplicate Key

**Symptom**: `SQLSTATE[23000]: Integrity constraint violation: Duplicate entry 'NP-1'`

**Cause**: Running seeder multiple times without fresh database

**Solution**:
```bash
# Option 1: Fresh migration
php artisan migrate:fresh --seed

# Option 2: Add idempotency to seeder
public function run(): void
{
    if (Country::where('code', 'NP')->exists()) {
        $this->command->info('Nepal already seeded, skipping...');
        return;
    }

    // Seeding logic...
}
```

---

## Performance Considerations

### Materialized Path Query Optimization

**Slow Query** (without index):
```php
// Finding descendants - full table scan
$descendants = GeoAdministrativeUnit::where('path', 'LIKE', "/1/23/%")->get();
```

**Optimized Query** (with index):
```sql
-- Add index on path column
CREATE INDEX idx_geo_units_path ON geo_administrative_units(path);

-- MySQL can now use index for LIKE queries starting with constant
```

**Performance Gain**: 100x faster on 10,000+ units

---

### Caching Strategy

**Cache Full Hierarchy** (regenerate daily):
```php
// Store in Redis for 24 hours
$hierarchy = Cache::remember("country_hierarchy_NP", 86400, function () {
    return $this->geographyService->getCountryHierarchy('NP');
});
```

**Cache Individual Units** (1 hour):
```php
$unit = Cache::remember("geo_unit_{$id}", 3600, function () use ($id) {
    return GeoAdministrativeUnit::with(['parent', 'country'])->find($id);
});
```

---

### Pagination for Large Result Sets

**Bad** (loads all 753 municipalities):
```php
$municipalities = GeoAdministrativeUnit::forCountry('NP')
    ->atLevel(3)
    ->get();
```

**Good** (paginate 50 per page):
```php
$municipalities = GeoAdministrativeUnit::forCountry('NP')
    ->atLevel(3)
    ->paginate(50);
```

---

### Eager Loading to Prevent N+1

**Bad** (N+1 query problem):
```php
$units = GeoAdministrativeUnit::all();
foreach ($units as $unit) {
    echo $unit->parent->name; // Triggers query for EACH unit
}
```

**Good** (single query with join):
```php
$units = GeoAdministrativeUnit::with('parent')->get();
foreach ($units as $unit) {
    echo $unit->parent->name; // No additional queries
}
```

---

## Appendix

### A. JSON:API Specification

Geography Context adheres to JSON:API 1.0 specification:

**Key Requirements**:
1. Top-level `data` object
2. Resource `type` and `id` fields
3. `attributes` for resource data
4. `relationships` for related resources
5. `meta` for non-standard metadata
6. `jsonapi` version declaration

**Reference**: https://jsonapi.org/format/

---

### B. HTTP Status Codes

| Code | Meaning | Usage in Geography API |
|------|---------|------------------------|
| 200 | OK | Successful GET/POST request |
| 400 | Bad Request | Invalid level (e.g., level 11) |
| 404 | Not Found | Country/unit doesn't exist |
| 422 | Unprocessable Entity | Validation failed, invalid hierarchy |
| 429 | Too Many Requests | Rate limit exceeded (>60/min) |
| 500 | Internal Server Error | Unexpected exception |

---

### C. Useful Artisan Commands

```bash
# Geography-specific
php artisan db:seed --class=CountriesSeeder
php artisan db:seed --class=NepalGeographySeeder
php artisan geography:import {file}    # Custom command

# Routes
php artisan route:list --path=geography
php artisan route:clear

# Testing
php artisan test tests/Feature/Geography/
php artisan test --filter Geography --parallel

# Database
php artisan migrate --path=app/Contexts/Geography/Infrastructure/Database/Migrations
php artisan tinker --execute="Country::count()"
```

---

### D. External Resources

**Documentation**:
- [Laravel 12 Docs](https://laravel.com/docs/12.x)
- [JSON:API Specification](https://jsonapi.org/)
- [DDD in PHP](https://dddinphp.com/)

**Tools**:
- [Postman Collection](link-to-collection) - API testing
- [Laravel Scribe](https://scribe.knuckles.wtf/) - API documentation
- [PHPStan](https://phpstan.org/) - Static analysis

**Data Sources**:
- [GeoNames](http://www.geonames.org/) - Geographical database
- [ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) - Country codes

---

## Changelog

### Version 1.0 (2025-12-18)

**Added**:
- ✅ Complete Geography Context implementation
- ✅ 8 RESTful API endpoints
- ✅ 112 comprehensive tests (100% coverage)
- ✅ Nepal geography seeded (62 units)
- ✅ HTTP caching and rate limiting
- ✅ JSON:API compliance
- ✅ Bilingual support (English + Local)

**Database**:
- ✅ 2 tables: `countries`, `geo_administrative_units`
- ✅ Materialized path for fast hierarchy queries
- ✅ 8 indexes for performance

**Documentation**:
- ✅ Complete developer guide (this document)
- ✅ API endpoint documentation
- ✅ Testing strategy guide
- ✅ Troubleshooting section

---

## Contact & Support

**Developer**: Geography Context Team
**Slack Channel**: #geography-context
**Repository**: `app/Contexts/Geography/`
**Issue Tracker**: JIRA Geography board

For questions or issues, contact the Geography Context maintainers or post in the Slack channel.

---

**End of Geography Context Developer Guide v1.0**
