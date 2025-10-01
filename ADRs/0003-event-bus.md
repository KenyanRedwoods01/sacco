# ADR 0003: Event-Driven Architecture with Apache Kafka

## Status
Accepted

## Context
The SACCO Management System requires a robust, scalable, and reliable event-driven architecture to handle complex financial workflows, ensure data consistency across microservices, and provide real-time capabilities. The system must support:

- **Financial transaction consistency** across multiple services
- **Real-time notifications** for member activities
- **Audit trail maintenance** for regulatory compliance
- **Microservices communication** without tight coupling
- **Event sourcing** for critical financial operations
- **Backpressure handling** during high-load periods
- **Fault tolerance** and event replay capabilities
- **Multi-datacenter replication** for disaster recovery

## Decision
We will implement an **event-driven architecture** using Apache Kafka as the central event bus, with Laravel Events for domain event emission and Kafka Connect for ecosystem integration.

### Event Bus Architecture

#### Core Components
```yaml
Event Bus: Apache Kafka
Message Format: Avro with Schema Registry
Event Storage: Kafka topics with 7-year retention
Service Integration: 
  - Laravel: php-rdkafka + custom event dispatcher
  - Node.js: kafkajs library
  - Python: confluent-kafka-python
  - Monitoring: Kafka Connect with Prometheus metrics
```

#### Topic Design Strategy

##### Domain-Based Topics
```yaml
# Member Lifecycle
sacco.member.events:
  - member.registered
  - member.verified
  - member.kyc.approved
  - member.status.changed

# Financial Transactions
sacco.transaction.events:
  - deposit.initiated
  - deposit.completed
  - withdrawal.requested
  - withdrawal.processed
  - transfer.executed

# Loan Management
sacco.loan.events:
  - loan.application.submitted
  - loan.approved
  - loan.disbursed
  - repayment.received
  - loan.delinquent
  - loan.restructured

# Accounting & Ledger
sacco.accounting.events:
  - ledger.entry.created
  - journal.posted
  - interest.accrued
  - dividend.declared

# Compliance & Reporting
sacco.compliance.events:
  - sasra.report.generated
  - audit.trail.updated
  - suspicious.activity.detected
```

##### Event-Driven Services

###### Payments Service
```yaml
Consumes:
  - sacco.transaction.events (deposit.initiated, withdrawal.requested)
  
Produces:
  - sacco.payment.events (payment.processed, payment.failed, payment.reconciled)

Key Workflows:
  - M-Pesa STK push processing
  - Payment gateway webhook handling
  - Transaction reconciliation
```

###### Notifications Service
```yaml
Consumes:
  - sacco.member.events
  - sacco.loan.events
  - sacco.transaction.events
  
Produces:
  - sacco.notification.events (notification.sent, notification.failed)

Key Workflows:
  - Real-time SMS alerts for transactions
  - Email statements and receipts
  - Push notifications for loan status
```

###### Analytics Service
```yaml
Consumes:
  - All domain events for data aggregation
  
Produces:
  - sacco.analytics.events (risk.score.calculated, fraud.detected)

Key Workflows:
  - Real-time risk scoring
  - Fraud detection patterns
  - Business intelligence aggregation
```

### Technical Implementation

#### Laravel Event Integration
```php
<?php

// app/Events/MemberRegistered.php
class MemberRegistered implements ShouldBroadcastToKafka
{
    use SerializesModels;
    
    public $member;
    public $timestamp;
    
    public function __construct(Member $member)
    {
        $this->member = $member;
        $this->timestamp = now();
    }
    
    public function broadcastOn(): array
    {
        return ['sacco.member.events'];
    }
    
    public function broadcastAs(): string
    {
        return 'member.registered';
    }
    
    public function broadcastWith(): array
    {
        return [
            'member_id' => $this->member->id,
            'email' => $this->member->email,
            'phone' => $this->member->phone,
            'registered_at' => $this->member->created_at,
            'event_id' => Str::uuid(),
            'correlation_id' => request()->header('X-Correlation-ID'),
        ];
    }
}

// app/Providers/EventServiceProvider.php
class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        MemberRegistered::class => [
            SendWelcomeEmail::class,
            CreateMemberAccount::class,
            SyncToKeycloak::class,
            PublishToKafka::class, // Kafka event publication
        ],
    ];
}
```

