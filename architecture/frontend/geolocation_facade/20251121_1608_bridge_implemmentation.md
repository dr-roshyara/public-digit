# 🏗️ **Senior Architect Prompt: Core Bridge Integration Implementation**

## 🎯 **SYSTEM PROMPT**
```
You are a Senior Enterprise Architect & Principal Developer specializing in mission-critical system integration. Your expertise includes:

- **Enterprise Integration Patterns**: Sophisticated bridge services with production resilience
- **Domain-Driven Design**: Clean context boundaries, anti-corruption layers, domain services
- **Production Engineering**: Circuit breakers, graceful degradation, comprehensive monitoring
- **Performance Optimization**: Multi-layer caching, request deduplication, memory management
- **Team Leadership**: Clear contracts, comprehensive documentation, maintainable code

**Architectural Mandates**:
- Context boundaries must remain pristine - no business logic leakage
- Production resilience is non-negotiable - zero single points of failure
- Monitoring and observability are first-class requirements
- Team scalability through explicit contracts and documentation
```

## 📋 **PROJECT CONTEXT**
```
SYSTEM: Public Digit Platform - Political/NGO Digital Platform
TECH STACK: NX MonoRepo, Angular 17+, DDD + Hexagonal Architecture
CURRENT ASSETS: 
- Sophisticated geo-location package with multiple detection strategies
- Existing GeoTranslationBridgeService (needs enhancement)
- Route-first i18n system with three-language focus (de, np, en)
IMMEDIATE GOAL: Production-grade bridge between geo-location and i18n contexts
BUSINESS CRITICAL: Automatic language detection for German, Nepali, English users
```

## 🎯 **PRIMARY IMPLEMENTATION PROMPT**

### **PROMPT 1: Enterprise GeoTranslationBridgeService Enhancement**
```
As Principal Architect, enhance the existing GeoTranslationBridgeService to enterprise production standards with comprehensive resilience patterns.

PRODUCTION REQUIREMENTS:

1. **Multi-Factor Confidence Engine**:
   Implement weighted confidence scoring with the following distribution:
   - Geo-Location Confidence: 40% (Country detection accuracy, signal strength)
   - Browser Language Confidence: 30% (Language list order, acceptance quality)
   - User History Confidence: 20% (Previous selections, override patterns)
   - Network Signal Confidence: 10% (Detection reliability, response time)

2. **Circuit Breaker Implementation**:
   - Three-state circuit breaker (Closed, Open, Half-Open)
   - Configurable failure thresholds and timeout periods
   - Automatic recovery with exponential backoff
   - State persistence across application sessions

3. **Multi-Layer Cache Strategy**:
   - L1: Memory cache with LRU eviction (short-term, high-frequency)
   - L2: localStorage with TTL expiration (medium-term, session persistence)
   - L3: IndexedDB for historical patterns (long-term, analytics)
   - Cache warming for common user flows and geographies

4. **Comprehensive Error Hierarchy**:
   - GeoLocationDetectionError: Permission denied, timeout, accuracy issues
   - LocaleResolutionError: Unsupported country, missing mappings
   - BridgeIntegrationError: Context boundary violations, data format mismatches
   - CircuitBreakerError: Service degradation, fallback activations

TECHNICAL SPECIFICATIONS:

1. **Service Interface Contract**:
   ```typescript
   interface GeoTranslationBridge {
     detectOptimalLocale(): Promise<LocaleResolutionResult>;
     getConfidenceBreakdown(): Promise<ConfidenceScore>;
     getFallbackChain(locale: string): string[];
     shouldOverrideUserPreference(): boolean;
   }
   ```

2. **Locale Resolution Result**:
   ```typescript
   interface LocaleResolutionResult {
     detectedLocale: string; // 'de' | 'np' | 'en'
     confidence: number; // 0-1 scale
     source: 'geo' | 'browser' | 'history' | 'fallback';
     countryCode?: string;
     browserLanguages: string[];
     userHistory?: UserPreferenceHistory;
     fallbackUsed: boolean;
   }
   ```

3. **Confidence Score Breakdown**:
   ```typescript
   interface ConfidenceScore {
     overall: number;
     factors: {
       geoLocation: { score: number; weight: number; details: GeoConfidenceDetails };
       browserLanguage: { score: number; weight: number; details: BrowserConfidenceDetails };
       userHistory: { score: number; weight: number; details: HistoryConfidenceDetails };
       networkSignal: { score: number; weight: number; details: NetworkConfidenceDetails };
     };
   }
   ```

IMPLEMENTATION FOCUS:

1. **Enhance Existing Service**: Build upon current GeoTranslationBridgeService
2. **Production Resilience**: Zero single points of failure
3. **Performance Optimization**: Sub-second detection with intelligent caching
4. **Monitoring Integration**: Comprehensive metrics and health checks

DELIVERABLES:
1. Enhanced GeoTranslationBridgeService with production features
2. CircuitBreaker service with state management
3. MultiLayerCache service with TTL strategies
4. Comprehensive error hierarchy and handling
5. Health check endpoints and monitoring integration
```

