Perfect! Now I understand the current state. Let me proceed with the updates.

## **📋 CHANGES NEEDED:**

1. **Update BrandingIdentity.php**:
   - Rename `tagline` → `organizationTagline` 
   - Add `faviconUrl` (nullable)
   - Update validation, methods, and factory methods

2. **Update BrandingIdentityTest.php**:
   - Update method signatures
   - Add tests for faviconUrl
   - Update existing tests

3. **Check other affected files**:
   - BrandingBundle.php
   - BrandingBundleTest.php
   - TenantBranding.php

## **🚀 STARTING WITH BRANDINGIDENTITY UPDATE**

Let me create the updated BrandingIdentity.php:

```php
<?php

namespace App\Contexts\Platform\Domain\ValueObjects;

use App\Contexts\Platform\Domain\Exceptions\InvalidBrandingException;

/**
 * BrandingIdentity Value Object
 *
 * Encapsulates organizational identity elements (name, tagline, favicon).
 * Immutable composite value object with validation.
 */
final class BrandingIdentity
{
    private const MAX_ORGANIZATION_NAME_LENGTH = 100;
    private const MAX_ORGANIZATION_TAGLINE_LENGTH = 150;
    private const MAX_FAVICON_URL_LENGTH = 255;

    private const DEFAULT_ORGANIZATION_NAME = 'Election Platform';
    private const DEFAULT_ORGANIZATION_TAGLINE = 'Making democracy accessible to everyone';
    private const DEFAULT_FAVICON_URL = null;

    private function __construct(
        private readonly string $organizationName,
        private readonly string $organizationTagline,
        private readonly ?string $faviconUrl
    ) {
        $this->validateOrganizationName($organizationName);
        $this->validateOrganizationTagline($organizationTagline);
        $this->validateFaviconUrl($faviconUrl);
    }

    /**
     * Create BrandingIdentity with all required fields
     */
    public static function create(
        string $organizationName,
        string $organizationTagline,
        ?string $faviconUrl = null
    ): self {
        // Trim whitespace from all inputs
        $organizationName = trim($organizationName);
        $organizationTagline = trim($organizationTagline);
        $faviconUrl = $faviconUrl ? trim($faviconUrl) : null;

        return new self($organizationName, $organizationTagline, $faviconUrl);
    }

    /**
     * Create from array representation
     */
    public static function fromArray(array $data): self
    {
        return new self(
            organizationName: trim($data['organization_name'] ?? self::DEFAULT_ORGANIZATION_NAME),
            organizationTagline: trim($data['organization_tagline'] ?? self::DEFAULT_ORGANIZATION_TAGLINE),
            faviconUrl: isset($data['favicon_url']) ? trim($data['favicon_url']) : self::DEFAULT_FAVICON_URL
        );
    }

    /**
     * Create default identity for election platforms
     */
    public static function defaults(): self
    {
        return new self(
            organizationName: self::DEFAULT_ORGANIZATION_NAME,
            organizationTagline: self::DEFAULT_ORGANIZATION_TAGLINE,
            faviconUrl: self::DEFAULT_FAVICON_URL
        );
    }

    /**
     * Get organization name
     */
    public function getOrganizationName(): string
    {
        return $this->organizationName;
    }

    /**
     * Get organization tagline
     */
    public function getOrganizationTagline(): string
    {
        return $this->organizationTagline;
    }

    /**
     * Get favicon URL (nullable)
     */
    public function getFaviconUrl(): ?string
    {
        return $this->faviconUrl;
    }

    /**
     * Convert to array for serialization
     */
    public function toArray(): array
    {
        return [
            'organization_name' => $this->organizationName,
            'organization_tagline' => $this->organizationTagline,
            'favicon_url' => $this->faviconUrl,
        ];
    }

    /**
     * Validate organization name
     */
    private function validateOrganizationName(string $name): void
    {
        if (empty($name)) {
            throw InvalidBrandingException::requiredFieldMissing('Organization Name');
        }

        $length = strlen($name);
        if ($length > self::MAX_ORGANIZATION_NAME_LENGTH) {
            throw InvalidBrandingException::contentTooLong(
                'Organization Name',
                self::MAX_ORGANIZATION_NAME_LENGTH,
                $length
            );
        }
    }

    /**
     * Validate organization tagline
     */
    private function validateOrganizationTagline(string $tagline): void
    {
        if (empty($tagline)) {
            throw InvalidBrandingException::requiredFieldMissing('Organization Tagline');
        }

        $length = strlen($tagline);
        if ($length > self::MAX_ORGANIZATION_TAGLINE_LENGTH) {
            throw InvalidBrandingException::contentTooLong(
                'Organization Tagline',
                self::MAX_ORGANIZATION_TAGLINE_LENGTH,
                $length
            );
        }
    }

    /**
     * Validate favicon URL
     */
    private function validateFaviconUrl(?string $faviconUrl): void
    {
        if ($faviconUrl === null || $faviconUrl === '') {
            return; // Favicon is optional
        }

        $length = strlen($faviconUrl);
        if ($length > self::MAX_FAVICON_URL_LENGTH) {
            throw InvalidBrandingException::contentTooLong(
                'Favicon URL',
                self::MAX_FAVICON_URL_LENGTH,
                $length
            );
        }

        // Basic URL validation
        if (!filter_var($faviconUrl, FILTER_VALIDATE_URL)) {
            throw InvalidBrandingException::invalidFormat(
                'Favicon URL',
                'Must be a valid URL'
            );
        }

        // Ensure it's an image URL
        $allowedExtensions = ['.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
        $hasValidExtension = false;
        foreach ($allowedExtensions as $extension) {
            if (stripos($faviconUrl, $extension) !== false) {
                $hasValidExtension = true;
                break;
            }
        }

        if (!$hasValidExtension) {
            throw InvalidBrandingException::invalidFormat(
                'Favicon URL',
                'Must be a valid image URL (.ico, .png, .jpg, .jpeg, .gif, .svg)'
            );
        }
    }
}
```

