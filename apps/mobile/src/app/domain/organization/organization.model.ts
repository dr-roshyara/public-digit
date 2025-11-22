/**
 * Organization Domain Model
 *
 * Rich domain model extracted from existing Tenant interface with business behavior.
 * This replaces the anemic data container pattern with domain-driven design.
 *
 * Extracted from: core/services/tenant-context.service.ts (Tenant interface)
 */

/**
 * Organization ID Value Object
 * Encapsulates organization identity with validation
 */
export class OrganizationId {
  constructor(private readonly value: string) {}

  /**
   * Generate a new organization ID
   * Business rule: IDs must follow pattern org_<timestamp>_<random>
   */
  static generate(): OrganizationId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return new OrganizationId(`org_${timestamp}_${random}`);
  }

  /**
   * Create from existing value (e.g., from database)
   * Business rule: Must validate format
   */
  static fromString(value: string): OrganizationId {
    if (!value || !value.startsWith('org_')) {
      throw new InvalidOrganizationIdError(`Invalid organization ID format: ${value}`);
    }
    return new OrganizationId(value);
  }

  /**
   * Value object equality
   */
  equals(other: OrganizationId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toNumber(): number {
    // Extract numeric ID for backward compatibility with existing code
    const match = this.value.match(/org_(\d+)_/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

/**
 * Organization Type Value Object
 * Encapsulates organization type with validation
 */
export class OrganizationType {
  private constructor(private readonly value: 'POLITICAL_PARTY' | 'NGO') {}

  /**
   * Create organization type with validation
   * Business rule: Only allowed types are POLITICAL_PARTY and NGO
   */
  static create(type: string): OrganizationType {
    if (!['POLITICAL_PARTY', 'NGO'].includes(type)) {
      throw new InvalidOrganizationTypeError(`Invalid organization type: ${type}`);
    }
    return new OrganizationType(type as 'POLITICAL_PARTY' | 'NGO');
  }

  isPoliticalParty(): boolean {
    return this.value === 'POLITICAL_PARTY';
  }

  isNGO(): boolean {
    return this.value === 'NGO';
  }

  toString(): string {
    return this.value;
  }

  equals(other: OrganizationType): boolean {
    return this.value === other.value;
  }
}

/**
 * Organization Domain Entity
 * Rich domain model with business behavior extracted from existing Tenant interface
 */
export class Organization {
  private domainEvents: DomainEvent[] = [];

  constructor(
    public readonly id: OrganizationId,
    public readonly name: string,
    public readonly type: OrganizationType,
    private memberCount: number,
    private createdAt: Date,
    public readonly logoUrl?: string,
    public readonly description?: string,
    public readonly status: 'active' | 'inactive' | 'pending' = 'active'
  ) {}

  /**
   * Factory method to create new organization
   * Extracts business validation from existing services
   */
  static create(name: string, type: string, description?: string): Organization {
    // Business validation extracted from existing services
    if (!name?.trim()) {
      throw new InvalidOrganizationError('Organization name is required');
    }

    if (name.trim().length < 2) {
      throw new InvalidOrganizationError('Organization name must be at least 2 characters');
    }

    if (name.trim().length > 100) {
      throw new InvalidOrganizationError('Organization name must be less than 100 characters');
    }

    const organizationType = OrganizationType.create(type);
    const organizationId = OrganizationId.generate();

    const organization = new Organization(
      organizationId,
      name.trim(),
      organizationType,
      0, // Start with 0 members
      new Date(),
      undefined, // No logo initially
      description?.trim()
    );

    // Record domain event
    organization.addDomainEvent(new OrganizationCreatedEvent(organizationId, name.trim()));

    return organization;
  }

  /**
   * Reconstruct from existing data (for migration from Tenant interface)
   */
  static fromExisting(tenantData: {
    id: number;
    slug: string;
    name: string;
    status: string;
    logo_url?: string;
    description?: string;
  }): Organization {
    // Convert existing tenant data to organization domain model
    const organizationId = OrganizationId.fromString(`org_${tenantData.id}_${tenantData.slug}`);

    // Determine type from existing data (extract business logic)
    const type = tenantData.description?.toLowerCase().includes('political')
      ? 'POLITICAL_PARTY'
      : 'NGO';

    const organizationType = OrganizationType.create(type);

    return new Organization(
      organizationId,
      tenantData.name,
      organizationType,
      0, // Member count not available in existing data
      new Date(), // Created at not available in existing data
      tenantData.logo_url,
      tenantData.description,
      tenantData.status as 'active' | 'inactive' | 'pending'
    );
  }

  /**
   * Business method: Add member to organization
   * Extracts business logic from existing services
   */
  addMember(): void {
    if (this.status !== 'active') {
      throw new OrganizationNotActiveError('Cannot add members to inactive organization');
    }

    this.memberCount++;

    // Record domain event
    this.addDomainEvent(new MemberAddedEvent(this.id, this.memberCount));
  }

  /**
   * Business method: Remove member from organization
   */
  removeMember(): void {
    if (this.memberCount <= 0) {
      throw new InvalidOrganizationOperationError('Cannot remove member from organization with 0 members');
    }

    this.memberCount--;

    // Record domain event
    this.addDomainEvent(new MemberRemovedEvent(this.id, this.memberCount));
  }

  /**
   * Business method: Check if organization can accept new members
   * Extracts business rules from existing services
   */
  canAcceptMembers(): boolean {
    return this.status === 'active';
  }

  /**
   * Business method: Get organization statistics
   */
  getStatistics(): OrganizationStatistics {
    return {
      memberCount: this.memberCount,
      isActive: this.status === 'active',
      isPoliticalParty: this.type.isPoliticalParty(),
      isNGO: this.type.isNGO(),
      ageInDays: Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * Business method: Update organization information
   */
  updateInfo(name: string, description?: string): void {
    if (!name?.trim()) {
      throw new InvalidOrganizationError('Organization name is required');
    }

    // Use private field access for mutation
    (this as any).name = name.trim();
    (this as any).description = description?.trim();

    // Record domain event
    this.addDomainEvent(new OrganizationUpdatedEvent(this.id, 'info'));
  }

  /**
   * Domain event management
   */
  private addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }

  /**
   * Getters for computed properties
   */
  get displayName(): string {
    return `${this.name} (${this.type.toString()})`;
  }

  get isActive(): boolean {
    return this.status === 'active';
  }
}

/**
 * Domain Events
 */
export interface DomainEvent {
  readonly eventType: string;
  readonly timestamp: Date;
  readonly organizationId: OrganizationId;
}

export class OrganizationCreatedEvent implements DomainEvent {
  readonly eventType = 'OrganizationCreated';
  readonly timestamp = new Date();

  constructor(
    public readonly organizationId: OrganizationId,
    public readonly organizationName: string
  ) {}
}

export class MemberAddedEvent implements DomainEvent {
  readonly eventType = 'MemberAdded';
  readonly timestamp = new Date();

  constructor(
    public readonly organizationId: OrganizationId,
    public readonly totalMembers: number
  ) {}
}

export class MemberRemovedEvent implements DomainEvent {
  readonly eventType = 'MemberRemoved';
  readonly timestamp = new Date();

  constructor(
    public readonly organizationId: OrganizationId,
    public readonly totalMembers: number
  ) {}
}

export class OrganizationUpdatedEvent implements DomainEvent {
  readonly eventType = 'OrganizationUpdated';
  readonly timestamp = new Date();

  constructor(
    public readonly organizationId: OrganizationId,
    public readonly updateType: string
  ) {}
}

/**
 * Organization Statistics
 */
export interface OrganizationStatistics {
  memberCount: number;
  isActive: boolean;
  isPoliticalParty: boolean;
  isNGO: boolean;
  ageInDays: number;
}

/**
 * Domain Exceptions
 */
export class InvalidOrganizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrganizationError';
  }
}

export class InvalidOrganizationIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrganizationIdError';
  }
}

export class InvalidOrganizationTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrganizationTypeError';
  }
}

export class OrganizationNotActiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrganizationNotActiveError';
  }
}

export class InvalidOrganizationOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrganizationOperationError';
  }
}