#### Kafka Event Dispatcher
```php
<?php

// app/Services/KafkaEventDispatcher.php
class KafkaEventDispatcher
{
    protected $producer;
    
    public function __construct()
    {
        $conf = new \RdKafka\Conf();
        $conf->set('bootstrap.servers', config('kafka.brokers'));
        $conf->set('schema.registry.url', config('kafka.schema_registry'));
        
        $this->producer = new \RdKafka\Producer($conf);
    }
    
    public function dispatch($event): void
    {
        $topic = $this->producer->newTopic($event->broadcastOn()[0]);
        
        $payload = [
            'event_id' => Str::uuid(),
            'event_type' => $event->broadcastAs(),
            'timestamp' => now()->toISOString(),
            'version' => '1.0',
            'data' => $event->broadcastWith(),
            'metadata' => [
                'source' => 'sacco-backend',
                'correlation_id' => request()->header('X-Correlation-ID'),
                'user_id' => auth()->id(),
            ]
        ];
        
        // Avro serialization with schema validation
        $avroPayload = $this->serializeWithAvro($payload, $event->broadcastAs());
        
        $topic->produce(RD_KAFKA_PARTITION_UA, 0, $avroPayload);
        $this->producer->poll(0);
    }
    
    public function __destruct()
    {
        $this->producer->flush(10000);
    }
}
```

#### Event Schema Management

##### Avro Schema Definition
```json
{
  "type": "record",
  "name": "MemberRegistered",
  "namespace": "com.sacco.events",
  "fields": [
    {
      "name": "event_id",
      "type": "string",
      "doc": "Unique event identifier"
    },
    {
      "name": "event_type",
      "type": "string",
      "doc": "Type of event"
    },
    {
      "name": "timestamp",
      "type": "string",
      "doc": "Event timestamp in ISO format"
    },
    {
      "name": "version",
      "type": "string",
      "doc": "Event schema version"
    },
    {
      "name": "data",
      "type": {
        "type": "record",
        "name": "MemberData",
        "fields": [
          {"name": "member_id", "type": "string"},
          {"name": "email", "type": "string"},
          {"name": "phone", "type": "string"},
          {"name": "registered_at", "type": "string"}
        ]
      }
    },
    {
      "name": "metadata",
      "type": {
        "type": "record",
        "name": "EventMetadata",
        "fields": [
          {"name": "source", "type": "string"},
          {"name": "correlation_id", "type": ["null", "string"]},
          {"name": "user_id", "type": ["null", "string"]}
        ]
      }
    }
  ]
}
```

### Event Processing Patterns

#### Transactional Outbox Pattern
```php
<?php

// Ensure events are published exactly once
class TransactionalOutbox
{
    public function publishWithTransaction($event, callable $transaction): void
    {
        DB::transaction(function () use ($event, $transaction) {
            // Execute the business transaction
            $transaction();
            
            // Store event in outbox
            OutboxEvent::create([
                'event_id' => Str::uuid(),
                'event_type' => get_class($event),
                'payload' => $event->broadcastWith(),
                'topic' => $event->broadcastOn()[0],
                'created_at' => now(),
            ]);
        });
        
        // Background job to publish from outbox
        PublishOutboxEvents::dispatch();
    }
}

// app/Jobs/PublishOutboxEvents.php
class PublishOutboxEvents implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public function handle(): void
    {
        $events = OutboxEvent::where('published', false)
            ->orderBy('created_at')
            ->limit(100)
            ->get();
            
        foreach ($events as $event) {
            try {
                $kafkaDispatcher = app(KafkaEventDispatcher::class);
                $kafkaDispatcher->dispatch($event);
                
                $event->update(['published' => true, 'published_at' => now()]);
            } catch (\Exception $e) {
                Log::error("Failed to publish event: {$event->event_id}", [
                    'error' => $e->getMessage()
                ]);
            }
        }
    }
}
```

#### Saga Pattern for Distributed Transactions
```php
<?php

// Loan Application Saga
class LoanApplicationSaga
{
    public function start(LoanApplication $application): void
    {
        // Step 1: Initiate credit check
        event(new CreditCheckInitiated($application));
        
        // Saga continues through events
    }
}

// Saga event handlers
class CreditCheckInitiatedHandler
{
    public function handle(CreditCheckInitiated $event): void
    {
        $score = $this->crbService->checkCredit($event->application);
        
        if ($score > 600) {
            event(new CreditCheckPassed($event->application, $score));
        } else {
            event(new CreditCheckFailed($event->application, $score));
        }
    }
}
```

### Infrastructure Configuration