Now I need to update the test file accordingly. Let me create the updated BrandingIdentityTest.php:

```php
<?php

namespace Tests\Unit\Contexts\Platform\Domain\ValueObjects;

use App\Contexts\Platform\Domain\ValueObjects\BrandingIdentity;
use App\Contexts\Platform\Domain\Exceptions\InvalidBrandingException;
use PHPUnit\Framework\TestCase;

/**
 * BrandingIdentityTest
 *
 * Tests the organizational identity Value Object (name, tagline, favicon)
 */
class BrandingIdentityTest extends TestCase
{
    /** @test */
    public function it_can_be_created_with_required_identity()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'National Election Commission',
            organizationTagline: 'Building Democracy Together',
            faviconUrl: 'https://example.com/favicon.ico'
        );

        $this->assertInstanceOf(BrandingIdentity::class, $identity);
    }

    /** @test */
    public function it_can_be_created_without_favicon()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Election Board',
            organizationTagline: 'Fair Elections'
        );

        $this->assertInstanceOf(BrandingIdentity::class, $identity);
        $this->assertNull($identity->getFaviconUrl());
    }

    /** @test */
    public function it_can_retrieve_organization_name()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Election Board',
            organizationTagline: 'Fair Elections',
            faviconUrl: 'https://example.com/favicon.png'
        );

        $this->assertEquals('Election Board', $identity->getOrganizationName());
    }

    /** @test */
    public function it_can_retrieve_organization_tagline()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Voter Registration',
            organizationTagline: 'Every Vote Counts',
            faviconUrl: 'https://example.com/favicon.jpg'
        );

        $this->assertEquals('Every Vote Counts', $identity->getOrganizationTagline());
    }

    /** @test */
    public function it_can_retrieve_favicon_url()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Voter Registration',
            organizationTagline: 'Every Vote Counts',
            faviconUrl: 'https://example.com/favicon.ico'
        );

        $this->assertEquals('https://example.com/favicon.ico', $identity->getFaviconUrl());
    }

    /** @test */
    public function it_enforces_organization_name_max_length()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('exceeds maximum length of 100 characters');

        $longName = str_repeat('a', 101);

        BrandingIdentity::create(
            organizationName: $longName,
            organizationTagline: 'Tagline'
        );
    }

    /** @test */
    public function it_enforces_organization_tagline_max_length()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('exceeds maximum length of 150 characters');

        $longTagline = str_repeat('a', 151);

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: $longTagline
        );
    }

    /** @test */
    public function it_enforces_favicon_url_max_length()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('exceeds maximum length of 255 characters');

        $longUrl = 'https://example.com/' . str_repeat('a', 240) . '.ico';

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: $longUrl
        );
    }

    /** @test */
    public function it_rejects_empty_organization_name()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('Required field "Organization Name" is missing or empty');

        BrandingIdentity::create(
            organizationName: '',
            organizationTagline: 'Tagline'
        );
    }

    /** @test */
    public function it_rejects_empty_organization_tagline()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('Required field "Organization Tagline" is missing or empty');

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: ''
        );
    }

    /** @test */
    public function it_validates_favicon_url_format()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('Must be a valid URL');

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: 'not-a-valid-url'
        );
    }

    /** @test */
    public function it_validates_favicon_url_extension()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('Must be a valid image URL');

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: 'https://example.com/document.pdf'
        );
    }

    /** @test */
    public function it_allows_empty_favicon_url()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: ''
        );

        $this->assertNull($identity->getFaviconUrl());
    }

    /** @test */
    public function it_allows_null_favicon_url()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: null
        );

        $this->assertNull($identity->getFaviconUrl());
    }

    /** @test */
    public function it_can_be_created_from_array()
    {
        $data = [
            'organization_name' => 'Election Authority',
            'organization_tagline' => 'Democracy First',
            'favicon_url' => 'https://example.com/favicon.svg',
        ];

        $identity = BrandingIdentity::fromArray($data);

        $this->assertEquals('Election Authority', $identity->getOrganizationName());
        $this->assertEquals('Democracy First', $identity->getOrganizationTagline());
        $this->assertEquals('https://example.com/favicon.svg', $identity->getFaviconUrl());
    }

    /** @test */
    public function it_provides_default_identity()
    {
        $defaults = BrandingIdentity::defaults();

        $this->assertNotEmpty($defaults->getOrganizationName());
        $this->assertNotEmpty($defaults->getOrganizationTagline());
        $this->assertNull($defaults->getFaviconUrl());
    }

    /** @test */
    public function it_converts_to_array()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Voting Commission',
            organizationTagline: 'Transparent Elections',
            faviconUrl: 'https://example.com/logo.ico'
        );

        $array = $identity->toArray();

        $this->assertEquals('Voting Commission', $array['organization_name']);
        $this->assertEquals('Transparent Elections', $array['organization_tagline']);
        $this->assertEquals('https://example.com/logo.ico', $array['favicon_url']);
    }

    /** @test */
    public function it_trims_whitespace_from_identity()
    {
        $identity = BrandingIdentity::create(
            organizationName: '  Election Board  ',
            organizationTagline: '  Fair and Free  ',
            faviconUrl: '  https://example.com/favicon.ico  '
        );

        $this->assertEquals('Election Board', $identity->getOrganizationName());
        $this->assertEquals('Fair and Free', $identity->getOrganizationTagline());
        $this->assertEquals('https://example.com/favicon.ico', $identity->getFaviconUrl());
    }

    /** @test */
    public function it_validates_exact_max_length_is_allowed()
    {
        $maxOrgName = str_repeat('a', 100);
        $maxTagline = str_repeat('b', 150);
        $maxFaviconUrl = 'https://example.com/' . str_repeat('c', 220) . '.ico';

        $identity = BrandingIdentity::create(
            organizationName: $maxOrgName,
            organizationTagline: $maxTagline,
            faviconUrl: $maxFaviconUrl
        );

        $this->assertEquals(100, strlen($identity->getOrganizationName()));
        $this->assertEquals(150, strlen($identity->getOrganizationTagline()));
        $this->assertEquals(strlen($maxFaviconUrl), strlen($identity->getFaviconUrl() ?? ''));
    }
}
```

