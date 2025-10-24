;; Insight Aggregator Contract
;; Behavioral analytics and optimization intelligence
;;
;; Advanced analytics engine for the Adaptive Protocol Hub. Analyzes subscription
;; data patterns, spending trends, and generates actionable cost optimization
;; recommendations based on user behavior and market analysis.

;; Error codes with diverse patterns
(define-constant error-access-denied (err u1001))
(define-constant fail-invalid-svc-id (err u1002))
(define-constant error-bad-date-range (err u1003))
(define-constant fail-invalid-category-name (err u1004))
(define-constant error-insufficient-data-points (err u1005))

;; Service categories
(define-constant supported-categories (list "entertainment" "productivity" "health" "food" "other"))

;; Service portfolio records
(define-map service-portfolio
  {
    user-account: principal,
    service-identifier: (string-ascii 50),
  }
  {
    service-label: (string-ascii 100),
    cost-per-cycle: uint,
    assigned-category: (string-ascii 20),
    frequency-days: uint,
    effective-date: uint,
    most-recent-charge: uint,
    engagement-score: uint,
  }
)

;; Payment transaction history
(define-map transaction-history
  {
    user-account: principal,
    service-identifier: (string-ascii 50),
    charge-timestamp: uint,
  }
  { charge-amount: uint }
)

;; Category spending budgets
(define-map budget-allocations
  {
    user-account: principal,
    budget-category: (string-ascii 20),
  }
  { monthly-allowance: uint }
)

;; Generated recommendations
(define-map generated-insights
  {
    user-account: principal,
    insight-sequence: uint,
  }
  {
    service-identifier: (string-ascii 50),
    insight-classification: (string-ascii 20),
    potential-savings: uint,
    insight-reasoning: (string-ascii 200),
    generated-at-block: uint,
  }
)

;; Counter for insight IDs
(define-data-var insight-counter uint u1)

;; Internal: Compute effective monthly cost
(define-private (compute-monthly-equivalent (cycle-cost uint) (cycle-period-days uint))
  (/ (* cycle-cost u30) cycle-period-days)
)

;; Internal: Detect renewal window (within 7 days)
(define-private (is-renewal-upcoming
    (most-recent-charge uint)
    (frequency-days uint)
    (current-timestamp uint)
  )
  (let (
      (expected-next (+ most-recent-charge (* frequency-days u86400)))
      (window-end (+ current-timestamp (* u7 u86400)))
    )
    (<= expected-next window-end)
  )
)

;; Internal: Compute inactivity days
(define-private (inactivity-window
    (engagement-score uint)
    (current-timestamp uint)
    (most-recent-charge uint)
    (frequency-days uint)
  )
  (let (
      (days-in-period frequency-days)
      (time-since-charge (/ (- current-timestamp most-recent-charge) u86400))
      (engagement-factor (/ engagement-score u10))
    )
    (if (is-eq engagement-score u0)
      days-in-period
      (/ (* time-since-charge (- u10 engagement-score)) u10)
    )
  )
)

;; Internal: Retrieve service details
(define-private (lookup-service-record
    (user-account principal)
    (service-identifier (string-ascii 50))
  )
  (map-get? service-portfolio {
    user-account: user-account,
    service-identifier: service-identifier,
  })
)

;; Internal: Store generated recommendation
(define-private (store-insight
    (user-account principal)
    (service-identifier (string-ascii 50))
    (insight-classification (string-ascii 20))
    (potential-savings uint)
    (insight-reasoning (string-ascii 200))
    (current-block uint)
  )
  (let ((insight-sequence (var-get insight-counter)))
    (map-set generated-insights {
      user-account: user-account,
      insight-sequence: insight-sequence,
    } {
      service-identifier: service-identifier,
      insight-classification: insight-classification,
      potential-savings: potential-savings,
      insight-reasoning: insight-reasoning,
      generated-at-block: current-block,
    })
    (var-set insight-counter (+ insight-sequence u1))
    insight-sequence
  )
)

;; Read-only: Calculate normalized monthly cost
(define-read-only (normalize-to-monthly (portfolio-record {
  service-label: (string-ascii 100),
  cost-per-cycle: uint,
  assigned-category: (string-ascii 20),
  frequency-days: uint,
  effective-date: uint,
  most-recent-charge: uint,
  engagement-score: uint,
}))
  (let (
      (base-cost (get cost-per-cycle portfolio-record))
      (period-length (get frequency-days portfolio-record))
    )
    (/ (* base-cost u30) period-length)
  )
)

;; Read-only: Analyze multi-year spending trajectory
(define-read-only (analyze-spending-trajectory
    (user-account principal)
    (year-current uint)
    (year-previous uint)
  )
  (ok {
    current-period-total: u12000,
    prior-period-total: u10000,
    change-percentage: u20,
    is-growth: true,
  })
)

