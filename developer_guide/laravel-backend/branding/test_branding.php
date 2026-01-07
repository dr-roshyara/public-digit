<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "Testing TenantIdentifierResolver...\n";

/** @var \App\Services\TenantIdentifierResolver $resolver */
$resolver = app(\App\Services\TenantIdentifierResolver::class);

// Test 1: Resolve from URL
$url = 'http://nrna.localhost:8000/login';
echo "URL: $url\n";
$result = $resolver->resolveFromUrl($url);
if ($result) {
    echo "✓ Resolved successfully:\n";
    echo "  Slug: " . $result['slug']->toString() . "\n";
    echo "  DB ID: " . $result['db_id']->toInt() . "\n";
} else {
    echo "✗ Failed to resolve\n";
}

// Test 2: Check tenant exists
if ($result) {
    $exists = $resolver->tenantExists($result['slug']);
    echo "Tenant exists check: " . ($exists ? 'YES' : 'NO') . "\n";
}

// Test 3: Get branding from landlord DB
if ($result) {
    $branding = \Illuminate\Support\Facades\DB::connection('landlord')
        ->table('tenant_brandings')
        ->where('tenant_db_id', $result['db_id']->toInt())
        ->first();

    if ($branding) {
        echo "✓ Branding found:\n";
        echo "  Primary color: " . ($branding->primary_color ?? 'N/A') . "\n";
        echo "  Secondary color: " . ($branding->secondary_color ?? 'N/A') . "\n";
        echo "  Font family: " . ($branding->font_family ?? 'N/A') . "\n";
    } else {
        echo "✗ No branding found\n";
    }
}

echo "\nDone.\n";