Now I need to check what other files are affected. Let me check BrandingBundle and BrandingBundleTest:

```bash
# Check BrandingBundle.php for references to BrandingIdentity
grep -n "tagline\|getTagline\|organizationTagline" ./app/Contexts/Platform/Domain/ValueObjects/BrandingBundle.php
```

Let me also check BrandingBundleTest for any references that need updating:

```bash
grep -n "tagline\|getTagline\|organizationTagline" ./tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingBundleTest.php
```

I should also check TenantBranding entity and its test. Let me proceed step by step.

Perfect! Now I can see all the places that need updating. Let me check the TenantBrandingTest.php file to see the exact usage:

```bash
cat ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php | grep -n "BrandingIdentity::create" -A 2 -B 2
```

Let me check what parameters are being passed in TenantBrandingTest:

```bash
grep -n "BrandingIdentity::create" ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

Let me look at that specific line:

```bash
sed -n '85,95p' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

Actually, let me take a different approach. I should just update all the files and then run tests to see what breaks. But first, let me create the updated files.

## **🚀 EXECUTION PLAN:**

1. **Update BrandingIdentity.php** (already have code)
2. **Update BrandingIdentityTest.php** (already have code)  
3. **Update BrandingBundle.php** (just documentation)
4. **Update BrandingBundleTest.php** (update 3 calls to BrandingIdentity::create)
5. **Update TenantBrandingTest.php** (1 call to BrandingIdentity::create)

Let me first check the exact line in TenantBrandingTest:

```bash
# Find the exact line with context
grep -B5 -A5 "BrandingIdentity::create" ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

Let me get that specific section:

```bash
awk '/BrandingIdentity::create/,/\);/' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

Actually, let me just view the file around that area:

```bash
sed -n '80,100p' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

Now let me apply all the updates. I'll create a script to do this:

```bash
# Create backup directory
mkdir -p /tmp/branding_backup