## 🎯 **SUPPORTING INFRASTRUCTURE PROMPTS**

### **PROMPT 2: Confidence Calculation Engine**
```
As Data Engineering Specialist, implement the sophisticated multi-factor confidence calculation engine with statistical rigor.

CONFIDENCE CALCULATION SPECIFICS:

1. **Geo-Location Confidence (40%)**:
   - IP Geolocation Accuracy: 0.9 (high), 0.7 (medium), 0.5 (low)
   - Wifi Positioning Accuracy: 0.8 (strong signal), 0.6 (weak signal)
   - Browser Geolocation: 0.95 (high accuracy), 0.7 (low accuracy)
   - Country Detection Certainty: 1.0 (exact match), 0.8 (regional match)

2. **Browser Language Confidence (30%)**:
   - Primary Language Match: 1.0 (exact), 0.8 (regional variant)
   - Secondary Languages: 0.6 (supported), 0.3 (unsupported)
   - Accept-Language Quality: Based on HTTP Accept-Language header parsing
   - Language List Order: Weighted by position in navigator.languages

3. **User History Confidence (20%)**:
   - Explicit Selection: 1.0 (user explicitly chose language)
   - Implicit Preference: 0.7 (consistent pattern across sessions)
   - Single Override: 0.5 (one-time change from detection)
   - No History: 0.0 (first-time user)

4. **Network Signal Confidence (10%)**:
   - Response Time: 1.0 (<100ms), 0.8 (<500ms), 0.6 (<1000ms), 0.4 (>1000ms)
   - Success Rate: Based on historical service reliability
   - Cache Effectiveness: Hit rate for geo-location requests

CALCULATION ENGINE:

1. **Weighted Average Algorithm**:
   ```typescript
   overall = (geoScore * 0.4) + (browserScore * 0.3) + (historyScore * 0.2) + (networkScore * 0.1)
   ```

2. **Confidence Thresholds**:
   - High: ≥0.8 - Strong recommendation, auto-selection appropriate
   - Medium: 0.5-0.79 - Suggested selection with rationale
   - Low: <0.5 - Neutral presentation, default to English

3. **Statistical Validation**:
   - Confidence score correlation with user satisfaction
   - A/B testing framework for weight optimization
   - Continuous calibration based on real-world performance

IMPLEMENTATION:

1. **ConfidenceCalculator Service**:
   - Pluggable factor providers for testability
   - Configurable weights for environment tuning
   - Comprehensive logging for debugging and optimization

2. **Factor Providers**:
   - GeoLocationFactorProvider with accuracy assessment
   - BrowserLanguageFactorProvider with quality parsing
   - UserHistoryFactorProvider with pattern recognition
   - NetworkSignalFactorProvider with performance metrics

DELIVERABLES:
1. ConfidenceCalculator service with statistical rigor
2. Factor provider interfaces and implementations
3. Confidence threshold configuration system
4. Validation and calibration utilities
```

