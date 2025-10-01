# ADR 0004: Database Technology Selection - PostgreSQL

## Status
Accepted

## Context
The SACCO Management System requires a robust, ACID-compliant database system capable of handling complex financial transactions, regulatory reporting, and member data management. The database must support:

- **Financial-grade transaction integrity** with ACID compliance
- **Complex relational data models** for member accounts, loans, and transactions
- **Regulatory compliance** with audit trails and data retention
- **High concurrency** for multiple branch operations
- **Advanced querying capabilities** for reporting and analytics
- **JSON document storage** for flexible data structures
- **Data encryption** at rest and in transit
- **Disaster recovery** with point-in-time recovery
- **Horizontal scalability** for future growth

## Decision
We will use **PostgreSQL 14+** as the primary database system for all financial and operational data, with Redis for caching and session storage, and TimescaleDB for time-series data where appropriate.

### PostgreSQL Architecture

#### Database Cluster Design
```yaml
Primary Database: PostgreSQL 14+
High Availability: Streaming replication with hot standby
Backup Strategy: WAL archiving with point-in-time recovery
Connection Pooling: PgBouncer for connection management
Monitoring: pg_stat statements, auto_explain, log_min_duration_statement
```

#### Schema Design Principles

##### Database per Service Pattern
```sql
-- Core banking database
CREATE DATABASE sacco_core;

-- Analytics and reporting database  
CREATE DATABASE sacco_analytics;

-- Audit and logging database
CREATE DATABASE sacco_audit;
```

##### Schema Organization
```sql
-- Core banking schemas
CREATE SCHEMA IF NOT EXISTS membership;
CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS lending;
CREATE SCHEMA IF NOT EXISTS compliance;

-- Application schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS audit;
```

### Core Table Structure

#### Membership Schema
```sql
-- membership.members
CREATE TABLE membership.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_number VARCHAR(20) UNIQUE NOT NULL,
    national_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    occupation VARCHAR(100),
    monthly_income DECIMAL(15,2),
    
    -- KYC fields
    kyc_status VARCHAR(20) DEFAULT 'pending' 
        CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'expired')),
    kyc_verified_at TIMESTAMPTZ,
    kyc_verified_by UUID REFERENCES app.users(id),
    
    -- Compliance fields
    risk_rating VARCHAR(10) DEFAULT 'low' 
        CHECK (risk_rating IN ('low', 'medium', 'high')),
    pep_status BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Indexes
    CONSTRAINT valid_phone CHECK (phone ~ '^\+?[0-9\s\-\(\)]{10,}$')
);

CREATE INDEX idx_members_kyc_status ON membership.members(kyc_status);
CREATE INDEX idx_members_risk_rating ON membership.members(risk_rating);
CREATE INDEX idx_members_created_at ON membership.members(created_at);
```

#### Accounting Schema
```sql
-- accounting.accounts
CREATE TABLE accounting.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES membership.members(id),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(20) NOT NULL 
        CHECK (account_type IN ('savings', 'current', 'fixed_deposit', 'share_capital')),
    currency VARCHAR(3) DEFAULT 'KES',
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    available_balance DECIMAL(15,2) DEFAULT 0.00,
    ledger_balance DECIMAL(15,2) DEFAULT 0.00,
    
    -- Account status
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'dormant', 'frozen', 'closed')),
    
    -- Interest configuration
    interest_rate DECIMAL(5,4) DEFAULT 0.00,
    interest_calculation_method VARCHAR(20) DEFAULT 'daily_balance'
        CHECK (interest_calculation_method IN ('daily_balance', 'minimum_balance', 'average_balance')),
    
    -- Timestamps
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_balance CHECK (current_balance >= 0),
    CONSTRAINT available_balance_check CHECK (available_balance <= current_balance)
);

-- accounting.transactions
CREATE TABLE accounting.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_reference VARCHAR(50) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounting.accounts(id),
    
    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'fee', 'interest', 'dividend')),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    running_balance DECIMAL(15,2) NOT NULL,
    
    -- Party information
    counterparty_name VARCHAR(255),
    counterparty_account VARCHAR(50),
    counterparty_bank VARCHAR(100),
    
    -- Description and metadata
    description TEXT,
    metadata JSONB,
    
    -- Status and approval
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
    approved_by UUID REFERENCES app.users(id),
    approved_at TIMESTAMPTZ,
    
    -- Payment method
    payment_method VARCHAR(20)
        CHECK (payment_method IN ('cash', 'mpesa', 'bank_transfer', 'cheque', 'internal')),
    payment_reference VARCHAR(100),
    
    -- Timestamps with transaction time
    transaction_date DATE NOT NULL,
    value_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_amount CHECK (amount > 0),
    CONSTRAINT valid_dates CHECK (value_date >= transaction_date)
);

-- Partial index for frequent queries
CREATE INDEX idx_transactions_account_date 
ON accounting.transactions(account_id, transaction_date DESC) 
WHERE status = 'completed';

CREATE INDEX idx_transactions_reference 
ON accounting.transactions(transaction_reference);

CREATE INDEX idx_transactions_type_date 
ON accounting.transactions(transaction_type, transaction_date);
```