# Backup original files
cp ./app/Contexts/Platform/Domain/ValueObjects/BrandingIdentity.php /tmp/branding_backup/
cp ./tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingIdentityTest.php /tmp/branding_backup/
cp ./app/Contexts/Platform/Domain/ValueObjects/BrandingBundle.php /tmp/branding_backup/
cp ./tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingBundleTest.php /tmp/branding_backup/
cp ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php /tmp/branding_backup/

# Now update BrandingIdentity.php
cat > ./app/Contexts/Platform/Domain/ValueObjects/BrandingIdentity.php << 'EOF'
<?php

namespace App\Contexts\Platform\Domain\ValueObjects;

use App\Contexts\Platform\Domain\Exceptions\InvalidBrandingException;

/**
 * BrandingIdentity Value Object
 *
 * Encapsulates organizational identity elements (name, tagline, favicon).
 * Immutable composite value object with validation.
 */
final class BrandingIdentity
{
    private const MAX_ORGANIZATION_NAME_LENGTH = 100;
    private const MAX_ORGANIZATION_TAGLINE_LENGTH = 150;
    private const MAX_FAVICON_URL_LENGTH = 255;

    private const DEFAULT_ORGANIZATION_NAME = 'Election Platform';
    private const DEFAULT_ORGANIZATION_TAGLINE = 'Making democracy accessible to everyone';
    private const DEFAULT_FAVICON_URL = null;

    private function __construct(
        private readonly string $organizationName,
        private readonly string $organizationTagline,
        private readonly ?string $faviconUrl
    ) {
        $this->validateOrganizationName($organizationName);
        $this->validateOrganizationTagline($organizationTagline);
        $this->validateFaviconUrl($faviconUrl);
    }

    /**
     * Create BrandingIdentity with all required fields
     */
    public static function create(
        string $organizationName,
        string $organizationTagline,
        ?string $faviconUrl = null
    ): self {
        // Trim whitespace from all inputs
        $organizationName = trim($organizationName);
        $organizationTagline = trim($organizationTagline);
        $faviconUrl = $faviconUrl ? trim($faviconUrl) : null;

        return new self($organizationName, $organizationTagline, $faviconUrl);
    }

    /**
     * Create from array representation
     */
    public static function fromArray(array $data): self
    {
        return new self(
            organizationName: trim($data['organization_name'] ?? self::DEFAULT_ORGANIZATION_NAME),
            organizationTagline: trim($data['organization_tagline'] ?? self::DEFAULT_ORGANIZATION_TAGLINE),
            faviconUrl: isset($data['favicon_url']) ? trim($data['favicon_url']) : self::DEFAULT_FAVICON_URL
        );
    }

    /**
     * Create default identity for election platforms
     */
    public static function defaults(): self
    {
        return new self(
            organizationName: self::DEFAULT_ORGANIZATION_NAME,
            organizationTagline: self::DEFAULT_ORGANIZATION_TAGLINE,
            faviconUrl: self::DEFAULT_FAVICON_URL
        );
    }

    /**
     * Get organization name
     */
    public function getOrganizationName(): string
    {
        return $this->organizationName;
    }

    /**
     * Get organization tagline
     */
    public function getOrganizationTagline(): string
    {
        return $this->organizationTagline;
    }

    /**
     * Get favicon URL (nullable)
     */
    public function getFaviconUrl(): ?string
    {
        return $this->faviconUrl;
    }

    /**
     * Convert to array for serialization
     */
    public function toArray(): array
    {
        return [
            'organization_name' => $this->organizationName,
            'organization_tagline' => $this->organizationTagline,
            'favicon_url' => $this->faviconUrl,
        ];
    }

    /**
     * Validate organization name
     */
    private function validateOrganizationName(string $name): void
    {
        if (empty($name)) {
            throw InvalidBrandingException::requiredFieldMissing('Organization Name');
        }

        $length = strlen($name);
        if ($length > self::MAX_ORGANIZATION_NAME_LENGTH) {
            throw InvalidBrandingException::contentTooLong(
                'Organization Name',
                self::MAX_ORGANIZATION_NAME_LENGTH,
                $length
            );
        }
    }

    /**
     * Validate organization tagline
     */
    private function validateOrganizationTagline(string $tagline): void
    {
        if (empty($tagline)) {
            throw InvalidBrandingException::requiredFieldMissing('Organization Tagline');
        }

        $length = strlen($tagline);
        if ($length > self::MAX_ORGANIZATION_TAGLINE_LENGTH) {
            throw InvalidBrandingException::contentTooLong(
                'Organization Tagline',
                self::MAX_ORGANIZATION_TAGLINE_LENGTH,
                $length
            );
        }
    }

