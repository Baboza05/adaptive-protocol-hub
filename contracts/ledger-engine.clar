;; Ledger Engine Contract
;; Financial operations and payment flow orchestration
;;
;; Comprehensive payment processing system for the Adaptive Protocol Hub.
;; Handles transaction execution, approval workflows, service directory
;; management, and maintains complete payment history ledger.

;; Error codes with varied naming patterns
(define-constant error-not-authorized (err u100))
(define-constant fail-invalid-subscription-id (err u101))
(define-constant fail-payment-processing (err u102))
(define-constant error-insufficient-balance (err u103))
(define-constant fail-threshold-exceeded (err u104))
(define-constant error-needs-review (err u105))
(define-constant fail-already-completed (err u106))
(define-constant error-bad-token-contract (err u107))
(define-constant fail-bad-amount-value (err u108))
(define-constant error-not-yet-due (err u109))
(define-constant fail-auto-payments-inactive (err u110))
(define-constant error-bad-config-param (err u111))

;; Configuration constants
(define-constant hub-operator tx-sender)
(define-constant payment-unit-scale u1000000)

;; Transaction ledger storage
(define-map transaction-records
  {
    txn-id: uint,
    svc-id: uint,
  }
  {
    from-principal: principal,
    to-principal: principal,
    txn-amount: uint,
    token-addr: (optional principal),
    block-recorded: uint,
    completion-status: (string-ascii 20),
  }
)

;; User payment configuration settings
(define-map payment-config-settings
  { account-principal: principal }
  {
    auto-enabled: bool,
    threshold-limit: uint,
    approval-on-exceed: bool,
  }
)

;; Approval request queue
(define-map approval-requests
  {
    svc-id: uint,
    txn-id: uint,
  }
  {
    requester-principal: principal,
    request-amount: uint,
    due-at-block: uint,
    has-approval: bool,
  }
)

;; Service provider registry
(define-map service-registry
  { service-key: uint }
  {
    service-title: (string-ascii 64),
    operator-principal: principal,
    is-active: bool,
  }
)

;; Active subscription agreements
(define-map subscription-records
  { subscription-key: uint }
  {
    operator-service-id: uint,
    client-principal: principal,
    recipient-principal: principal,
    payable-amount: uint,
    interval-blocks: uint,
    next-payment-block: uint,
    count-payments: uint,
    token-addr: (optional principal),
  }
)

;; ID generators
(define-data-var next-txn-id uint u1)
(define-data-var next-subscription-record-id uint u1)
(define-data-var next-service-register-id uint u1)

;; Internal: Generate unique transaction identifier
(define-private (mint-transaction-id)
  (let ((current (var-get next-txn-id)))
    (var-set next-txn-id (+ current u1))
    current
  )
)

;; Internal: Generate unique subscription record identifier
(define-private (mint-subscription-record-id)
  (let ((current (var-get next-subscription-record-id)))
    (var-set next-subscription-record-id (+ current u1))
    current
  )
)

;; Internal: Generate unique service registration identifier
(define-private (mint-service-register-id)
  (let ((current (var-get next-service-register-id)))
    (var-set next-service-register-id (+ current u1))
    current
  )
)

;; Internal: Execute STX transfer
(define-private (xfer-stx
    (destination principal)
    (amount uint)
  )
  (if (>= (stx-get-balance tx-sender) amount)
    (stx-transfer? amount tx-sender destination)
    error-insufficient-balance
  )
)

;; Internal: Evaluate payment against configured limits
(define-private (evaluate-threshold
    (account principal)
    (amount uint)
  )
  (let ((config (default-to {
      auto-enabled: false,
      threshold-limit: u0,
      approval-on-exceed: true,
    }
      (map-get? payment-config-settings { account-principal: account })
    )))
    (if (> amount (get threshold-limit config))
      (if (get approval-on-exceed config)
        error-needs-review
        (ok true)
      )
      (ok true)
    )
  )
)