#### Lending Schema
```sql
-- lending.loans
CREATE TABLE lending.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_reference VARCHAR(50) UNIQUE NOT NULL,
    member_id UUID NOT NULL REFERENCES membership.members(id),
    account_id UUID NOT NULL REFERENCES accounting.accounts(id),
    
    -- Loan details
    loan_product_id UUID NOT NULL REFERENCES lending.loan_products(id),
    loan_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    loan_term_months INTEGER NOT NULL,
    disbursement_amount DECIMAL(15,2),
    
    -- Status and dates
    status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'approved', 'disbursed', 'active', 'closed', 'written_off')),
    application_date DATE NOT NULL,
    approval_date DATE,
    disbursement_date DATE,
    maturity_date DATE,
    closed_date DATE,
    
    -- Collateral and security
    collateral_value DECIMAL(15,2),
    security_details JSONB,
    
    -- Credit assessment
    credit_score INTEGER,
    risk_grade VARCHAR(5),
    loan_to_value_ratio DECIMAL(5,4),
    
    -- Regulatory fields
    provision_amount DECIMAL(15,2) DEFAULT 0.00,
    provision_rate DECIMAL(5,4) DEFAULT 0.00,
    non_performing_status BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_loan_amount CHECK (loan_amount > 0),
    CONSTRAINT valid_interest_rate CHECK (interest_rate >= 0 AND interest_rate <= 1),
    CONSTRAINT valid_loan_term CHECK (loan_term_months > 0 AND loan_term_months <= 360)
);

-- lending.repayment_schedules
CREATE TABLE lending.repayment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES lending.loans(id),
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    total_due DECIMAL(15,2) NOT NULL,
    
    -- Payment status
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
    paid_amount DECIMAL(15,2) DEFAULT 0.00,
    paid_date DATE,
    
    -- Late payment details
    days_late INTEGER DEFAULT 0,
    penalty_amount DECIMAL(15,2) DEFAULT 0.00,
    
    -- Constraints
    CONSTRAINT valid_installment CHECK (installment_number > 0),
    CONSTRAINT valid_amounts CHECK (total_due = principal_amount + interest_amount),
    CONSTRAINT valid_paid_amount CHECK (paid_amount <= total_due + penalty_amount),
    
    -- Unique constraint
    UNIQUE(loan_id, installment_number)
);

CREATE INDEX idx_repayment_due_date ON lending.repayment_schedules(due_date) 
WHERE status IN ('pending', 'overdue');

CREATE INDEX idx_repayment_loan_status ON lending.repayment_schedules(loan_id, status);
```

### Advanced PostgreSQL Features

#### JSONB for Flexible Data
```sql
-- compliance.kyc_documents
CREATE TABLE compliance.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES membership.members(id),
    document_type VARCHAR(50) NOT NULL,
    
    -- Document details in JSONB for flexibility
    document_data JSONB NOT NULL,
    
    -- File storage references
    file_path VARCHAR(500),
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    -- Verification status
    verification_status VARCHAR(20) DEFAULT 'pending',
    verified_by UUID REFERENCES app.users(id),
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create GIN index for JSONB queries
CREATE INDEX idx_kyc_documents_data ON compliance.kyc_documents USING GIN (document_data);
```