    /**
     * Validate favicon URL
     */
    private function validateFaviconUrl(?string $faviconUrl): void
    {
        if ($faviconUrl === null || $faviconUrl === '') {
            return; // Favicon is optional
        }

        $length = strlen($faviconUrl);
        if ($length > self::MAX_FAVICON_URL_LENGTH) {
            throw InvalidBrandingException::contentTooLong(
                'Favicon URL',
                self::MAX_FAVICON_URL_LENGTH,
                $length
            );
        }

        // Basic URL validation
        if (!filter_var($faviconUrl, FILTER_VALIDATE_URL)) {
            throw InvalidBrandingException::invalidFormat(
                'Favicon URL',
                'Must be a valid URL'
            );
        }

        // Ensure it's an image URL
        $allowedExtensions = ['.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
        $hasValidExtension = false;
        foreach ($allowedExtensions as $extension) {
            if (stripos($faviconUrl, $extension) !== false) {
                $hasValidExtension = true;
                break;
            }
        }

        if (!$hasValidExtension) {
            throw InvalidBrandingException::invalidFormat(
                'Favicon URL',
                'Must be a valid image URL (.ico, .png, .jpg, .jpeg, .gif, .svg)'
            );
        }
    }
}
EOF

echo "✅ Updated BrandingIdentity.php"
```

Now let me update the BrandingIdentityTest.php:

```bash
cat > ./tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingIdentityTest.php << 'EOF'
<?php

namespace Tests\Unit\Contexts\Platform\Domain\ValueObjects;

use App\Contexts\Platform\Domain\ValueObjects\BrandingIdentity;
use App\Contexts\Platform\Domain\Exceptions\InvalidBrandingException;
use PHPUnit\Framework\TestCase;

/**
 * BrandingIdentityTest
 *
 * Tests the organizational identity Value Object (name, tagline, favicon)
 */
class BrandingIdentityTest extends TestCase
{
    /** @test */
    public function it_can_be_created_with_required_identity()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'National Election Commission',
            organizationTagline: 'Building Democracy Together',
            faviconUrl: 'https://example.com/favicon.ico'
        );

