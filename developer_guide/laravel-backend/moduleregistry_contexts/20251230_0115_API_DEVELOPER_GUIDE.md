# 📘 ModuleRegistry API - Developer Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-30
**Base URL:** `/api/v1/platform/modules`
**Authentication:** Laravel Sanctum (Bearer Token)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Request/Response Formats](#requestresponse-formats)
5. [Error Handling](#error-handling)
6. [Code Examples](#code-examples)
7. [Testing](#testing)
8. [Common Use Cases](#common-use-cases)

---

## 🎯 Overview

The **ModuleRegistry API** provides platform administrators with access to the global module catalog. This API allows you to:

- ✅ Browse available modules
- ✅ Search and filter modules
- ✅ View module details
- ✅ Check module requirements
- ✅ Paginate through large catalogs

### **Who Can Use This API?**

- **Platform Administrators** - Full access to module catalog
- **Vue Desktop Admin** - Primary consumer (Case 3 routing)

### **Database Context:**

- **Landlord Database** - Platform-level data
- **NO tenant context required** - Global module catalog

---

## 🔐 Authentication

### **Requirements:**

1. **Laravel Sanctum Token** (Bearer authentication)
2. **Platform Admin Role** (future: role-based access)

### **Getting a Token:**

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@platform.test",
  "password": "your-password"
}
```

**Response:**
```json
{
  "token": "1|abc123xyz456...",
  "user": {
    "id": 1,
    "name": "Platform Admin",
    "email": "admin@platform.test"
  }
}
```

### **Using the Token:**

Include the token in the `Authorization` header:

```bash
Authorization: Bearer 1|abc123xyz456...
```

---

## 🌐 API Endpoints

### **Base URL:**
```
/api/v1/platform/modules
```

---

## 📖 Endpoint 1: List All Modules

**Get a paginated list of modules from the platform catalog.**

### **Endpoint:**
```http
GET /api/v1/platform/modules
```

### **Authentication:**
✅ **Required** - Bearer Token

### **Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number for pagination |
| `per_page` | integer | `15` | Items per page (max: 100) |
| `status` | string | `published` | Filter by status: `published`, `draft`, `deprecated` |
| `search` | string | `null` | Search in name, display_name, description |

### **Request Example:**

```bash
GET /api/v1/platform/modules?page=1&per_page=15&status=published&search=digital
Authorization: Bearer 1|abc123xyz456...
Accept: application/json
```

### **Response (200 OK):**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "digital_card",
      "display_name": "Digital Business Cards",
      "version": "1.0.0",
      "description": "Digital business card management for members",
      "status": "published",
      "requires_subscription": true,
      "published_at": "2025-12-29T10:00:00+00:00"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "membership_directory",
      "display_name": "Membership Directory",
      "version": "1.2.0",
      "description": "Searchable membership directory with filters",
      "status": "published",
      "requires_subscription": false,
      "published_at": "2025-11-15T08:30:00+00:00"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 45,
    "last_page": 3
  }
}
```

### **Empty Catalog Response:**

```json
{
  "data": [],
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 0,
    "last_page": 1
  }
}
```

---

## 📖 Endpoint 2: Get Single Module

**Retrieve detailed information about a specific module.**

### **Endpoint:**
```http
GET /api/v1/platform/modules/{id}
```

### **Authentication:**
✅ **Required** - Bearer Token

### **URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | ✅ Yes | Module UUID (v4 format) |

### **Request Example:**

```bash
GET /api/v1/platform/modules/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer 1|abc123xyz456...
Accept: application/json
```

### **Response (200 OK):**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "digital_card",
    "display_name": "Digital Business Cards",
    "version": "1.0.0",
    "description": "Digital business card management for members",
    "status": "published",
    "requires_subscription": true,
    "published_at": "2025-12-29T10:00:00+00:00"
  }
}
```

### **Error Responses:**

#### **404 Not Found:**
```json
{
  "message": "Module not found with ID: 550e8400-e29b-41d4-a716-446655440999"
}
```

#### **400 Bad Request:**
```json
{
  "message": "Invalid module ID format: invalid-uuid"
}
```

---

## 📊 Request/Response Formats

### **Module Object Structure:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (string) | Unique module identifier |
| `name` | string | Module code name (e.g., `digital_card`) |
| `display_name` | string | Human-readable name |
| `version` | string | Semantic version (e.g., `1.0.0`) |
| `description` | string | Module description |
| `status` | enum | `published`, `draft`, `deprecated` |
| `requires_subscription` | boolean | Whether module requires subscription |
| `published_at` | ISO 8601 | Publication timestamp (nullable) |

### **Meta Object Structure:**

| Field | Type | Description |
|-------|------|-------------|
| `current_page` | integer | Current page number |
| `per_page` | integer | Items per page |
| `total` | integer | Total items in catalog |
| `last_page` | integer | Total number of pages |

---

## ⚠️ Error Handling

### **HTTP Status Codes:**

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| `200` | OK | Request successful |
| `400` | Bad Request | Invalid UUID format |
| `401` | Unauthorized | Missing or invalid token |
| `404` | Not Found | Module doesn't exist |
| `422` | Unprocessable Entity | Invalid query parameters |
| `500` | Internal Server Error | Server error |

### **Error Response Format:**

```json
{
  "message": "Human-readable error message",
  "errors": {
    "field_name": [
      "Validation error message"
    ]
  }
}
```

### **Common Errors:**

#### **1. Invalid Token:**
```bash
401 Unauthorized
{
  "message": "Unauthenticated."
}
```

**Fix:** Ensure you're sending valid Bearer token in `Authorization` header.

---

#### **2. Invalid UUID Format:**
```bash
400 Bad Request
{
  "message": "Invalid module ID format: not-a-uuid"
}
```

**Fix:** Use valid UUID v4 format (e.g., `550e8400-e29b-41d4-a716-446655440000`).

---

#### **3. Module Not Found:**
```bash
404 Not Found
{
  "message": "Module not found with ID: 550e8400-e29b-41d4-a716-446655440999"
}
```

**Fix:** Verify the module ID exists in the catalog.

---

## 💻 Code Examples

### **JavaScript (Fetch API):**

#### **List Modules:**

```javascript
const API_BASE = 'https://your-domain.com/api/v1/platform';
const TOKEN = 'your-sanctum-token';

async function listModules(page = 1, search = null) {
  const params = new URLSearchParams({
    page: page,
    per_page: 15,
    status: 'published'
  });

  if (search) {
    params.append('search', search);
  }

  const response = await fetch(`${API_BASE}/modules?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}

// Usage
try {
  const result = await listModules(1, 'digital');
  console.log(`Found ${result.meta.total} modules`);
  result.data.forEach(module => {
    console.log(`- ${module.display_name} (${module.version})`);
  });
} catch (error) {
  console.error('Error fetching modules:', error.message);
}
```

#### **Get Single Module:**

```javascript
async function getModule(moduleId) {
  const response = await fetch(`${API_BASE}/modules/${moduleId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Module not found');
    }
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}

// Usage
try {
  const result = await getModule('550e8400-e29b-41d4-a716-446655440000');
  const module = result.data;
  console.log(`Module: ${module.display_name}`);
  console.log(`Version: ${module.version}`);
  console.log(`Status: ${module.status}`);
} catch (error) {
  console.error('Error:', error.message);
}
```

---

### **JavaScript (Axios):**

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://your-domain.com/api/v1/platform',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/json'
  }
});

// List modules
async function listModules(params = {}) {
  try {
    const response = await api.get('/modules', {
      params: {
        page: params.page || 1,
        per_page: params.perPage || 15,
        status: params.status || 'published',
        search: params.search
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error status
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

// Get single module
async function getModule(id) {
  try {
    const response = await api.get(`/modules/${id}`);
    return response.data.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Module not found');
    }
    throw new Error(error.response?.data?.message || 'Unknown error');
  }
}
```

---

### **Vue.js 3 Composition API:**

```vue
<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const modules = ref([]);
const loading = ref(false);
const error = ref(null);
const currentPage = ref(1);
const totalPages = ref(1);

const api = axios.create({
  baseURL: '/api/v1/platform',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Accept': 'application/json'
  }
});

async function fetchModules(page = 1) {
  loading.value = true;
  error.value = null;

  try {
    const response = await api.get('/modules', {
      params: {
        page: page,
        per_page: 15,
        status: 'published'
      }
    });

    modules.value = response.data.data;
    currentPage.value = response.data.meta.current_page;
    totalPages.value = response.data.meta.last_page;
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load modules';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchModules();
});
</script>

<template>
  <div>
    <h1>Module Catalog</h1>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else>
      <div v-for="module in modules" :key="module.id" class="module-card">
        <h3>{{ module.display_name }}</h3>
        <p>{{ module.description }}</p>
        <span class="version">v{{ module.version }}</span>
        <span :class="['status', module.status]">{{ module.status }}</span>
      </div>

      <div class="pagination">
        <button
          @click="fetchModules(currentPage - 1)"
          :disabled="currentPage === 1"
        >
          Previous
        </button>
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          @click="fetchModules(currentPage + 1)"
          :disabled="currentPage === totalPages"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
```

---

### **PHP (Guzzle):**

```php
<?php

use GuzzleHttp\Client;

class ModuleRegistryClient
{
    private Client $client;
    private string $token;

    public function __construct(string $baseUrl, string $token)
    {
        $this->token = $token;
        $this->client = new Client([
            'base_uri' => $baseUrl . '/api/v1/platform/',
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Accept' => 'application/json',
            ],
        ]);
    }

    /**
     * List modules with pagination and filters
     */
    public function listModules(
        int $page = 1,
        int $perPage = 15,
        string $status = 'published',
        ?string $search = null
    ): array {
        $params = [
            'page' => $page,
            'per_page' => $perPage,
            'status' => $status,
        ];

        if ($search) {
            $params['search'] = $search;
        }

        $response = $this->client->get('modules', [
            'query' => $params,
        ]);

        return json_decode($response->getBody(), true);
    }

    /**
     * Get single module by ID
     */
    public function getModule(string $moduleId): array
    {
        try {
            $response = $this->client->get("modules/{$moduleId}");
            $data = json_decode($response->getBody(), true);
            return $data['data'];
        } catch (\GuzzleHttp\Exception\ClientException $e) {
            if ($e->getResponse()->getStatusCode() === 404) {
                throw new \Exception('Module not found');
            }
            throw $e;
        }
    }
}

// Usage
$client = new ModuleRegistryClient(
    'https://your-domain.com',
    'your-sanctum-token'
);

// List modules
$result = $client->listModules(page: 1, search: 'digital');
echo "Found {$result['meta']['total']} modules\n";

foreach ($result['data'] as $module) {
    echo "- {$module['display_name']} ({$module['version']})\n";
}

// Get single module
try {
    $module = $client->getModule('550e8400-e29b-41d4-a716-446655440000');
    echo "Module: {$module['display_name']}\n";
    echo "Status: {$module['status']}\n";
} catch (\Exception $e) {
    echo "Error: {$e->getMessage()}\n";
}
```

---

### **cURL:**

#### **List Modules:**

```bash
curl -X GET \
  'https://your-domain.com/api/v1/platform/modules?page=1&per_page=15&status=published' \
  -H 'Authorization: Bearer your-sanctum-token' \
  -H 'Accept: application/json'
```

#### **Get Single Module:**

```bash
curl -X GET \
  'https://your-domain.com/api/v1/platform/modules/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer your-sanctum-token' \
  -H 'Accept: application/json'
```

#### **Search Modules:**

```bash
curl -X GET \
  'https://your-domain.com/api/v1/platform/modules?search=digital&status=published' \
  -H 'Authorization: Bearer your-sanctum-token' \
  -H 'Accept: application/json'
```

---

## 🧪 Testing

### **Manual Testing with HTTPie:**

```bash
# Install HTTPie
pip install httpie

# Set token as environment variable
export TOKEN="your-sanctum-token"

# List modules
http GET :8000/api/v1/platform/modules \
  "Authorization:Bearer $TOKEN"

# Get single module
http GET :8000/api/v1/platform/modules/550e8400-e29b-41d4-a716-446655440000 \
  "Authorization:Bearer $TOKEN"

# Search modules
http GET :8000/api/v1/platform/modules search==digital status==published \
  "Authorization:Bearer $TOKEN"
```

### **Testing with Postman:**

1. **Create Collection:** "ModuleRegistry API"

2. **Set Collection Variables:**
   - `base_url`: `https://your-domain.com`
   - `token`: `your-sanctum-token`

3. **Add Requests:**

   **List Modules:**
   ```
   GET {{base_url}}/api/v1/platform/modules
   Headers:
     Authorization: Bearer {{token}}
     Accept: application/json
   Params:
     page: 1
     per_page: 15
     status: published
   ```

   **Get Module:**
   ```
   GET {{base_url}}/api/v1/platform/modules/550e8400-e29b-41d4-a716-446655440000
   Headers:
     Authorization: Bearer {{token}}
     Accept: application/json
   ```

4. **Run Tests:**
   - Use Postman's test scripts to validate responses
   - Check status codes, JSON structure, data types

### **Automated Testing (Jest):**

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1/platform',
  headers: {
    'Authorization': 'Bearer test-token',
    'Accept': 'application/json'
  }
});

describe('ModuleRegistry API', () => {
  test('should list modules', async () => {
    const response = await api.get('/modules');

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('meta');
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  test('should get single module', async () => {
    const moduleId = '550e8400-e29b-41d4-a716-446655440000';
    const response = await api.get(`/modules/${moduleId}`);

    expect(response.status).toBe(200);
    expect(response.data.data).toHaveProperty('id', moduleId);
    expect(response.data.data).toHaveProperty('name');
    expect(response.data.data).toHaveProperty('version');
  });

  test('should return 404 for non-existent module', async () => {
    const fakeId = '550e8400-e29b-41d4-a716-446655440999';

    await expect(
      api.get(`/modules/${fakeId}`)
    ).rejects.toMatchObject({
      response: { status: 404 }
    });
  });

  test('should return 401 without authentication', async () => {
    const unauthApi = axios.create({
      baseURL: 'http://localhost:8000/api/v1/platform'
    });

    await expect(
      unauthApi.get('/modules')
    ).rejects.toMatchObject({
      response: { status: 401 }
    });
  });
});
```

---

## 🎯 Common Use Cases

### **Use Case 1: Module Catalog Browser**

**Scenario:** Display paginated list of modules with search

```javascript
class ModuleCatalog {
  constructor(apiClient) {
    this.api = apiClient;
    this.modules = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.searchQuery = '';
  }

  async loadModules(page = 1) {
    const result = await this.api.get('/modules', {
      params: {
        page: page,
        per_page: 15,
        status: 'published',
        search: this.searchQuery || null
      }
    });

    this.modules = result.data.data;
    this.currentPage = result.data.meta.current_page;
    this.totalPages = result.data.meta.last_page;

    return this.modules;
  }

  async search(query) {
    this.searchQuery = query;
    return await this.loadModules(1);
  }

  async nextPage() {
    if (this.currentPage < this.totalPages) {
      return await this.loadModules(this.currentPage + 1);
    }
  }

  async prevPage() {
    if (this.currentPage > 1) {
      return await this.loadModules(this.currentPage - 1);
    }
  }
}
```

---

### **Use Case 2: Module Details Modal**

**Scenario:** Show detailed module information in a modal

```javascript
async function showModuleDetails(moduleId) {
  try {
    const response = await api.get(`/modules/${moduleId}`);
    const module = response.data.data;

    // Create modal HTML
    const modal = `
      <div class="modal">
        <h2>${module.display_name}</h2>
        <p class="version">Version ${module.version}</p>
        <p class="description">${module.description}</p>
        <div class="status ${module.status}">${module.status}</div>
        ${module.requires_subscription ?
          '<span class="badge">Requires Subscription</span>' : ''}
        <p class="published">Published: ${module.published_at}</p>
      </div>
    `;

    // Show modal
    document.body.insertAdjacentHTML('beforeend', modal);
  } catch (error) {
    alert('Error loading module details: ' + error.message);
  }
}
```

---

### **Use Case 3: Module Availability Checker**

**Scenario:** Check if specific modules are available

```javascript
async function checkModuleAvailability(moduleNames) {
  const availableModules = {};

  for (const moduleName of moduleNames) {
    try {
      const result = await api.get('/modules', {
        params: {
          search: moduleName,
          status: 'published'
        }
      });

      const exactMatch = result.data.data.find(m => m.name === moduleName);
      availableModules[moduleName] = !!exactMatch;
    } catch (error) {
      availableModules[moduleName] = false;
    }
  }

  return availableModules;
}

// Usage
const availability = await checkModuleAvailability([
  'digital_card',
  'membership_directory',
  'event_management'
]);

console.log(availability);
// { digital_card: true, membership_directory: true, event_management: false }
```

---

### **Use Case 4: Subscription Required Modules**

**Scenario:** Filter modules that require subscription

```javascript
async function getSubscriptionModules() {
  let allModules = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await api.get('/modules', {
      params: {
        page: page,
        per_page: 100,
        status: 'published'
      }
    });

    allModules = allModules.concat(result.data.data);
    hasMore = page < result.data.meta.last_page;
    page++;
  }

  return allModules.filter(m => m.requires_subscription);
}

// Usage
const subscriptionModules = await getSubscriptionModules();
console.log(`${subscriptionModules.length} modules require subscription`);
```

---

## 📚 Best Practices

### **1. Authentication:**

✅ **DO:**
- Store tokens securely (localStorage for web, Keychain for mobile)
- Refresh tokens before expiration
- Handle 401 responses by redirecting to login

❌ **DON'T:**
- Hardcode tokens in source code
- Log tokens to console in production
- Share tokens between users

---

### **2. Error Handling:**

✅ **DO:**
```javascript
try {
  const result = await api.get('/modules');
  // Handle success
} catch (error) {
  if (error.response) {
    // Server responded with error
    if (error.response.status === 401) {
      // Redirect to login
    } else if (error.response.status === 404) {
      // Show "not found" message
    } else {
      // Show error message
      console.error(error.response.data.message);
    }
  } else {
    // Network error
    console.error('Network error:', error.message);
  }
}
```

❌ **DON'T:**
```javascript
// Silent failures
api.get('/modules').catch(() => {});

// Generic error messages
alert('Something went wrong');
```

---

### **3. Performance:**

✅ **DO:**
- Cache module list when appropriate
- Use pagination (don't fetch all at once)
- Debounce search inputs
- Show loading states

❌ **DON'T:**
- Fetch all modules on every render
- Make unnecessary API calls
- Block UI during requests

**Example - Debounced Search:**
```javascript
import { debounce } from 'lodash';

const searchModules = debounce(async (query) => {
  const result = await api.get('/modules', {
    params: { search: query }
  });
  updateUI(result.data);
}, 300); // Wait 300ms after user stops typing
```

---

### **4. Rate Limiting:**

Be mindful of API rate limits:
- Implement client-side caching
- Use pagination to limit data transfer
- Handle 429 (Too Many Requests) responses

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        await sleep(retryAfter * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

---

## 🔗 Related Documentation

- **API Architecture:** `architecture/backend/moduleregistry_contexts/phase_5/20251229_2230_phase_4_api_layer_day22.md`
- **Test Implementation:** `architecture/backend/moduleregistry_contexts/phase_5/20251230_0100_phase4_day22_GREEN_PHASE_COMPLETE.md`
- **Routing Guide:** `developer_guide/laravel-backend/routing/6-case-routing-system.md`

---

## 📞 Support

**Issues & Bugs:**
- Report at: [GitHub Issues](https://github.com/your-org/public-digit-platform/issues)

**Questions:**
- Developer Forum: (Link to forum)
- Email: dev-support@your-domain.com

---

## 📝 Changelog

### **Version 1.0.0** (2025-12-30)
- ✅ Initial release
- ✅ List modules endpoint
- ✅ Get single module endpoint
- ✅ Pagination support
- ✅ Search functionality
- ✅ Status filtering
- ✅ Sanctum authentication

---

**Last Updated:** 2025-12-30 01:15
**Maintained By:** Platform Development Team
**API Version:** v1
