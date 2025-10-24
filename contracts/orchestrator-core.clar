;; Orchestrator Core Contract
;; Foundation for adaptive subscription lifecycle management
;;
;; This contract provides comprehensive subscription registry and lifecycle
;; management capabilities for the Adaptive Protocol Hub. Enables users to
;; establish, maintain, and track recurring service agreements with full
;; audit history and status tracking.

;; Error constants with diverse naming
(define-constant fail-unauthorized (err u100))
(define-constant error-subscription-missing (err u101))
(define-constant fail-bad-cycle-value (err u102))
(define-constant error-invalid-payment-sum (err u103))
(define-constant fail-date-validation (err u104))
(define-constant fail-subscription-exists (err u105))
(define-constant error-bad-status-transition (err u106))

;; Billing period definitions (in days)
(define-constant cycle-30day u30)
(define-constant cycle-quarterly u90)
(define-constant cycle-semi-annual u182)
(define-constant cycle-yearly u365)

;; Subscription lifecycle states
(define-constant state-live u1)
(define-constant state-suspended u2)
(define-constant state-terminated u3)

;; Subscription registry indexed by owner and subscription identifier
(define-map subscriptions-registry
  {
    principal-owner: principal,
    svc-id: uint,
  }
  {
    svc-description: (string-ascii 100),
    payment-sum: uint,
    period-days: uint,
    payment-deadline: uint,
    current-state: uint,
    registered-at: uint,
  }
)

;; User's subscription ID listing
(define-map account-subscriptions
  { principal-owner: principal }
  { svc-ids: (list 100 uint) }
)

;; Payment transaction archive
(define-map txn-archive
  {
    principal-owner: principal,
    svc-id: uint,
  }
  { txn-records: (list 100 {
    txn-timestamp: uint,
    txn-sum: uint,
  }) }
)

;; State transition history
(define-map state-transitions
  {
    principal-owner: principal,
    svc-id: uint,
  }
  { state-changes: (list 50 {
    changed-at: uint,
    new-state: uint,
  }) }
)

;; Global sequence counter for subscription IDs
(define-data-var id-sequence uint u0)

;; Internal: Generate unique subscription identifier
(define-private (acquire-subscription-id)
  (let ((current (var-get id-sequence)))
    (begin
      (var-set id-sequence (+ current u1))
      current
    )
  )
)

;; Internal: Check if subscription record exists
(define-private (subscription-present
    (owner principal)
    (sid uint)
  )
  (is-some (map-get? subscriptions-registry {
    principal-owner: owner,
    svc-id: sid,
  }))
)

;; Internal: Append subscription to user's collection
(define-private (add-sub-to-collection
    (owner principal)
    (sid uint)
  )
  (let ((current-subs (default-to { svc-ids: (list) }
      (map-get? account-subscriptions { principal-owner: owner })
    )))
    (map-set account-subscriptions { principal-owner: owner } 
      { svc-ids: (unwrap-panic (as-max-len? (append (get svc-ids current-subs) sid) u100)) }
    )
  )
)

;; Internal: Validate subscription period is supported
(define-private (validate-period (period uint))
  (or
    (is-eq period cycle-30day)
    (is-eq period cycle-quarterly)
    (is-eq period cycle-semi-annual)
    (is-eq period cycle-yearly)
  )
)

;; Internal: Validate payment amount
(define-private (validate-payment-sum (amount uint))
  (> amount u0)
)

;; Internal: Record state change event
(define-private (log-state-change
    (owner principal)
    (sid uint)
    (new-state uint)
  )
  (let (
      (current-log (default-to { state-changes: (list) }
        (map-get? state-transitions {
          principal-owner: owner,
          svc-id: sid,
        })
      ))
      (change-entry {
        changed-at: block-height,
        new-state: new-state,
      })
    )
    (map-set state-transitions {
      principal-owner: owner,
      svc-id: sid,
    } { state-changes: (unwrap-panic (as-max-len? (append (get state-changes current-log) change-entry) u50)) }
    )
  )
)

;; Public: Establish new subscription service agreement
(define-public (enroll-subscription
    (service-desc (string-ascii 100))
    (amount-microsstx uint)
    (period-in-days uint)
    (next-due-block uint)
  )
  (let (
      (new-svc-id (acquire-subscription-id))
      (caller tx-sender)
    )
    (asserts! (validate-period period-in-days) error-bad-cycle-value)
    (asserts! (validate-payment-sum amount-microsstx) error-invalid-payment-sum)
    (asserts! (>= next-due-block block-height) fail-date-validation)
    
    (map-set subscriptions-registry {
      principal-owner: caller,
      svc-id: new-svc-id,
    } {
      svc-description: service-desc,
      payment-sum: amount-microsstx,
      period-days: period-in-days,
      payment-deadline: next-due-block,
      current-state: state-live,
      registered-at: block-height,
    })
    
    (add-sub-to-collection caller new-svc-id)
    (log-state-change caller new-svc-id state-live)
    (ok new-svc-id)
  )
)