#### Row-Level Security (RLS)
```sql
-- Enable RLS on sensitive tables
ALTER TABLE membership.members ENABLE ROW LEVEL SECURITY;

-- Policy for branch-based access
CREATE POLICY branch_members_policy ON membership.members
    USING (branch_id = current_setting('app.current_branch_id')::UUID);

-- Policy for member self-access
CREATE POLICY member_self_policy ON membership.members
    FOR SELECT USING (id = current_setting('app.current_member_id')::UUID);
```

#### Partitioning for Large Tables
```sql
-- Partition transactions by month for better performance
CREATE TABLE accounting.transactions (
    -- ... columns ...
) PARTITION BY RANGE (transaction_date);

-- Create monthly partitions
CREATE TABLE accounting.transactions_2024_01 
    PARTITION OF accounting.transactions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE accounting.transactions_2024_02
    PARTITION OF accounting.transactions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### Data Integrity Features

#### Check Constraints
```sql
-- Ensure financial data integrity
ALTER TABLE accounting.accounts 
ADD CONSTRAINT valid_interest_rate 
CHECK (interest_rate >= 0 AND interest_rate <= 0.5); -- Max 50% interest

ALTER TABLE lending.loans
ADD CONSTRAINT valid_loan_to_value 
CHECK (loan_to_value_ratio >= 0 AND loan_to_value_ratio <= 5); -- Max 500% LTV
```

#### Foreign Key Constraints
```sql
-- Complex foreign key with deferrable constraints
ALTER TABLE accounting.transactions
ADD CONSTRAINT fk_transactions_account
FOREIGN KEY (account_id) 
REFERENCES accounting.accounts(id)
ON DELETE RESTRICT
DEFERRABLE INITIALLY DEFERRED;
```

#### Triggers for Audit Trail
```sql
-- Automatic audit trail
CREATE TABLE audit.member_changes (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES app.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION audit_member_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit.member_changes (table_name, record_id, operation, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.member_changes (table_name, record_id, operation, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit.member_changes (table_name, record_id, operation, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_member_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON membership.members
    FOR EACH ROW EXECUTE FUNCTION audit_member_changes();
```

### Performance Optimization

#### Indexing Strategy
```sql
-- B-tree for equality and range queries
CREATE INDEX idx_members_email ON membership.members(email);
CREATE INDEX idx_members_phone ON membership.members(phone);
CREATE INDEX idx_transactions_date ON accounting.transactions(transaction_date DESC);

-- Partial indexes for common queries
CREATE INDEX idx_active_loans ON lending.loans(status) 
WHERE status IN ('active', 'disbursed');

CREATE INDEX idx_pending_transactions ON accounting.transactions(created_at) 
WHERE status = 'pending';

-- Composite indexes
CREATE INDEX idx_member_accounts ON accounting.accounts(member_id, status, account_type);
CREATE INDEX idx_loan_repayments ON lending.repayment_schedules(loan_id, due_date, status);
```

#### Materialized Views for Reporting
```sql
-- Daily balances materialized view
CREATE MATERIALIZED VIEW accounting.daily_balances AS
SELECT 
    account_id,
    transaction_date,
    LAST_VALUE(running_balance) OVER (
        PARTITION BY account_id, transaction_date 
        ORDER BY created_at 
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as closing_balance
FROM accounting.transactions
WHERE status = 'completed'
GROUP BY account_id, transaction_date;

CREATE UNIQUE INDEX idx_daily_balances_unique 
ON accounting.daily_balances(account_id, transaction_date);

-- Refresh strategy
REFRESH MATERIALIZED VIEW CONCURRENTLY accounting.daily_balances;
```

### Backup and Recovery Strategy

#### WAL Archiving Configuration
```bash
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
max_wal_senders = 10
wal_keep_size = 1024
```

#### Point-in-Time Recovery
```sql
-- Base backup
pg_basebackup -D /var/lib/postgresql/backups/base -Ft -z

-- Recovery configuration
-- recovery.conf
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_time = '2024-01-15 14:30:00 UTC'
```

### Monitoring and Maintenance

#### Key Metrics Monitoring
```sql
-- Query performance analysis
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Table bloat analysis
SELECT
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    round(n_dead_tup::numeric / (n_live_tup + n_dead_tup) * 100, 2) as dead_tuple_percent
FROM pg_stat_user_tables
WHERE n_live_tup + n_dead_tup > 1000
ORDER BY dead_tuple_percent DESC;
```

#### Automated Maintenance
```sql
-- Regular vacuum and analyze
VACUUM (ANALYZE, VERBOSE) membership.members;

-- Index maintenance
REINDEX INDEX CONCURRENTLY idx_transactions_account_date;

-- Statistics update
ANALYZE accounting.transactions;
```

## Consequences

### Positive Outcomes
- **ACID Compliance**: Full transaction integrity for financial operations
- **Advanced Features**: JSONB, RLS, partitioning, and materialized views
- **Performance**: Excellent query performance with proper indexing
- **Data Integrity**: Strong constraints and validation rules
- **Scalability**: Read replicas and connection pooling
- **Ecosystem**: Rich tooling and extensive community support

### Negative Outcomes
- **Operational Complexity**: Requires skilled PostgreSQL administration
- **Memory Intensive**: Tuning required for optimal performance
- **Vertical Scaling**: Primarily scales vertically, though horizontal options exist
- **Backup Size**: WAL archiving can consume significant storage

### Risks and Mitigations
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Data Corruption** | High | Low | WAL archiving, regular backups, checksum verification |
| **Performance Degradation** | Medium | Medium | Query monitoring, index optimization, regular maintenance |
| **Storage Exhaustion** | Medium | Medium | Monitoring, partitioning, archiving strategy |
| **Security Breach** | High | Low | RLS, encryption, regular security audits |

## Migration Strategy

### Phase 1: Schema Design (Month 1)
```yaml
Objectives:
  - Complete database schema design
  - Migration scripts from existing systems
  - Development environment setup
  - Basic backup and recovery procedures

Deliverables:
  ✅ Normalized schema for all domains
  ✅ Data migration validation scripts
  ✅ Development PostgreSQL instances
  ✅ Automated backup procedures
```

### Phase 2: Performance Optimization (Month 2-3)
```yaml
Objectives:
  - Indexing strategy implementation
  - Query performance tuning
  - Connection pooling setup
  - Monitoring and alerting

Deliverables:
  ✅ Comprehensive index coverage
  ✅ Query performance benchmarks
  ✅ PgBouncer configuration
  ✅ Real-time monitoring dashboards
```

### Phase 3: High Availability (Month 4)
```yaml
Objectives:
  - Streaming replication setup
  - Failover procedures
  - Disaster recovery testing
  - Production hardening

Deliverables:
  ✅ Hot standby replicas
  ✅ Automated failover procedures
  ✅ DR testing completion
  ✅ Production deployment
```

## Alternatives Considered

### Alternative 1: MySQL
**Pros**: Wider adoption, simpler replication, known quantity  
**Cons**: Weaker constraints, limited JSON support, weaker analytical capabilities  
**Decision**: Rejected due to superior data integrity features in PostgreSQL

### Alternative 2: Oracle Database
**Pros**: Enterprise features, strong financial industry adoption  
**Cons**: High licensing costs, vendor lock-in, complexity  
**Decision**: Rejected due to cost and open-source philosophy

### Alternative 3: MongoDB
**Pros**: Horizontal scaling, flexible schema, JSON native  
**Cons**: Weaker ACID compliance, eventual consistency, relational model mismatch  
**Decision**: Rejected due to financial transaction ACID requirements

### Alternative 4: CockroachDB
**Pros**: Horizontal scaling, PostgreSQL compatibility, strong consistency  
**Cons**: Newer technology, operational complexity, smaller ecosystem  
**Decision**: Rejected due to maturity concerns for financial systems

## Compliance and Security

### Data Protection
```yaml
Encryption:
  - TDE (Transparent Data Encryption) for data at rest
  - SSL/TLS for data in transit
  - Column-level encryption for sensitive fields
  - Key management with HashiCorp Vault

Access Controls:
  - Role-based database access
  - Row-level security for data segregation
  - Audit logging for all access
  - Regular access reviews
```

### Regulatory Compliance
```yaml
Data Retention:
  - 7-year transaction history retention
  - Automated archiving procedures
  - Compliance reporting capabilities
  - Audit trail immutability

Financial Regulations:
  - SASRA reporting data structures
  - CBK compliance monitoring
  - IFRS9 provisioning calculations
 
