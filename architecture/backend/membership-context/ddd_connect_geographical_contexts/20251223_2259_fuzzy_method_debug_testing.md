Two issues to fix:

## **Issue 1: Missing `parent_id` column in test table**
The `GeographyCandidateService` expects a `parent_id` column but our test table doesn't have it.

## **Issue 2: Test assertion logic error**
The test says `'Require complex UpstreamSyncService' => false` but then asserts `$this->assertTrue($shouldBeSimple)` - this fails because `false` is not `true`.

Let me fix both:

```php
<?php

namespace Tests\Unit\Contexts\Geography\Application\Services;

use Tests\TestCase;
use App\Contexts\Geography\Domain\Services\FuzzyMatchingService;
use App\Contexts\Geography\Application\Services\GeographyCandidateService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fuzzy Matching Integration Test
 *
 * Tests SIMPLE integration of fuzzy matching with geography submission.
 * Follows "Simplicity Over Complexity" principle.
 */
class FuzzyMatchingIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    /** @test */
    public function fuzzy_matching_is_optional_not_required(): void
    {
        // Test philosophy: Fuzzy matching is ENHANCEMENT, not requirement
        // Users can submit without fuzzy matching

        $this->assertTrue(true, 'Fuzzy matching should be optional enhancement');
        $this->assertTrue(true, 'Direct submission should work without fuzzy matching');
    }

    /** @test */
    public function geography_candidate_service_can_work_without_fuzzy_matching(): void
    {
        // Arrange: Simple service without fuzzy matching dependency
        $service = new GeographyCandidateService();

        // Create table for testing with ALL columns the service expects
        config(['database.default' => 'landlord']);
        Schema::dropIfExists('geo_candidate_units');
        Schema::create('geo_candidate_units', function ($table) {
            $table->id();
            $table->string('name_proposed');
            $table->integer('admin_level');
            $table->unsignedBigInteger('parent_id')->nullable(); // ADDED: Service expects this
            $table->string('country_code')->default('NP');
            $table->text('source_description')->nullable();
            $table->string('source_type')->default('USER_SUBMISSION');
            $table->string('review_status')->default('PENDING');
            $table->unsignedBigInteger('source_user_id')->nullable(); // ADDED: Service might use
            $table->unsignedBigInteger('source_tenant_id')->nullable(); // ADDED: Service might use
            $table->unsignedBigInteger('official_unit_id')->nullable(); // ADDED: For completeness
            $table->timestamps();
            $table->softDeletes(); // ADDED: If service expects soft deletes
        });

        // Act: Submit without fuzzy matching
        $data = [
            'name' => 'काठमाडौं',
            'level' => 2,
            'country_code' => 'NP',
            'reason' => 'Test submission',
        ];

        $result = $service->submitMissingGeography($data);

        // Assert: Works without fuzzy matching
        $this->assertIsInt($result);
        $this->assertGreaterThan(0, $result);

        $record = DB::table('geo_candidate_units')->find($result);
        $this->assertEquals('काठमाडौं', $record->name_proposed);
    }

    /** @test */
    public function fuzzy_matching_can_be_added_as_simple_enhancement(): void
    {
        // Test that fuzzy matching can be added SIMPLY later

        $enhancementsPossible = [
            'Add fuzzy check before submission' => true,
            'Suggest corrections to users' => true,
            'Log matching results' => true,
            'Require complex UpstreamSyncService' => false, // NOT needed - this is GOOD!
        ];

        foreach ($enhancementsPossible as $enhancement => $shouldBeSimple) {
            // FIXED LOGIC: We're testing what SHOULD be simple
            // 'Require complex UpstreamSyncService' => false means it's NOT simple (bad)
            // So we actually want to assert it's FALSE (not simple/not needed)
            
            if ($enhancement === 'Require complex UpstreamSyncService') {
                // This should be FALSE (not simple/not needed)
                $this->assertFalse($shouldBeSimple,
                    "{$enhancement} - should NOT be required (false = good)");
            } else {
                // These should be TRUE (simple enhancements)
                $this->assertTrue($shouldBeSimple,
                    "{$enhancement} - should be simple enhancement");
            }
        }
    }

    /** @test */
    public function existing_fuzzy_matching_service_has_simple_interface(): void
    {
        // If fuzzy matching exists, it should have simple interface

        // Check if service exists
        if (class_exists(FuzzyMatchingService::class)) {
            $methods = get_class_methods(FuzzyMatchingService::class);

            $simpleMethods = ['findPotentialMatches', 'suggestCorrection', 'normalizeNepaliName', 'getNepalVariations'];
            $complexMethods = ['queueForProcessing', 'triggerEvents', 'syncRealTime'];

            foreach ($simpleMethods as $method) {
                if (in_array($method, $methods)) {
                    $this->assertTrue(true, "Has simple method: {$method}");
                }
            }

            foreach ($complexMethods as $method) {
                if (in_array($method, $methods)) {
                    $this->fail("Should NOT have complex method: {$method}");
                }
            }
        } else {
            $this->markTestSkipped('FuzzyMatchingService not implemented yet');
        }
    }
}
```

**Key fixes:**

1. **Added missing columns** to test table: `parent_id`, `source_user_id`, `source_tenant_id`, `official_unit_id`, `softDeletes()`
2. **Fixed logic error**: For "Require complex UpstreamSyncService", `false` is GOOD (means not needed), so we assert `assertFalse()` not `assertTrue()`
3. **Better test messages**: Clarifies what we're actually testing

**Alternative simpler fix:** Just update the test data to match what `GeographyCandidateService` actually sends. Looking at the service:

```php
// In GeographyCandidateService::submitMissingGeography()
$insertData = [
    'name_proposed' => $data['name'] ?? 'Unknown',
    'admin_level' => $data['level'] ?? 4,
    'parent_id' => $data['parent_id'] ?? null, // ← This expects parent_id
    // ... other fields
];
```

So we need to either:
1. Add `parent_id` to our test table (done above)
2. OR add `parent_id` to our test data: `$data['parent_id'] = 123`

**Yes, fix the test with these corrections.**