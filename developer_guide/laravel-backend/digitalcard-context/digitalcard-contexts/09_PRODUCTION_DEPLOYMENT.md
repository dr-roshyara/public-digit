# Production Deployment - DigitalCard Context

**Version:** Phase 1.3
**Environment:** Production
**Prerequisites:** ModuleRegistry service, Multi-tenancy configured

---

## Pre-Deployment Checklist

Before deploying to production:

1. ✅ **All tests passing** - `php artisan test`
2. ✅ **Coverage ≥ 80%** - `php artisan test --coverage --min=80`
3. ✅ **ServiceProvider registered** - Check `config/app.php`
4. ✅ **ModuleRegistry URL configured** - Check `.env`
5. ✅ **Database migrations ready** - Review migration files
6. ✅ **Event listeners registered** - Check `EventServiceProvider`
7. ✅ **Code reviewed** - Peer review completed
8. ✅ **Documentation updated** - This guide current

---

## Environment Configuration

### 1. Environment Variables

**File:** `.env` (production)

```env
# Application
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:YOUR_PRODUCTION_KEY

# Database (Landlord)
DB_CONNECTION=pgsql
DB_HOST=your-db-host.com
DB_PORT=5432
DB_DATABASE=publicdigit
DB_USERNAME=db_user
DB_PASSWORD=strong_password

# ModuleRegistry (Phase 1.3)
MODULE_REGISTRY_URL=https://module-registry.yourorg.com

# Queue
QUEUE_CONNECTION=redis

# Cache
CACHE_DRIVER=redis
REDIS_HOST=your-redis-host.com
REDIS_PASSWORD=redis_password
REDIS_PORT=6379

# Session
SESSION_DRIVER=redis
SESSION_LIFETIME=120

# Mail (for notifications)
MAIL_MAILER=smtp
MAIL_HOST=smtp.yourorg.com
MAIL_PORT=587
MAIL_USERNAME=noreply@yourorg.com
MAIL_PASSWORD=mail_password
MAIL_ENCRYPTION=tls
```

### 2. Configuration Files

**File:** `config/services.php`

```php
'module_registry' => [
    'url' => env('MODULE_REGISTRY_URL', 'http://module-registry.test'),
    'timeout' => env('MODULE_REGISTRY_TIMEOUT', 30), // seconds
],
```

**File:** `config/app.php`

Verify provider is registered:

```php
'providers' => ServiceProvider::defaultProviders()->merge([
    // ...
    App\Providers\DigitalCardServiceProvider::class,
])->toArray(),
```

---

## Database Setup

### 1. Run Migrations

**Landlord Database:**

```bash
php artisan migrate --force
```

**Tenant Databases:**

```bash
# Run for each tenant
php artisan tenant:migrate {tenant_slug}
```

### 2. Verify Tables

```bash
# Check digital_cards table exists
php artisan tinker
>>> Schema::hasTable('digital_cards')
=> true
>>> DB::table('digital_cards')->count()
=> 0
```

---

## Cache & Optimization

### 1. Cache Configuration

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

### 2. Clear Old Caches

```bash
php artisan optimize:clear
```

### 3. Optimize Autoloader

```bash
composer install --optimize-autoloader --no-dev
```

---

## Queue Workers

### 1. Start Queue Workers

**Supervisor Configuration:**

**File:** `/etc/supervisor/conf.d/digitalcard-worker.conf`

```ini
[program:digitalcard-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/path/to/storage/logs/worker.log
stopwaitsecs=3600
```

**Start Workers:**

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start digitalcard-worker:*
```

### 2. Monitor Workers

```bash
sudo supervisorctl status digitalcard-worker:*
```

---

## Logging & Monitoring

### 1. Configure Logging

**File:** `config/logging.php`

```php
'channels' => [
    'digitalcard' => [
        'driver' => 'daily',
        'path' => storage_path('logs/digitalcard.log'),
        'level' => env('LOG_LEVEL', 'info'),
        'days' => 14,
    ],
],
```

### 2. Log Important Events

```php
use Illuminate\Support\Facades\Log;

// In event listener
Log::channel('digitalcard')->info('Card issued', [
    'card_id' => $event->cardId,
    'tenant_id' => $event->tenantId,
    'timestamp' => now(),
]);
```

### 3. Monitor ModuleRegistry Health

```bash
# Create health check endpoint
curl https://module-registry.yourorg.com/health
```

---

## Performance Tuning

### 1. OPcache Configuration

**File:** `php.ini`

```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
opcache.revalidate_freq=0
```

### 2. Redis Configuration

**File:** `redis.conf`

```conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### 3. Database Indexes

Ensure these indexes exist:

```sql
-- digital_cards table
CREATE INDEX idx_digital_cards_tenant_id ON digital_cards(tenant_id);
CREATE INDEX idx_digital_cards_member_id ON digital_cards(member_id);
CREATE INDEX idx_digital_cards_status ON digital_cards(status);
CREATE INDEX idx_digital_cards_issued_at ON digital_cards(issued_at);
```

---

## Security Hardening

### 1. HTTPS Only

```php
// In AppServiceProvider
if (app()->environment('production')) {
    URL::forceScheme('https');
}
```

### 2. Rate Limiting

**File:** `routes/tenant.php`