#### Kafka Cluster Setup
```yaml
# docker-compose.kafka.yml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.3.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:7.3.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1

  schema-registry:
    image: confluentinc/cp-schema-registry:7.3.0
    depends_on:
      - kafka
    environment:
      SCHEMA_REGISTRY_HOST_NAME: schema-registry
      SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS: kafka:9092
      SCHEMA_REGISTRY_LISTENERS: http://0.0.0.0:8081

  kafka-connect:
    image: confluentinc/cp-kafka-connect:7.3.0
    depends_on:
      - kafka
      - schema-registry
    environment:
      CONNECT_BOOTSTRAP_SERVERS: kafka:9092
      CONNECT_REST_PORT: 8083
      CONNECT_GROUP_ID: kafka-connect
      CONNECT_CONFIG_STORAGE_TOPIC: _connect-configs
      CONNECT_OFFSET_STORAGE_TOPIC: _connect-offsets
      CONNECT_STATUS_STORAGE_TOPIC: _connect-status
      CONNECT_KEY_CONVERTER: io.confluent.connect.avro.AvroConverter
      CONNECT_VALUE_CONVERTER: io.confluent.connect.avro.AvroConverter
      CONNECT_KEY_CONVERTER_SCHEMA_REGISTRY_URL: http://schema-registry:8081
      CONNECT_VALUE_CONVERTER_SCHEMA_REGISTRY_URL: http://schema-registry:8081
```

#### Topic Configuration
```bash
# Create topics with appropriate configuration
kafka-topics --create --topic sacco.member.events \
  --bootstrap-server localhost:9092 \
  --partitions 6 \
  --replication-factor 3 \
  --config retention.ms=220752000000 \  # 7 years for compliance
  --config cleanup.policy=compact

kafka-topics --create --topic sacco.transaction.events \
  --bootstrap-server localhost:9092 \
  --partitions 12 \
  --replication-factor 3 \
  --config retention.ms=220752000000

kafka-topics --create --topic sacco.loan.events \
  --bootstrap-server localhost:9092 \
  --partitions 8 \
  --replication-factor 3 \
  --config retention.ms=220752000000
```

### Monitoring and Observability

#### Event Metrics
```yaml
Business Metrics:
  - events.produced.per.second
  - events.consumed.per.second
  - event.processing.latency
  - dead.letter.queue.size

Technical Metrics:
  - kafka.broker.throughput
  - consumer.lag.seconds
  - topic.partition.count
  - schema.registry.requests
```

#### Health Checks
```php
<?php

// app/Console/Commands/CheckEventBusHealth.php
class CheckEventBusHealth extends Command
{
    protected $signature = 'event-bus:health';
    
    public function handle(): int
    {
        $health = [
            'kafka_brokers' => $this->checkKafkaBrokers(),
            'schema_registry' => $this->checkSchemaRegistry(),
            'consumer_groups' => $this->checkConsumerGroups(),
            'topic_health' => $this->checkTopicHealth(),
        ];
        
        if (in_array(false, $health)) {
            $this->error('Event bus health check failed');
            return 1;
        }
        
        $this->info('Event bus is healthy');
        return 0;
    }
}
```

## Consequences

### Positive Outcomes
- **Loose Coupling**: Services communicate through events without direct dependencies
- **Scalability**: Independent scaling of event producers and consumers
- **Fault Tolerance**: Event replay capabilities for system recovery
- **Audit Trail**: Complete history of all system events for compliance
- **Real-time Processing**: Immediate reaction to business events
- **Data Consistency**: Saga pattern ensures distributed transaction integrity

### Negative Outcomes
- **Complexity**: Distributed system debugging and monitoring challenges
- **Infrastructure Overhead**: Kafka cluster management and maintenance
- **Eventual Consistency**: Some data may be temporarily inconsistent
- **Learning Curve**: Team needs to understand event-driven patterns
- **Operational Complexity**: Schema evolution and compatibility management

### Risks and Mitigations
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Event Loss** | High | Low | Transactional outbox, idempotent consumers, DLQ |
| **Schema Evolution** | Medium | High | Schema Registry, compatibility checks, versioning |
| **Consumer Lag** | Medium | Medium | Monitoring, auto-scaling, parallel processing |
| **Kafka Cluster Failure** | High | Low | Multi-broker setup, replication, disaster recovery |

## Migration Strategy

### Phase 1: Foundation (Month 1-2)
```yaml
Objectives:
  - Kafka cluster setup
  - Basic event publishing from Laravel
  - Schema Registry configuration
  - Monitoring setup

Deliverables:
  ✅ Production Kafka cluster
  ✅ Member and transaction events
  ✅ Basic event monitoring
  ✅ Developer documentation
```

