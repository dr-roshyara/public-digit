   FAIL  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest
  ⨯ it implements repository interface
  ⨯ it can save branding for tenant
  ⨯ it can find branding for tenant
  ⨯ it returns null when branding not found
  ⨯ it can update existing branding
  ⨯ it can check if branding exists
  ⨯ it can delete branding for tenant
  ⨯ it enforces tenant isolation
  ⨯ it maintains one to one relationship
  ⨯ delete is idempotent
  ⨯ it persists domain events separately
  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it implements repository interface                                                                                                                 QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it can save branding for tenant                                                                                                                    QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it can find branding for tenant                                                                                                                    QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it returns null when branding not found                                                                                                            QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it can update existing branding                                                                                                                    QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it can check if branding exists                                                                                                                    QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it can delete branding for tenant                                                                                                                  QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it enforces tenant isolation                                                                                                                       QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it maintains one to one relationship                                                                                                               QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > delete is idempotent                                                                                                                               QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813

  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   FAILED  Tests\Unit\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepositoryTest > it persists domain events separately                                                                                                               QueryException
  SQLSTATE[42P01]: Undefined table: 7 FEHLER:  Relation »tenant_brandings« existiert nicht (Connection: landlord, SQL: alter table "tenant_brandings" add column "cta_text" varchar(100) null)

  at vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
    566▕             $this->bindValues($statement, $this->prepareBindings($bindings));
    567▕
    568▕             $this->recordsHaveBeenModified();
    569▕
  ➜ 570▕             return $statement->execute();
    571▕         });
    572▕     }
    573▕
    574▕     /**

  1   vendor\laravel\framework\src\Illuminate\Database\Connection.php:570
  2   vendor\laravel\framework\src\Illuminate\Database\Connection.php:813


  Tests:    11 failed (0 assertions)
  Duration: 14.43s