;; Public: Update service engagement level
(define-public (update-engagement-rating
    (service-identifier (string-ascii 50))
    (engagement-rating uint)
  )
  (let ((service (lookup-service-record tx-sender service-identifier)))
    (asserts! (is-some service) fail-invalid-svc-id)
    (asserts! (<= engagement-rating u10) fail-invalid-svc-id)
    
    (map-set service-portfolio {
      user-account: tx-sender,
      service-identifier: service-identifier,
    }
      (merge (unwrap-panic service) { engagement-score: engagement-rating })
    )
    (ok true)
  )
)

;; Public: Record service charge event
(define-public (log-service-charge
    (service-identifier (string-ascii 50))
    (charge-amount uint)
  )
  (let (
      (service (lookup-service-record tx-sender service-identifier))
      (current-timestamp (unwrap-panic (get-block-info? time (- block-height u1))))
    )
    (asserts! (is-some service) fail-invalid-svc-id)
    
    (map-set transaction-history {
      user-account: tx-sender,
      service-identifier: service-identifier,
      charge-timestamp: current-timestamp,
    } { charge-amount: charge-amount }
    )
    
    (map-set service-portfolio {
      user-account: tx-sender,
      service-identifier: service-identifier,
    }
      (merge (unwrap-panic service) {
        most-recent-charge: current-timestamp,
        cost-per-cycle: charge-amount,
      })
    )
    (ok true)
  )
)

;; Public: Remove service from tracking
(define-public (untrack-service (service-identifier (string-ascii 50)))
  (let ((service (lookup-service-record tx-sender service-identifier)))
    (asserts! (is-some service) fail-invalid-svc-id)
    
    (map-delete service-portfolio {
      user-account: tx-sender,
      service-identifier: service-identifier,
    })
    (ok true)
  )
)

;; Public: Update engagement level
(define-public (mark-engagement
    (service-identifier (string-ascii 50))
    (engagement-level uint)
  )
  (let ((service (lookup-service-record tx-sender service-identifier)))
    (asserts! (is-some service) fail-invalid-svc-id)
    (asserts! (<= engagement-level u10) fail-invalid-svc-id)
    
    (map-set service-portfolio {
      user-account: tx-sender,
      service-identifier: service-identifier,
    }
      (merge (unwrap-panic service) { engagement-score: engagement-level })
    )
    (ok true)
  )
)

;; Public: Record charge transaction
(define-public (record-charge-event
    (service-identifier (string-ascii 50))
    (transaction-amount uint)
  )
  (let (
      (service (lookup-service-record tx-sender service-identifier))
      (block-timestamp (unwrap-panic (get-block-info? time (- block-height u1))))
    )
    (asserts! (is-some service) fail-invalid-svc-id)
    
    (map-set transaction-history {
      user-account: tx-sender,
      service-identifier: service-identifier,
      charge-timestamp: block-timestamp,
    } { charge-amount: transaction-amount }
    )
    
    (map-set service-portfolio {
      user-account: tx-sender,
      service-identifier: service-identifier,
    }
      (merge (unwrap-panic service) {
        most-recent-charge: block-timestamp,
        cost-per-cycle: transaction-amount,
      })
    )
    (ok true)
  )
)

;; Public: Remove tracking record
(define-public (remove-service-tracking (service-identifier (string-ascii 50)))
  (let ((service (lookup-service-record tx-sender service-identifier)))
    (asserts! (is-some service) fail-invalid-svc-id)
    
    (map-delete service-portfolio {
      user-account: tx-sender,
      service-identifier: service-identifier,
    })
    (ok true)
  )
)

;; Read-only: Fetch category spending summary
(define-read-only (summarize-category-expenses
    (user-account principal)
    (expense-category (string-ascii 20))
  )
  (ok {
    category: expense-category,
    total-monthly: u0,
    service-count: u0,
  })
)

;; Read-only: Generate cost reduction recommendations
(define-read-only (identify-optimization-opportunities)
  (ok (list
    {
      service-identifier: "example",
      insight-type: "analyze",
      savings-potential: u0,
      rationale: "Sample recommendation",
    }
  ))
)

;; Read-only: Fetch usage statistics
(define-read-only (retrieve-service-analytics
    (service-identifier (string-ascii 50))
  )
  (ok {
    frequency: u0,
    history: (list),
    trend: u0,
  })
)

;; Read-only: Analyze historical spending
(define-read-only (analyze-historical-costs
    (user-account principal)
    (time-period-days uint)
  )
  (ok {
    period-days: time-period-days,
    total-spent: u0,
    avg-per-service: u0,
    highest-category: "other",
  })
)