### **PROMPT 3: Circuit Breaker & Resilience Patterns**
```
As Resilience Engineering Specialist, implement production-grade circuit breaker patterns with comprehensive state management.

CIRCUIT BREAKER SPECIFICATION:

1. **Three-State Machine**:
   - CLOSED: Normal operation, requests pass through
   - OPEN: Service failure, immediate fallback, no requests
   - HALF_OPEN: Limited testing, gradual recovery

2. **Configuration Parameters**:
   - Failure Threshold: 5 failures within 30 seconds
   - Timeout Duration: 30 seconds in OPEN state
   - Success Threshold: 3 successful calls to transition to CLOSED
   - Sampling Size: Last 100 requests for statistics

3. **State Persistence**:
   - localStorage for session persistence
   - Memory cache for performance
   - Recovery state across application restarts

IMPLEMENTATION PATTERNS:

1. **CircuitBreaker Service**:
   ```typescript
   class CircuitBreaker {
     async execute<T>(operation: () => Promise<T>): Promise<T>;
     getState(): CircuitState;
     getMetrics(): CircuitMetrics;
     forceOpen(): void;
     forceClosed(): void;
   }
   ```

2. **Fallback Strategies**:
   - Primary: Browser language detection
   - Secondary: Default locale (English)
   - Tertiary: Last known good configuration

3. **Monitoring & Metrics**:
   - Failure rate tracking
   - State transition logging
   - Performance impact analysis
   - Health check integration

RESILIENCE PATTERNS:

1. **Retry with Exponential Backoff**:
   - Initial delay: 100ms
   - Maximum delay: 5 seconds
   - Maximum attempts: 3

2. **Bulkhead Isolation**:
   - Separate execution contexts for different services
   - Resource allocation limits per service
   - Independent failure containment

3. **Timeout Management**:
   - Configurable timeouts per operation type
   - Graceful timeout handling
   - User-friendly timeout messages

DELIVERABLES:
1. Production CircuitBreaker service with state persistence
2. Comprehensive fallback strategy implementation
3. Resilience metrics and monitoring
4. Bulkhead isolation patterns
```

### **PROMPT 4: Multi-Layer Cache Strategy**
```
As Performance Engineering Specialist, implement sophisticated multi-layer caching with optimal TTL strategies and eviction policies.

CACHE ARCHITECTURE:

1. **L1: Memory Cache (In-Memory)**:
   - Max Size: 1000 entries
   - Eviction Policy: LRU (Least Recently Used)
   - TTL: 5 minutes for geo-location, 1 minute for confidence scores
   - Use Case: High-frequency, short-lived data

2. **L2: localStorage Cache**:
   - Max Size: 5MB per domain
   - Eviction Policy: Manual cleanup with TTL
   - TTL: 1 hour for user preferences, 30 minutes for geo-data
   - Use Case: Session persistence, user preferences

3. **L3: IndexedDB Cache**:
   - Max Size: 50MB
   - Eviction Policy: Custom based on access patterns
   - TTL: 24 hours for historical patterns, 7 days for analytics
   - Use Case: Historical data, analytics, performance metrics

CACHE STRATEGIES:

1. **Write-Through Cache**:
   - Data written to all cache layers simultaneously
   - Ensures consistency across layers
   - Higher write latency, better read performance

2. **Cache Warming**:
   - Pre-load common user flows (Germany → German, Nepal → Nepali)
   - Predictive loading based on user IP patterns
   - Background synchronization of frequently accessed data

3. **Stale-While-Revalidate**:
   - Serve stale data while fetching fresh data in background
   - Optimal balance between freshness and performance
   - Configurable staleness thresholds

PERFORMANCE OPTIMIZATION:

1. **Request Deduplication**:
   - Concurrent identical requests served from single source
   - Request coalescing for high-frequency operations
   - Memory leak prevention through proper cleanup

2. **Memory Management**:
   - Weak references for large objects
   - Manual memory cleanup on navigation
   - Performance monitoring of memory usage

3. **Cache Efficiency Metrics**:
   - Hit rate per cache layer
   - Average load time reduction
   - Memory usage optimization

DELIVERABLES:
1. MultiLayerCache service with three-tier architecture
2. Cache warming and predictive loading
3. Performance monitoring and optimization
4. Memory management and leak prevention
```

## 🛠 **INTEGRATION & TESTING PROMPTS**

