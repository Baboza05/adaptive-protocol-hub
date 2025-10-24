import { describe, it, expect, beforeEach } from "vitest";
import { Clarinet, Tx, Chain, Account } from "@hirosystems/clarinet-sdk";

describe("Ledger Engine Contract Suite", () => {
  let chain: Chain;
  let accounts: Map<string, Account>;

  beforeEach(async () => {
    const project = new Clarinet();
    chain = await project.getChainForTest();
    accounts = chain.getAccounts();
  });

  describe("Service Registration", () => {
    it("Provider should register service in directory", () => {
      const provider = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "register-service-provider",
          ['"Video Streaming Platform"'],
          provider.address
        )
      ]);

      expect(result[0].result).toMatch(/ok.*u0/);
    });

    it("Multiple services can be registered", () => {
      const provider = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "register-service-provider",
          ['"Music Service"'],
          provider.address
        ),
        Tx.contractCall(
          "ledger-engine",
          "register-service-provider",
          ['"Photo Storage"'],
          provider.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
      expect(result[1].result).toMatch(/ok/);
    });
  });

  describe("Subscription Creation", () => {
    beforeEach(() => {
      const provider = accounts.get("wallet_1")!;
      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "register-service-provider",
          ['"Subscription Service"'],
          provider.address
        )
      ]);
    });

    it("Should establish new subscription agreement", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "establish-subscription",
          [
            "u0",  // service-key
            (accounts.get("wallet_3")!).address,  // recipient
            "u5000000",  // payment amount
            "u4320",  // interval in blocks (approx 30 days)
            "none"  // no custom token
          ],
          subscriber.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should reject subscription with zero payment", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "establish-subscription",
          [
            "u0",
            (accounts.get("wallet_3")!).address,
            "u0",  // Invalid amount
            "u4320",
            "none"
          ],
          subscriber.address
        )
      ]);

      expect(result[0].result).toContain("108");  // ERR-INVALID-AMOUNT
    });

    it("Should reject subscription with zero interval", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "establish-subscription",
          [
            "u0",
            (accounts.get("wallet_3")!).address,
            "u5000000",
            "u0",  // Invalid interval
            "none"
          ],
          subscriber.address
        )
      ]);

      expect(result[0].result).toContain("111");  // ERR-INVALID-PARAMETER
    });
  });

  describe("Payment Configuration", () => {
    it("User should configure payment thresholds", () => {
      const user = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "configure-payment-thresholds",
          [
            "true",     // enabled
            "u5000000", // threshold
            "true"      // requires approval
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok true/);
    });

    it("Should retrieve configured payment settings", () => {
      const user = accounts.get("wallet_2")!;
      
      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "configure-payment-thresholds",
          ["true", "u7500000", "false"],
          user.address
        )
      ]);

      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "fetch-payment-settings",
          [user.address],
          user.address
        )
      ]);

      expect(result[0].result).toContain("auto-enabled");
    });
  });

  describe("Payment Execution", () => {
    beforeEach(() => {
      const provider = accounts.get("wallet_1")!;
      const subscriber = accounts.get("wallet_2")!;
      const recipient = accounts.get("wallet_3")!;

      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "register-service-provider",
          ['"Payment Test Service"'],
          provider.address
        ),
        Tx.contractCall(
          "ledger-engine",
          "establish-subscription",
          [
            "u0",
            recipient.address,
            "u1000000",  // 1 STX
            "u1",  // due immediately
            "none"
          ],
          subscriber.address
        )
      ]);
    });

    it("Should initiate payment for subscription", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "initiate-payment",
          ["u0"],
          subscriber.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should reject payment if not due yet", () => {
      const provider = accounts.get("wallet_1")!;
      const subscriber = accounts.get("wallet_2")!;
      const recipient = accounts.get("wallet_3")!;

      // Create subscription with future payment date
      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "establish-subscription",
          [
            "u0",
            recipient.address,
            "u1000000",
            "u10000",  // Far future
            "none"
          ],
          subscriber.address
        )
      ]);

      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "initiate-payment",
          ["u1"],
          subscriber.address
        )
      ]);

      expect(result[0].result).toContain("109");  // ERR-NOT-YET-DUE
    });
  });

  describe("Subscription Management", () => {
    beforeEach(() => {
      const provider = accounts.get("wallet_1")!;
      const subscriber = accounts.get("wallet_2")!;
      const recipient = accounts.get("wallet_3")!;

      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "register-service-provider",
          ['"Manageable Service"'],
          provider.address
        ),
        Tx.contractCall(
          "ledger-engine",
          "establish-subscription",
          [
            "u0",
            recipient.address,
            "u3000000",
            "u4320",
            "none"
          ],
          subscriber.address
        )
      ]);
    });

    it("Subscriber should update payment amount", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "adjust-payment-amount",
          [
            "u0",
            "u4000000"  // New amount
          ],
          subscriber.address
        )
      ]);

      expect(result[0].result).toMatch(/ok true/);
    });

    it("Should reject amount adjustment with zero", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "adjust-payment-amount",
          [
            "u0",
            "u0"  // Invalid amount
          ],
          subscriber.address
        )
      ]);

      expect(result[0].result).toContain("108");  // ERR-INVALID-AMOUNT
    });

    it("Subscriber should update payment interval", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "adjust-payment-interval",
          [
            "u0",
            "u6480"  // New interval (45 days)
          ],
          subscriber.address
        )
      ]);

      expect(result[0].result).toMatch(/ok true/);
    });

    it("Should reject interval adjustment with zero", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "adjust-payment-interval",
          [
            "u0",
            "u0"  // Invalid interval
          ],
          subscriber.address
        )
      ]);

      expect(result[0].result).toContain("111");  // ERR-INVALID-PARAMETER
    });

    it("Subscriber should cancel subscription", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "cancel-subscription-record",
          ["u0"],
          subscriber.address
        )
      ]);

      expect(result[0].result).toMatch(/ok true/);
    });

    it("Non-subscriber should not cancel subscription", () => {
      const other = accounts.get("wallet_4")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "cancel-subscription-record",
          ["u0"],
          other.address
        )
      ]);

      expect(result[0].result).toContain("100");  // ERR-NOT-AUTHORIZED
    });
  });

  describe("Approval Workflow", () => {
    beforeEach(() => {
      const provider = accounts.get("wallet_1")!;
      const subscriber = accounts.get("wallet_2")!;
      const recipient = accounts.get("wallet_3")!;

      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "register-service-provider",
          ['"Premium Service"'],
          provider.address
        ),
        Tx.contractCall(
          "ledger-engine",
          "configure-payment-thresholds",
          [
            "true",
            "u2000000",  // Low threshold
            "true"       // Requires approval
          ],
          subscriber.address
        ),
        Tx.contractCall(
          "ledger-engine",
          "establish-subscription",
          [
            "u0",
            recipient.address,
            "u5000000",  // Exceeds threshold
            "u4320",
            "none"
          ],
          subscriber.address
        )
      ]);
    });

    it("Should request approval for high-value payment", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "request-approval",
          ["u0"],
          subscriber.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should retrieve approval status", () => {
      const subscriber = accounts.get("wallet_2")!;
      
      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "request-approval",
          ["u0"],
          subscriber.address
        )
      ]);

      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "read-approval-status",
          ["u0", "u1"],
          subscriber.address
        )
      ]);

      expect(result[0].result).toContain("requester-principal");
    });
  });

  describe("Query Functions", () => {
    beforeEach(() => {
      const provider = accounts.get("wallet_1")!;

      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "register-service-provider",
          ['"Query Test Service"'],
          provider.address
        )
      ]);
    });

    it("Should fetch service information", () => {
      const provider = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "fetch-service-info",
          ["u0"],
          provider.address
        )
      ]);

      expect(result[0].result).toContain("service-title");
    });

    it("Should fetch subscription information", () => {
      const subscriber = accounts.get("wallet_2")!;
      const recipient = accounts.get("wallet_3")!;

      chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "establish-subscription",
          [
            "u0",
            recipient.address,
            "u2500000",
            "u4320",
            "none"
          ],
          subscriber.address
        )
      ]);

      const result = chain.mineBlock([
        Tx.contractCall(
          "ledger-engine",
          "fetch-subscription-info",
          ["u0"],
          subscriber.address
        )
      ]);

      expect(result[0].result).toContain("operator-service-id");
    });
  });
});