### Phase 2: Core Events (Month 3-4)
```yaml
Objectives:
  - All domain events implemented
  - Microservices event consumption
  - Saga patterns for complex workflows
  - Enhanced monitoring

Deliverables:
  ✅ Complete event taxonomy
  ✅ Notifications service integration
  ✅ Loan application saga
  ✅ Real-time dashboards
```

### Phase 3: Advanced Features (Month 5-6)
```yaml
Objectives:
  - Event sourcing for critical domains
  - Cross-datacenter replication
  - Advanced error handling
  - Performance optimization

Deliverables:
  ✅ Event-sourced ledger
  ✅ DR event replication
  ✅ DLQ and retry mechanisms
  ✅ Performance tuning
```

## Alternatives Considered

### Alternative 1: RabbitMQ
**Pros**: Mature, good for complex routing, easier operation  
**Cons**: Lower throughput, weaker retention, limited replay capabilities  
**Decision**: Rejected due to retention requirements and scale needs

### Alternative 2: AWS SNS/SQS
**Pros**: Fully managed, good integration with AWS ecosystem  
**Cons**: Vendor lock-in, cost at scale, limited message ordering  
**Decision**: Rejected due to vendor lock-in concerns and ordering requirements

### Alternative 3: NATS Streaming
**Pros**: High performance, simple operation, cloud-native  
**Cons**: Less enterprise features, smaller ecosystem, newer technology  
**Decision**: Rejected due to maturity concerns for financial systems

### Alternative 4: Database as Queue
**Pros**: Simple, transactional consistency, no new infrastructure  
**Cons**: Poor performance at scale, no real-time capabilities, operational overhead  
**Decision**: Rejected due to scale and real-time requirements

## Compliance and Security

### Data Protection
```yaml
Event Data Security:
  - PII encryption in event payloads
  - Schema-level data classification
  - Access controls on Kafka topics
  - Event data retention policies

Audit Requirements:
  - Immutable event storage
  - Event provenance tracking
  - Access logging for event data
  - Compliance reporting from events
```

### Financial Regulations
```yaml
Transaction Auditing:
  - Complete event history for all transactions
  - Event correlation for traceability
  - Tamper-evident event storage
  - Regulatory event reporting

Data Retention:
  - 7-year event retention for financial records
  - Archived event access for audits
  - Secure event deletion procedures
  - Compliance monitoring alerts
```

## Success Metrics

### Technical Metrics
```yaml
Performance:
  - Event publication latency: < 100ms P95
  - Event processing latency: < 500ms P95
  - System throughput: > 10,000 events/second
  - Consumer lag: < 30 seconds

Reliability:
  - Event delivery guarantee: 99.99%
  - System availability: 99.95%
  - Mean time to recover: < 15 minutes
  - Data loss: 0 events
```

### Business Metrics
```yaml
Operational Efficiency:
  - Real-time notification delivery: > 99%
  - Automated workflow completion: > 95%
  - Manual intervention reduction: > 80%
  - Audit report generation time: < 5 minutes

System Value:
  - Event-driven feature deployment: > 90%
  - Microservice independence: > 95%
  - Business agility improvement: > 50%
  - Regulatory compliance automation: 100%
```

## Implementation Timeline

### Week 1-4: Infrastructure
- Kafka cluster setup and configuration
- Schema Registry deployment
- Monitoring and alerting setup
- Development environment preparation

### Week 5-8: Core Implementation
- Laravel event dispatcher integration
- Avro schema definition and registration
- Basic event producers and consumers
- Testing and validation framework

### Week 9-12: Advanced Patterns
- Transactional outbox implementation
- Saga pattern for complex workflows
- Error handling and dead letter queues
- Performance testing and optimization

### Week 13-16: Production Readiness
- Security hardening and access controls
- Disaster recovery procedures
- Documentation and training
- Production deployment and monitoring

---

## Signed

**RedwoodsKenyan**  
Lead Architect & Developer  
Date: $(date +%Y-%m-%d)

**Approvers:**
- [ ] DevOps Lead
- [ ] Security Officer
- [ ] Product Manager
- [ ] CTO/Technical Lead

---

*This Event Bus ADR will be reviewed quarterly to incorporate new event-driven patterns, scale requirements, and technology evolution. All event-related changes must maintain compatibility and adhere to this architecture.*