;; Public: Update subscription configuration
(define-public (modify-subscription
    (svc-id uint)
    (service-desc (string-ascii 100))
    (amount-microsstx uint)
    (period-in-days uint)
    (next-due-block uint)
  )
  (let (
      (caller tx-sender)
      (existing (map-get? subscriptions-registry {
        principal-owner: caller,
        svc-id: svc-id,
      }))
    )
    (asserts! (is-some existing) error-subscription-missing)
    (asserts! (validate-period period-in-days) error-bad-cycle-value)
    (asserts! (validate-payment-sum amount-microsstx) error-invalid-payment-sum)
    (asserts! (>= next-due-block block-height) fail-date-validation)
    
    (map-set subscriptions-registry {
      principal-owner: caller,
      svc-id: svc-id,
    } {
      svc-description: service-desc,
      payment-sum: amount-microsstx,
      period-days: period-in-days,
      payment-deadline: next-due-block,
      current-state: (get current-state (unwrap-panic existing)),
      registered-at: (get registered-at (unwrap-panic existing)),
    })
    (ok true)
  )
)

;; Public: Transition subscription state
(define-public (change-status
    (svc-id uint)
    (next-state uint)
  )
  (let (
      (caller tx-sender)
      (existing (map-get? subscriptions-registry {
        principal-owner: caller,
        svc-id: svc-id,
      }))
    )
    (asserts! (is-some existing) error-subscription-missing)
    
    (asserts!
      (or
        (is-eq next-state state-live)
        (is-eq next-state state-suspended)
        (is-eq next-state state-terminated)
      )
      error-bad-status-transition
    )
    
    (map-set subscriptions-registry {
      principal-owner: caller,
      svc-id: svc-id,
    }
      (merge (unwrap-panic existing) { current-state: next-state })
    )
    
    (log-state-change caller svc-id next-state)
    (ok true)
  )
)

;; Public: Record transaction against subscription
(define-public (record-txn
    (svc-id uint)
    (txn-timestamp uint)
    (txn-sum uint)
  )
  (let (
      (caller tx-sender)
      (existing (map-get? subscriptions-registry {
        principal-owner: caller,
        svc-id: svc-id,
      }))
      (current-archive (default-to { txn-records: (list) }
        (map-get? txn-archive {
          principal-owner: caller,
          svc-id: svc-id,
        })
      ))
      (new-txn {
        txn-timestamp: txn-timestamp,
        txn-sum: txn-sum,
      })
    )
    (asserts! (is-some existing) error-subscription-missing)
    (asserts! (> txn-sum u0) error-invalid-payment-sum)
    
    (map-set txn-archive {
      principal-owner: caller,
      svc-id: svc-id,
    } { txn-records: (unwrap-panic (as-max-len? (append (get txn-records current-archive) new-txn) u100)) }
    )
    
    (let (
        (sub-data (unwrap-panic existing))
        (new-deadline (+ txn-timestamp (get period-days sub-data)))
      )
      (map-set subscriptions-registry {
        principal-owner: caller,
        svc-id: svc-id,
      }
        (merge sub-data { payment-deadline: new-deadline })
      )
      (ok true)
    )
  )
)

;; Public: Terminate subscription record
(define-public (revoke-subscription (svc-id uint))
  (let (
      (caller tx-sender)
      (existing (map-get? subscriptions-registry {
        principal-owner: caller,
        svc-id: svc-id,
      }))
    )
    (asserts! (is-some existing) error-subscription-missing)
    
    (map-delete subscriptions-registry {
      principal-owner: caller,
      svc-id: svc-id,
    })
    
    (log-state-change caller svc-id state-terminated)
    (ok true)
  )
)

;; Read-only: Get user's subscription identifiers
(define-read-only (fetch-user-subscriptions (user principal))
  (default-to { svc-ids: (list) }
    (map-get? account-subscriptions { principal-owner: user })
  )
)

;; Read-only: Query subscription details
(define-read-only (query-subscription
    (owner principal)
    (svc-id uint)
  )
  (map-get? subscriptions-registry {
    principal-owner: owner,
    svc-id: svc-id,
  })
)

;; Read-only: Retrieve transaction history
(define-read-only (get-txn-history
    (owner principal)
    (svc-id uint)
  )
  (default-to { txn-records: (list) }
    (map-get? txn-archive {
      principal-owner: owner,
      svc-id: svc-id,
    })
  )
)

;; Read-only: Retrieve state change log
(define-read-only (get-state-log
    (owner principal)
    (svc-id uint)
  )
  (default-to { state-changes: (list) }
    (map-get? state-transitions {
      principal-owner: owner,
      svc-id: svc-id,
    })
  )
)

;; Read-only: List active subscriptions (filtering by state on client)
(define-read-only (list-subscriptions (user principal))
  (let (
      (user-subs (get svc-ids (fetch-user-subscriptions user)))
    )
    (ok user-subs)
  )
)

;; Read-only: Check upcoming renewal deadlines
(define-read-only (fetch-renewal-schedule
    (user principal)
    (block-window uint)
  )
  (let (
      (user-subs (get svc-ids (fetch-user-subscriptions user)))
      (current-block block-height)
      (lookahead-blocks (* block-window u144))
    )
    (ok user-subs)
  )
)