### **PROMPT 5: Comprehensive Testing Strategy**
```
As QA Architect, implement enterprise-grade testing strategy covering all integration points and failure scenarios.

TESTING PYRAMID:

1. **Unit Tests (Foundation)**:
   - Confidence calculation algorithms
   - Circuit breaker state transitions
   - Cache layer interactions
   - Error handling scenarios

2. **Integration Tests (Bridge Layer)**:
   - Geo-location package to bridge service integration
   - Bridge service to i18n context communication
   - Cache layer consistency across operations
   - Circuit breaker with actual service calls

3. **E2E Tests (User Scenarios)**:
   - Complete locale detection flow (happy path)
   - Service degradation and fallback scenarios
   - Cache hit/miss performance validation
   - Error recovery and user experience

TEST SCENARIOS:

1. **High Confidence Scenarios**:
   - German IP + German browser → German locale (confidence > 0.8)
   - Nepali IP + Nepali browser → Nepali locale (confidence > 0.8)

2. **Medium Confidence Scenarios**:
   - German IP + English browser → German suggested (confidence 0.5-0.8)
   - VPN usage with mixed signals → English default (confidence < 0.5)

3. **Failure Scenarios**:
   - Geo-location service timeout → Browser fallback
   - All services down → Last known good configuration
   - Cache corruption → Fresh detection with degraded performance

TESTING INFRASTRUCTURE:

1. **Mock Services**:
   - GeoLocationService mock with configurable responses
   - BrowserLanguageService mock with various language setups
   - NetworkCondition mock with latency and failure simulation

2. **Test Data Builders**:
   - ConfidenceScoreBuilder for various confidence levels
   - LocaleResolutionBuilder for different detection scenarios
   - UserHistoryBuilder for preference pattern testing

3. **Performance Benchmarks**:
   - Detection time under various conditions
   - Cache effectiveness measurements
   - Memory usage patterns

DELIVERABLES:
1. Comprehensive test suite with 90%+ coverage
2. Mock services and test data builders
3. Performance benchmarking suite
4. Continuous integration pipeline integration
```

### **PROMPT 6: Monitoring & Observability**
```
As DevOps Architect, implement comprehensive monitoring and observability for production deployment.

MONITORING REQUIREMENTS:

1. **Health Checks**:
   - Geo-location service availability
   - Cache layer health and efficiency
   - Circuit breaker state monitoring
   - Confidence calculation accuracy

2. **Performance Metrics**:
   - Detection time percentiles (p50, p95, p99)
   - Cache hit rates per layer
   - Error rates and types
   - Confidence score distribution

3. **Business Metrics**:
   - Locale detection accuracy
   - User satisfaction with auto-detection
   - Fallback activation frequency
   - Support ticket reduction

OBSERVABILITY IMPLEMENTATION:

1. **Structured Logging**:
   - JSON-formatted logs with correlation IDs
   - Log levels appropriate for production debugging
   - Contextual information for error investigation

2. **Metrics Collection**:
   - Time-series data for performance trends
   - Counter metrics for business events
   - Histogram metrics for distribution analysis

3. **Alerting Configuration**:
   - Error rate thresholds with escalation
   - Performance degradation detection
   - Circuit breaker state changes

DASHBOARD & VISUALIZATION:

1. **Real-time Dashboard**:
   - Current system health status
   - Performance metrics visualization
   - Error rate tracking
   - User impact analysis

2. **Historical Analytics**:
   - Trend analysis for optimization
   - Seasonal pattern recognition
   - Capacity planning insights

DELIVERABLES:
1. Comprehensive monitoring setup with metrics collection
2. Real-time dashboard for system health
3. Alerting configuration with escalation paths
4. Performance analytics and reporting
```

## 🚀 **EXECUTION WORKFLOW**

```
Priority Execution Sequence:
1. PROMPT 1 → Enterprise GeoTranslationBridgeService Enhancement
2. PROMPT 2 → Confidence Calculation Engine
3. PROMPT 3 → Circuit Breaker & Resilience Patterns  
4. PROMPT 4 → Multi-Layer Cache Strategy
5. PROMPT 5 → Comprehensive Testing Strategy
6. PROMPT 6 → Monitoring & Observability

Quality Gates:
- Each service must pass comprehensive code review
- All tests must achieve 90%+ coverage
- Performance benchmarks must be met
- Production monitoring must be operational
- Documentation must be complete and reviewed
```

## 📈 **SUCCESS CRITERIA**

```
Technical Excellence:
- Detection accuracy: >95% for target countries (DE, NP)
- Performance: <500ms detection time (p95)
- Resilience: Zero unhandled exceptions in production
- Cache efficiency: >80% hit rate for common scenarios

Production Readiness:
- Comprehensive monitoring and alerting
- Graceful degradation under failure conditions
- Zero memory leaks or performance regressions
- Full test coverage with integration tests

Team Enablement:
- Clear interface contracts and documentation
- Comprehensive error handling and logging
- Maintainable and extensible architecture
- Production deployment and operational runbooks
```

**Ready to execute Prompt 1: Enterprise GeoTranslationBridgeService Enhancement?** This establishes the architectural foundation for the entire geo-location to i18n bridge with production-grade resilience and performance characteristics.