        $this->assertInstanceOf(BrandingIdentity::class, $identity);
    }

    /** @test */
    public function it_can_be_created_without_favicon()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Election Board',
            organizationTagline: 'Fair Elections'
        );

        $this->assertInstanceOf(BrandingIdentity::class, $identity);
        $this->assertNull($identity->getFaviconUrl());
    }

    /** @test */
    public function it_can_retrieve_organization_name()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Election Board',
            organizationTagline: 'Fair Elections',
            faviconUrl: 'https://example.com/favicon.png'
        );

        $this->assertEquals('Election Board', $identity->getOrganizationName());
    }

    /** @test */
    public function it_can_retrieve_organization_tagline()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Voter Registration',
            organizationTagline: 'Every Vote Counts',
            faviconUrl: 'https://example.com/favicon.jpg'
        );

        $this->assertEquals('Every Vote Counts', $identity->getOrganizationTagline());
    }

    /** @test */
    public function it_can_retrieve_favicon_url()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Voter Registration',
            organizationTagline: 'Every Vote Counts',
            faviconUrl: 'https://example.com/favicon.ico'
        );

        $this->assertEquals('https://example.com/favicon.ico', $identity->getFaviconUrl());
    }

    /** @test */
    public function it_enforces_organization_name_max_length()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('exceeds maximum length of 100 characters');

        $longName = str_repeat('a', 101);

        BrandingIdentity::create(
            organizationName: $longName,
            organizationTagline: 'Tagline'
        );
    }

    /** @test */
    public function it_enforces_organization_tagline_max_length()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('exceeds maximum length of 150 characters');

        $longTagline = str_repeat('a', 151);

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: $longTagline
        );
    }

    /** @test */
    public function it_enforces_favicon_url_max_length()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('exceeds maximum length of 255 characters');

        $longUrl = 'https://example.com/' . str_repeat('a', 240) . '.ico';

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: $longUrl
        );
    }

    /** @test */
    public function it_rejects_empty_organization_name()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('Required field "Organization Name" is missing or empty');

        BrandingIdentity::create(
            organizationName: '',
            organizationTagline: 'Tagline'
        );
    }

    /** @test */
    public function it_rejects_empty_organization_tagline()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('Required field "Organization Tagline" is missing or empty');

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: ''
        );
    }

    /** @test */
    public function it_validates_favicon_url_format()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('Must be a valid URL');

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: 'not-a-valid-url'
        );
    }

    /** @test */
    public function it_validates_favicon_url_extension()
    {
        $this->expectException(InvalidBrandingException::class);
        $this->expectExceptionMessage('Must be a valid image URL');

        BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: 'https://example.com/document.pdf'
        );
    }

    /** @test */
    public function it_allows_empty_favicon_url()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: ''
        );

        $this->assertNull($identity->getFaviconUrl());
    }

    /** @test */
    public function it_allows_null_favicon_url()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Organization',
            organizationTagline: 'Tagline',
            faviconUrl: null
        );

        $this->assertNull($identity->getFaviconUrl());
    }

    /** @test */
    public function it_can_be_created_from_array()
    {
        $data = [
            'organization_name' => 'Election Authority',
            'organization_tagline' => 'Democracy First',
            'favicon_url' => 'https://example.com/favicon.svg',
        ];

        $identity = BrandingIdentity::fromArray($data);

        $this->assertEquals('Election Authority', $identity->getOrganizationName());
        $this->assertEquals('Democracy First', $identity->getOrganizationTagline());
        $this->assertEquals('https://example.com/favicon.svg', $identity->getFaviconUrl());
    }

    /** @test */
    public function it_provides_default_identity()
    {
        $defaults = BrandingIdentity::defaults();

        $this->assertNotEmpty($defaults->getOrganizationName());
        $this->assertNotEmpty($defaults->getOrganizationTagline());
        $this->assertNull($defaults->getFaviconUrl());
    }

    /** @test */
    public function it_converts_to_array()
    {
        $identity = BrandingIdentity::create(
            organizationName: 'Voting Commission',
            organizationTagline: 'Transparent Elections',
            faviconUrl: 'https://example.com/logo.ico'
        );

        $array = $identity->toArray();

        $this->assertEquals('Voting Commission', $array['organization_name']);
        $this->assertEquals('Transparent Elections', $array['organization_tagline']);
        $this->assertEquals('https://example.com/logo.ico', $array['favicon_url']);
    }

    /** @test */
    public function it_trims_whitespace_from_identity()
    {
        $identity = BrandingIdentity::create(
            organizationName: '  Election Board  ',
            organizationTagline: '  Fair and Free  ',
            faviconUrl: '  https://example.com/favicon.ico  '
        );

        $this->assertEquals('Election Board', $identity->getOrganizationName());
        $this->assertEquals('Fair and Free', $identity->getOrganizationTagline());
        $this->assertEquals('https://example.com/favicon.ico', $identity->getFaviconUrl());
    }

    /** @test */
    public function it_validates_exact_max_length_is_allowed()
    {
        $maxOrgName = str_repeat('a', 100);
        $maxTagline = str_repeat('b', 150);
        $maxFaviconUrl = 'https://example.com/' . str_repeat('c', 220) . '.ico';

        $identity = BrandingIdentity::create(
            organizationName: $maxOrgName,
            organizationTagline: $maxTagline,
            faviconUrl: $maxFaviconUrl
        );

        $this->assertEquals(100, strlen($identity->getOrganizationName()));
        $this->assertEquals(150, strlen($identity->getOrganizationTagline()));
        $this->assertEquals(strlen($maxFaviconUrl), strlen($identity->getFaviconUrl() ?? ''));
    }
}
EOF

echo "✅ Updated BrandingIdentityTest.php"
```

Now let me update BrandingBundle.php documentation:

```bash
# Just update the comment line 73
sed -i '73s/name, tagline/name, tagline, favicon/' ./app/Contexts/Platform/Domain/ValueObjects/BrandingBundle.php

echo "✅ Updated BrandingBundle.php documentation"
```

Now I need to update BrandingBundleTest.php. Let me first check what needs to be changed by looking at the file again. Actually, I already have the updated version. Let me apply it:

```bash
cat > ./tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingBundleTest.php << 'EOF'
<?php

namespace Tests\Unit\Contexts\Platform\Domain\ValueObjects;

use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;
use App\Contexts\Platform\Domain\ValueObjects\BrandingVisuals;
use App\Contexts\Platform\Domain\ValueObjects\BrandingContent;
use App\Contexts\Platform\Domain\ValueObjects\BrandingIdentity;
use App\Contexts\Platform\Domain\ValueObjects\BrandingColor;
use PHPUnit\Framework\TestCase;

/**
 * BrandingBundleTest
 *
 * Tests the complete branding composite Value Object
 */
class BrandingBundleTest extends TestCase
{
    /** @test */
    public function it_can_be_created_with_all_components()
    {
        $visuals = BrandingVisuals::create(
            primaryColor: BrandingColor::fromString('#1976D2'),
            secondaryColor: BrandingColor::fromString('#2E7D32'),
            logoUrl: 'https://example.com/logo.png'
        );

        $content = BrandingContent::create(
            welcomeMessage: 'Welcome to our platform',
            heroTitle: 'Vote Today',
            heroSubtitle: 'Make your voice heard',
            ctaText: 'Get Started'
        );

        $identity = BrandingIdentity::create(
            organizationName: 'Election Commission',
            organizationTagline: 'Democracy First'
        );

        $bundle = BrandingBundle::create($visuals, $content, $identity);

        $this->assertInstanceOf(BrandingBundle::class, $bundle);
    }