;; Internal: Validate payment is due
(define-private (check-payment-is-due (subscription-key uint))
  (match (map-get? subscription-records { subscription-key: subscription-key })
    rec (if (>= block-height (get next-payment-block rec))
      (ok true)
      error-not-yet-due
    )
    fail-invalid-subscription-id
  )
)

;; Internal: Advance subscription to next payment cycle
(define-private (advance-subscription-cycle (subscription-key uint))
  (match (map-get? subscription-records { subscription-key: subscription-key })
    rec (begin
      (map-set subscription-records { subscription-key: subscription-key }
        (merge rec {
          next-payment-block: (+ (get next-payment-block rec)
            (get interval-blocks rec)
          ),
          count-payments: (+ (get count-payments rec) u1),
        })
      )
      (ok true)
    )
    fail-invalid-subscription-id
  )
)

;; Internal: Write transaction to ledger
(define-private (write-transaction-record
    (subscription-key uint)
    (status (string-ascii 20))
  )
  (let (
      (txn-id (mint-transaction-id))
      (rec (unwrap!
        (map-get? subscription-records { subscription-key: subscription-key })
        fail-invalid-subscription-id
      ))
    )
    (map-set transaction-records {
      txn-id: txn-id,
      svc-id: subscription-key,
    } {
      from-principal: (get client-principal rec),
      to-principal: (get recipient-principal rec),
      txn-amount: (get payable-amount rec),
      token-addr: (get token-addr rec),
      block-recorded: block-height,
      completion-status: status,
    })
    (ok txn-id)
  )
)

;; Read-only: Query payment settings
(define-read-only (fetch-payment-settings (account principal))
  (default-to {
    auto-enabled: false,
    threshold-limit: u0,
    approval-on-exceed: true,
  }
    (map-get? payment-config-settings { account-principal: account })
  )
)

;; Read-only: Get transaction details
(define-read-only (read-transaction
    (txn-id uint)
    (subscription-key uint)
  )
  (map-get? transaction-records {
    txn-id: txn-id,
    svc-id: subscription-key,
  })
)

;; Read-only: Query subscription data
(define-read-only (fetch-subscription-info (subscription-key uint))
  (map-get? subscription-records { subscription-key: subscription-key })
)

;; Read-only: Query service info
(define-read-only (fetch-service-info (service-key uint))
  (map-get? service-registry { service-key: service-key })
)

;; Read-only: Check if approval needed
(define-read-only (approval-required (subscription-key uint))
  (match (map-get? subscription-records { subscription-key: subscription-key })
    rec (let (
        (cfg (fetch-payment-settings (get client-principal rec)))
        (amt (get payable-amount rec))
      )
      (and
        (get auto-enabled cfg)
        (> amt (get threshold-limit cfg))
        (get approval-on-exceed cfg)
      )
    )
    false
  )
)

;; Read-only: Fetch approval details
(define-read-only (read-approval-status
    (subscription-key uint)
    (txn-id uint)
  )
  (map-get? approval-requests {
    svc-id: subscription-key,
    txn-id: txn-id,
  })
)

;; Public: Register service in directory
(define-public (register-service-provider (service-title (string-ascii 64)))
  (let ((service-key (mint-service-register-id)))
    (map-set service-registry { service-key: service-key } {
      service-title: service-title,
      operator-principal: tx-sender,
      is-active: true,
    })
    (ok service-key)
  )
)

;; Public: Create subscription agreement
(define-public (establish-subscription
    (service-key uint)
    (recipient-principal principal)
    (payable-amount uint)
    (interval-blocks uint)
    (token-addr (optional principal))
  )
  (let (
      (subscription-key (mint-subscription-record-id))
      (service (default-to {
        service-title: "",
        operator-principal: tx-sender,
        is-active: false,
      }
        (map-get? service-registry { service-key: service-key })
      ))
    )
    (asserts! (get is-active service) fail-invalid-subscription-id)
    (asserts! (> payable-amount u0) fail-bad-amount-value)
    (asserts! (> interval-blocks u0) error-bad-config-param)
    
    (map-set subscription-records { subscription-key: subscription-key } {
      operator-service-id: service-key,
      client-principal: tx-sender,
      recipient-principal: recipient-principal,
      payable-amount: payable-amount,
      interval-blocks: interval-blocks,
      next-payment-block: (+ block-height interval-blocks),
      count-payments: u0,
      token-addr: token-addr,
    })
    (ok subscription-key)
  )
)

