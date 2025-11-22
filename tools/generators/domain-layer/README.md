# Domain Layer Generator

NX workspace generator for creating DDD domain layer artifacts in the mobile app.

## Usage

```bash
# Generate a domain entity
nx generate domain-layer <name> --type=entity --context=<context>

# Generate a value object
nx generate domain-layer <name> --type=value-object --context=<context>

# Generate a repository interface
nx generate domain-layer <name> --type=repository --context=<context>

# Generate a domain service
nx generate domain-layer <name> --type=service --context=<context>

# Generate a domain event
nx generate domain-layer <name> --type=event --context=<context>
```

## Examples

```bash
# Create a User entity in the identity context
nx generate domain-layer user --type=entity --context=identity

# Create an EmailAddress value object in the shared context
nx generate domain-layer email-address --type=value-object --context=shared

# Create a UserRepository in the identity context
nx generate domain-layer user --type=repository --context=identity

# Create a UserValidationService in the identity context
nx generate domain-layer user-validation --type=service --context=identity

# Create a UserCreatedEvent in the identity context
nx generate domain-layer user-created --type=event --context=identity
```

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Name of the domain artifact |
| `type` | enum | No | `entity` | Type of artifact: `entity`, `value-object`, `repository`, `service`, `event` |
| `context` | string | No | `shared` | Bounded context (subdirectory in domain layer) |

## Output Structure

### Entity
- **File**: `apps/mobile/src/app/domain/<context>/entities/<name>.entity.ts`
- **Contains**: Entity class with identity, validation, and business logic

### Value Object
- **File**: `apps/mobile/src/app/domain/<context>/value-objects/<name>.vo.ts`
- **Contains**: Immutable value object with validation

### Repository
- **File**: `apps/mobile/src/app/domain/<context>/repositories/<name>.repository.ts`
- **Contains**: Repository interface with injection token

### Service
- **File**: `apps/mobile/src/app/domain/<context>/services/<name>.service.ts`
- **Contains**: Domain service with business logic

### Event
- **File**: `apps/mobile/src/app/domain/<context>/events/<name>.event.ts`
- **Contains**: Domain event class with payload

## Next Steps After Generation

1. **Implement the generated artifact** with your specific domain logic
2. **Add unit tests** for the domain logic
3. **Update barrel exports** by creating or updating `index.ts` files
4. **Run validation** with `node tools/scripts/validate-architecture.js`

## Architecture Guidelines

### Entities
- Have unique identity (ID)
- Can have mutable state
- Contain business logic
- Must validate themselves

### Value Objects
- No identity
- Immutable
- Equality based on value
- Must validate themselves

### Repositories
- Define data access contract
- Implemented in infrastructure layer
- Use injection tokens for DI

### Domain Services
- Stateless business logic
- No infrastructure dependencies
- Pure domain operations

### Domain Events
- Immutable facts
- Represent something that happened
- Used for communication between contexts

## DDD Layer Dependencies

```
Domain Layer (No dependencies)
    ↑
    |--- Application Layer (depends on Domain)
    ↑
    |--- Infrastructure Layer (implements Domain interfaces)
    ↑
    |--- Presentation Layer (depends on Application)
```

The domain layer should NEVER depend on:
- Application layer
- Infrastructure layer
- Presentation layer
- External packages (except Angular core for DI)
