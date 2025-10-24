# Adaptive Protocol Hub

A sophisticated multi-contract blockchain framework designed for managing dynamic subscription ecosystems with intelligent payment orchestration and comprehensive behavioral analytics.

## What It Does

Adaptive Protocol Hub empowers users and service providers to implement advanced subscription management on the Stacks blockchain. The system intelligently orchestrates recurring payments, tracks spending patterns across multiple service categories, and delivers actionable insights for optimizing subscription portfolios.

## Key Capabilities

- **Intelligent Subscription Orchestration**: Register, modify, and manage recurring service agreements
- **Flexible Payment Infrastructure**: Automated payment processing with configurable thresholds and approval workflows
- **Behavioral Analytics Engine**: Track spending trends, identify usage patterns, and generate optimization opportunities
- **Multi-Token Support**: Process payments in both STX and other fungible tokens
- **Comprehensive Audit Trail**: Immutable historical records of all transactions and state changes
- **Dynamic Budget Management**: Set spending limits per category with real-time enforcement

## Architecture Overview

The system comprises three specialized contracts that work in concert:

### 1. Orchestrator Core (`orchestrator-core.clar`)
The foundational contract responsible for subscription lifecycle management. It maintains complete registry of all active subscriptions with their configuration parameters and state. Supports flexible billing cycles and comprehensive status tracking across all subscription instances.

**Key Responsibilities:**
- Subscription creation and termination
- Billing cycle management (daily, monthly, quarterly, yearly)
- Status transitions (active, suspended, terminated)
- Complete audit history for all modifications

### 2. Ledger Engine (`ledger-engine.clar`)
Manages all financial operations and payment workflows. Implements sophisticated payment processing logic with adaptive approval mechanisms based on user-defined thresholds and risk parameters.

**Key Responsibilities:**
- Execute manual and automated payments
- Implement configurable threshold-based approval workflows
- Track payment history and service registrations
- Support multiple token types for payments

### 3. Insight Aggregator (`insight-aggregator.clar`)
Analyzes spending data and subscription patterns to surface optimization opportunities. Generates intelligence reports based on historical behavior and provides recommendations for cost management.

**Key Responsibilities:**
- Calculate aggregated spending metrics
- Analyze category-based expenditure patterns
- Identify renewal timings and usage trends
- Generate cost optimization suggestions

## Quick Start

### 1. Deploy the Contracts
Deploy in the following sequence:
```bash
clarity check contracts/orchestrator-core.clar
clarity check contracts/ledger-engine.clar
clarity check contracts/insight-aggregator.clar
```

### 2. Initialize Payment Configuration
```clarity
(contract-call? 
  ledger-engine 
  configure-payment-thresholds 
  true 
  u5000000 
  true)
```

### 3. Register Your First Subscription
```clarity
(contract-call? 
  orchestrator-core 
  enroll-subscription 
  "Premium Service"
  u9999000
  u30
  (+ block-height u288))
```

### 4. Process a Payment
```clarity
(contract-call? 
  ledger-engine 
  initiate-payment 
  u0)
```

## Function Reference

### Subscription Management

#### `enroll-subscription`
Register a new recurring service subscription.
- **Parameters**: service identifier, payment amount (microSTX), cycle length (days), next due date
- **Returns**: subscription identifier
- **Authorization**: All users

#### `modify-subscription`
Update an existing subscription's configuration.
- **Parameters**: subscription ID, updated service name, amount, cycle, due date
- **Returns**: success confirmation
- **Authorization**: Subscription owner

#### `change-status`
Modify subscription lifecycle state.
- **Parameters**: subscription ID, new status code
- **Returns**: success confirmation
- **Authorization**: Subscription owner

### Payment Operations

#### `initiate-payment`
Execute a payment for a subscription.
- **Parameters**: subscription ID
- **Returns**: payment record
- **Authorization**: Subscription owner

#### `configure-payment-thresholds`
Set up automatic payment rules and approval requirements.
- **Parameters**: enabled flag, threshold amount, approval requirement
- **Returns**: success confirmation
- **Authorization**: Individual users

#### `request-approval`
Request approval for payments above configured thresholds.
- **Parameters**: subscription ID
- **Returns**: approval request ID
- **Authorization**: Subscription owner

### Analytics & Insights

#### `fetch-spending-report`
Retrieve detailed spending analysis for specified period.
- **Parameters**: user principal, category filter
- **Returns**: spending breakdown with trends

#### `identify-opportunities`
Generate optimization suggestions based on subscription portfolio.
- **Returns**: list of recommendations with estimated savings

#### `retrieve-usage-metrics`
Get historical usage and spending patterns.
- **Parameters**: subscription ID
- **Returns**: usage frequency, spending history, trend data

## Technical Architecture

### Data Structures

**Subscription Registry**: Maintains subscription records with owner, payment amounts, cycle lengths, and status information. Indexed by owner and subscription ID.

**Payment Ledger**: Complete payment history indexed by payment ID and subscription. Includes payer, recipient, amount, token type, timestamp, and status.

**Approval Queue**: Pending payment approvals for transactions exceeding configured thresholds. Maintains approval status and due dates.

**Service Directory**: Registry of subscription service providers with activation status.

**Analytics Archive**: Historical spending data organized by user and category for trend analysis.

### Constants & Limits

- **Billing Cycles**: 30 (monthly), 90 (quarterly), 182 (biannual), 365 (annual) days
- **Payment Precision**: 6 decimal places (1 microSTX units)
- **Status Codes**: Active (1), Suspended (2), Terminated (3)
- **Max Subscriptions per User**: 100
- **Max Payment History per Subscription**: 100 entries
- **Max Status Changes per Subscription**: 50 entries

## Security Architecture

- **Access Control**: All subscription modifications require caller authorization
- **Threshold Enforcement**: Payment thresholds prevent unauthorized large transactions
- **Approval Workflows**: Multi-step processes for critical operations exceeding limits
- **Immutable Records**: Historical data preserved for complete audit trail
- **State Validation**: Comprehensive input validation on all contract calls
- **Principal-based Isolation**: Users can only access their own subscription data

## Error Handling

The contracts implement standardized error codes for all failure conditions:

- **u100**: Authorization failure
- **u101**: Subscription not found
- **u102**: Payment processing error
- **u103**: Insufficient funds
- **u104**: Amount exceeds threshold
- **u105**: Approval required
- **u106**: Payment already processed
- **u107**: Invalid token contract
- **u108**: Invalid payment amount
- **u109**: Payment not yet due
- **u110**: Auto-payment disabled
- **u111**: Invalid parameter

## Roadmap & Future Enhancements

- Advanced machine learning for spending predictions
- Integration with DeFi protocols for token swaps
- Cross-contract payment batching for efficiency
- Enhanced analytics dashboard
- Peer subscription sharing protocols
- Governance mechanisms for service providers

## License

MIT License. See LICENSE file for full details.

## Contributing

Contributions welcome. Please follow Clarity code standards and include comprehensive tests for all new functionality.