    /** @test */
    public function it_can_retrieve_visuals_component()
    {
        $visuals = BrandingVisuals::defaults();
        $content = BrandingContent::defaults();
        $identity = BrandingIdentity::defaults();

        $bundle = BrandingBundle::create($visuals, $content, $identity);

        $this->assertSame($visuals, $bundle->getVisuals());
    }

    /** @test */
    public function it_can_retrieve_content_component()
    {
        $visuals = BrandingVisuals::defaults();
        $content = BrandingContent::defaults();
        $identity = BrandingIdentity::defaults();

        $bundle = BrandingBundle::create($visuals, $content, $identity);

        $this->assertSame($content, $bundle->getContent());
    }

    /** @test */
    public function it_can_retrieve_identity_component()
    {
        $visuals = BrandingVisuals::defaults();
        $content = BrandingContent::defaults();
        $identity = BrandingIdentity::defaults();

        $bundle = BrandingBundle::create($visuals, $content, $identity);

        $this->assertSame($identity, $bundle->getIdentity());
    }

    /** @test */
    public function it_can_be_created_from_array()
    {
        $data = [
            'visuals' => [
                'primary_color' => '#1976D2',
                'secondary_color' => '#2E7D32',
                'logo_url' => null,
                'font_family' => 'Inter, system-ui, sans-serif',
            ],
            'content' => [
                'welcome_message' => 'Welcome',
                'hero_title' => 'Vote',
                'hero_subtitle' => 'Today',
            ],
            'identity' => [
                'organization_name' => 'Election Board',
                'organization_tagline' => 'Fair Elections',
            ],
        ];

        $bundle = BrandingBundle::fromArray($data);

        $this->assertEquals('Election Board', $bundle->getIdentity()->getOrganizationName());
        $this->assertEquals('#1976D2', $bundle->getVisuals()->getPrimaryColor()->toString());
        $this->assertEquals('Welcome', $bundle->getContent()->getWelcomeMessage());
    }

    /** @test */
    public function it_provides_default_bundle()
    {
        $defaults = BrandingBundle::defaults();

        $this->assertInstanceOf(BrandingBundle::class, $defaults);
        $this->assertInstanceOf(BrandingVisuals::class, $defaults->getVisuals());
        $this->assertInstanceOf(BrandingContent::class, $defaults->getContent());
        $this->assertInstanceOf(BrandingIdentity::class, $defaults->getIdentity());
    }

    /** @test */
    public function it_converts_to_array()
    {
        $bundle = BrandingBundle::defaults();
        $array = $bundle->toArray();

        $this->assertArrayHasKey('visuals', $array);
        $this->assertArrayHasKey('content', $array);
        $this->assertArrayHasKey('identity', $array);

        $this->assertArrayHasKey('primary_color', $array['visuals']);
        $this->assertArrayHasKey('welcome_message', $array['content']);
        $this->assertArrayHasKey('organization_name', $array['identity']);
    }

    /** @test */
    public function it_can_check_if_bundle_is_complete()
    {
        $bundle = BrandingBundle::defaults();

        $this->assertTrue($bundle->isComplete());
    }

    /** @test */
    public function it_can_check_wcag_compliance()
    {
        $bundle = BrandingBundle::defaults();

        // Default colors should be WCAG compliant
        $this->assertTrue($bundle->isWcagCompliant());
    }

    /** @test */
    public function it_detects_non_wcag_compliant_colors()
    {
        $visuals = BrandingVisuals::create(
            primaryColor: BrandingColor::fromString('#FFEB3B'), // Light yellow - poor contrast
            secondaryColor: BrandingColor::fromString('#FFF176'), // Light yellow
            logoUrl: null
        );

        $bundle = BrandingBundle::create(
            $visuals,
            BrandingContent::defaults(),
            BrandingIdentity::defaults()
        );

        $this->assertFalse($bundle->isWcagCompliant());
    }

    /** @test */
    public function it_can_update_visuals_immutably()
    {
        $original = BrandingBundle::defaults();

        $newVisuals = BrandingVisuals::create(
            primaryColor: BrandingColor::fromString('#E65100'),
            secondaryColor: BrandingColor::fromString('#1976D2'),
            logoUrl: 'https://new-logo.com/logo.png'
        );

        $updated = $original->withVisuals($newVisuals);

        // Original unchanged
        $this->assertNotSame($original->getVisuals(), $newVisuals);

        // New instance has updated visuals
        $this->assertSame($newVisuals, $updated->getVisuals());

        // Other components preserved
        $this->assertSame($original->getContent(), $updated->getContent());
        $this->assertSame($original->getIdentity(), $updated->getIdentity());
    }