;; Public: Configure payment approval thresholds
(define-public (configure-payment-thresholds
    (auto-enabled bool)
    (threshold-limit uint)
    (approval-on-exceed bool)
  )
  (begin
    (map-set payment-config-settings { account-principal: tx-sender } {
      auto-enabled: auto-enabled,
      threshold-limit: threshold-limit,
      approval-on-exceed: approval-on-exceed,
    })
    (ok true)
  )
)

;; Public: Request approval for high-value payment
(define-public (request-approval (subscription-key uint))
  (let (
      (rec (unwrap!
        (map-get? subscription-records { subscription-key: subscription-key })
        fail-invalid-subscription-id
      ))
      (requester-principal (get client-principal rec))
      (txn-id (mint-transaction-id))
    )
    (asserts! (approval-required subscription-key) error-needs-review)
    
    (map-set approval-requests {
      svc-id: subscription-key,
      txn-id: txn-id,
    } {
      requester-principal: requester-principal,
      request-amount: (get payable-amount rec),
      due-at-block: (get next-payment-block rec),
      has-approval: false,
    })
    (ok txn-id)
  )
)

;; Public: Cancel subscription agreement
(define-public (cancel-subscription-record (subscription-key uint))
  (let ((rec (unwrap! (map-get? subscription-records { subscription-key: subscription-key })
      fail-invalid-subscription-id
    )))
    (asserts! (is-eq tx-sender (get client-principal rec)) error-not-authorized)
    
    (map-delete subscription-records { subscription-key: subscription-key })
    (ok true)
  )
)

;; Public: Update subscription payment amount
(define-public (adjust-payment-amount
    (subscription-key uint)
    (new-amount uint)
  )
  (let ((rec (unwrap! (map-get? subscription-records { subscription-key: subscription-key })
      fail-invalid-subscription-id
    )))
    (asserts! (is-eq tx-sender (get client-principal rec)) error-not-authorized)
    (asserts! (> new-amount u0) fail-bad-amount-value)
    
    (map-set subscription-records { subscription-key: subscription-key }
      (merge rec { payable-amount: new-amount })
    )
    (ok true)
  )
)

;; Public: Update subscription payment interval
(define-public (adjust-payment-interval
    (subscription-key uint)
    (new-interval-blocks uint)
  )
  (let ((rec (unwrap! (map-get? subscription-records { subscription-key: subscription-key })
      fail-invalid-subscription-id
    )))
    (asserts! (is-eq tx-sender (get client-principal rec)) error-not-authorized)
    (asserts! (> new-interval-blocks u0) error-bad-config-param)
    
    (map-set subscription-records { subscription-key: subscription-key }
      (merge rec {
        interval-blocks: new-interval-blocks,
        next-payment-block: (+ block-height new-interval-blocks),
      })
    )
    (ok true)
  )
)

;; Public: Execute payment transaction
(define-public (initiate-payment (subscription-key uint))
  (let ((rec (unwrap! (map-get? subscription-records { subscription-key: subscription-key })
      fail-invalid-subscription-id
    )))
    (asserts! (is-eq tx-sender (get client-principal rec)) error-not-authorized)
    (asserts! (>= block-height (get next-payment-block rec)) error-not-yet-due)
    
    (let ((xfer-result (xfer-stx (get recipient-principal rec) (get payable-amount rec))))
      (if (is-ok xfer-result)
        (begin
          (unwrap! (write-transaction-record subscription-key "completed") fail-payment-processing)
          (unwrap! (advance-subscription-cycle subscription-key) fail-payment-processing)
          (ok subscription-key)
        )
        (begin
          (unwrap! (write-transaction-record subscription-key "failed") fail-payment-processing)
          (ok subscription-key)
        )
      )
    )
  )
)