```php
Route::middleware(['throttle:60,1'])->group(function () {
    Route::post('/digital-cards', [DigitalCardController::class, 'issue']);
});
```

### 3. CORS Configuration

**File:** `config/cors.php`

```php
'paths' => ['api/*', '*/api/*'],
'allowed_methods' => ['GET', 'POST'],
'allowed_origins' => [env('FRONTEND_URL')],
```

---

## Backup Strategy

### 1. Database Backups

```bash
# Daily backup script
#!/bin/bash
pg_dump -U db_user publicdigit | gzip > /backups/publicdigit_$(date +%Y%m%d).sql.gz

# Tenant databases
for tenant in $(psql -U db_user -d publicdigit -t -c "SELECT database FROM tenants"); do
    pg_dump -U db_user $tenant | gzip > /backups/${tenant}_$(date +%Y%m%d).sql.gz
done
```

### 2. File Backups

```bash
# Backup storage (QR codes, logs)
tar -czf /backups/storage_$(date +%Y%m%d).tar.gz storage/
```

---

## Deployment Script

**File:** `deploy.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Deploying DigitalCard Context..."

# 1. Pull latest code
git pull origin main

# 2. Install dependencies
composer install --optimize-autoloader --no-dev

# 3. Run migrations
php artisan migrate --force

# 4. Clear caches
php artisan optimize:clear

# 5. Cache config
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 6. Restart queue workers
sudo supervisorctl restart digitalcard-worker:*

# 7. Restart PHP-FPM
sudo systemctl reload php8.2-fpm

echo "✅ Deployment complete!"
```

**Make Executable:**

```bash
chmod +x deploy.sh
```

**Run:**

```bash
./deploy.sh
```

---

## Health Checks

### 1. Application Health

```php
// routes/api.php
Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'digitalcard' => [
            'service_provider_loaded' => app()->providerIsLoaded(
                App\Providers\DigitalCardServiceProvider::class
            ),
            'ports_bound' => app()->bound(ClockInterface::class),
        ],
    ]);
});
```

### 2. ModuleRegistry Health

```php
// Check ModuleRegistry connectivity
try {
    $moduleAccess = app(ModuleAccessInterface::class);
    $quota = $moduleAccess->getQuota('health-check');
    $moduleRegistryHealthy = true;
} catch (\Exception $e) {
    $moduleRegistryHealthy = false;
}
```

---

## Monitoring & Alerts

### 1. Error Tracking

Use services like:
- **Sentry** - Exception tracking
- **Bugsnag** - Error monitoring
- **Rollbar** - Real-time errors

### 2. Application Performance Monitoring (APM)

- **New Relic** - Full APM
- **Datadog** - Infrastructure monitoring
- **Laravel Telescope** - Local debugging

### 3. Log Monitoring

- **Papertrail** - Log aggregation
- **Loggly** - Log analysis
- **ELK Stack** - Self-hosted

---

## Rollback Plan

If deployment fails:

### 1. Quick Rollback

```bash
#!/bin/bash
# rollback.sh

# 1. Checkout previous release
git checkout <previous-commit-hash>

# 2. Reinstall dependencies
composer install --no-dev

# 3. Rollback migrations (if needed)
php artisan migrate:rollback --step=1

# 4. Clear caches
php artisan optimize:clear

# 5. Restart workers
sudo supervisorctl restart digitalcard-worker:*
```

### 2. Database Rollback

```bash
# Restore from backup
gunzip < /backups/publicdigit_YYYYMMDD.sql.gz | psql -U db_user publicdigit
```

---

## Scaling Considerations

### Horizontal Scaling

- **Load Balancer** - Distribute traffic across multiple app servers
- **Redis Cluster** - For distributed caching
- **Database Read Replicas** - For read-heavy workloads

### Vertical Scaling

- Increase PHP workers
- Increase database connections
- Increase Redis memory

---

## Maintenance Mode

### Enable Maintenance

```bash
php artisan down --secret="maintenance-bypass-token"
```

Users can access with: `https://yourapp.com/maintenance-bypass-token`

### Disable Maintenance

```bash
php artisan up
```

---

## Post-Deployment Verification

1. ✅ **Check health endpoint** - `curl /health`
2. ✅ **Test card issuance** - Issue test card
3. ✅ **Check logs** - No errors
4. ✅ **Verify queue workers** - `supervisorctl status`
5. ✅ **Monitor ModuleRegistry** - Check connectivity
6. ✅ **Check database** - Verify data integrity

---

## CI/CD Integration

### GitHub Actions Example

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy DigitalCard Context

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'

      - name: Install Dependencies
        run: composer install --no-dev --optimize-autoloader

      - name: Run Tests
        run: php artisan test --coverage --min=80

      - name: Deploy to Production
        run: |
          ssh user@production "cd /var/www/app && git pull && ./deploy.sh"
```

---

## Support Contacts

- **Senior Development Team** - dev-team@yourorg.com
- **DevOps** - devops@yourorg.com
- **On-Call** - oncall@yourorg.com

---

## Next Steps

- Read [Debugging Guide](08_DEBUGGING_GUIDE.md) for production troubleshooting
- Read [API Reference](10_API_REFERENCE.md) for endpoint documentation
- Monitor application logs and metrics