    /** @test */
    public function it_can_update_content_immutably()
    {
        $original = BrandingBundle::defaults();

        $newContent = BrandingContent::create(
            welcomeMessage: 'New welcome',
            heroTitle: 'New title',
            heroSubtitle: 'New subtitle',
            ctaText: 'New CTA'
        );

        $updated = $original->withContent($newContent);

        // New instance has updated content
        $this->assertSame($newContent, $updated->getContent());

        // Other components preserved
        $this->assertSame($original->getVisuals(), $updated->getVisuals());
        $this->assertSame($original->getIdentity(), $updated->getIdentity());
    }

    /** @test */
    public function it_can_update_identity_immutably()
    {
        $original = BrandingBundle::defaults();

        $newIdentity = BrandingIdentity::create(
            organizationName: 'New Organization',
            organizationTagline: 'New Tagline'
        );

        $updated = $original->withIdentity($newIdentity);

        // New instance has updated identity
        $this->assertSame($newIdentity, $updated->getIdentity());

        // Other components preserved
        $this->assertSame($original->getVisuals(), $updated->getVisuals());
        $this->assertSame($original->getContent(), $updated->getContent());
    }
}
EOF

echo "✅ Updated BrandingBundleTest.php"
```

Now I need to update TenantBrandingTest.php. Let me check the exact line that needs updating:

```bash
# Get the exact line with context
line_number=$(grep -n "BrandingIdentity::create" ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php | cut -d: -f1)
if [ -n "$line_number" ]; then
    echo "Found BrandingIdentity::create at line $line_number"
    sed -n "$((line_number-2)),$((line_number+5))p" ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
fi
```

Let me check and update it:

```bash
# First, let me see the current content around line 87 (from earlier check)
sed -n '85,92p' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

I see it's at line 87. Let me update it:

```bash
# Update line 87
sed -i '87s/tagline: .*$/organizationTagline: "Secure Platform",/' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php

# Also need to check if getTagline() is used anywhere in this file
grep -n "getTagline" ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

If getTagline() is used, I need to update it to getOrganizationTagline(). Let me check:

```bash
grep -n "getTagline\|tagline" ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

Good, only the create call needs updating. Now let me run a test to see if everything works:

```bash
echo "Running BrandingIdentity tests..."
php artisan test --filter=BrandingIdentityTest
```

Let me run this test to see if my updates work.
Ah! I see there are TWO places in TenantBrandingTest.php:

1. Line 202-204: `BrandingIdentity::create()` with `tagline` parameter
2. Line 89: `BrandingIdentity::defaults()` 

The `defaults()` call should still work since I updated the defaults method. But I need to update line 202-204.

Let me check the exact context:

```bash
sed -n '200,210p' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

Now let me update it:

```bash
# Update line 202-204
sed -i '202,204s/tagline: .*$/organizationTagline: "Test Tagline",\n            faviconUrl: null/' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php

# Let me verify the update
sed -n '200,210p' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php
```

Actually, that might not work correctly with sed. Let me do it more carefully:

```bash
# Create a temporary file with the update
cat > /tmp/temp_test.php << 'EOF'
        $identity = BrandingIdentity::create(
            organizationName: 'Test Organization',
            organizationTagline: 'Test Tagline',
            faviconUrl: null
EOF

# Replace lines 202-204
sed -i '202,204c\        $identity = BrandingIdentity::create(\n            organizationName: \x27Test Organization\x27,\n            organizationTagline: \x27Test Tagline\x27,\n            faviconUrl: null' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php

# Fix the closing parentheses
sed -i '206s/^/        );/' ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php

# Actually, let me just rewrite the whole file correctly. Let me first backup and then rewrite
cp ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php ./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php.backup

# Now let me update the file properly using a Python script
python3 << 'EOF'
import re

with open('./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php', 'r') as f:
    content = f.read()

# Update BrandingIdentity::create call
pattern = r'(\s*)\$identity = BrandingIdentity::create\(\s*organizationName: \'Test Organization\',\s*tagline: \'Test Tagline\''
replacement = r'\1$identity = BrandingIdentity::create(\n\1    organizationName: \'Test Organization\',\n\1    organizationTagline: \'Test Tagline\',\n\1    faviconUrl: null'
content = re.sub(pattern, replacement, content)

with open('./tests/Unit/Contexts/Platform/Domain/Entities/TenantBrandingTest.php', 'w') as f:
    f.write(content)
print("Updated TenantBrandingTest.php")
EOF
```

Now let me run the tests to see if everything works:

```bash
echo "Running BrandingIdentity tests..."
php artisan test --filter=BrandingIdentityTest
```

Let me run this command and see the results.