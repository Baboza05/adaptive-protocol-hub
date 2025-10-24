import { describe, it, expect, beforeEach } from "vitest";
import { Clarinet, Tx, Chain, Account } from "@hirosystems/clarinet-sdk";

describe("Insight Aggregator Analytics Suite", () => {
  let chain: Chain;
  let accounts: Map<string, Account>;

  beforeEach(async () => {
    const project = new Clarinet();
    chain = await project.getChainForTest();
    accounts = chain.getAccounts();
  });

  describe("Engagement Rating Updates", () => {
    it("User should update service engagement level", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "update-engagement-rating",
          [
            '"service-001"',
            "u7"  // Engagement level
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok true/);
    });

    it("Should reject engagement level above 10", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "update-engagement-rating",
          [
            '"service-001"',
            "u15"  // Invalid level
          ],
          user.address
        )
      ]);

      expect(result[0].result).toContain("1002");  // ERR-INVALID-SERVICE-ID
    });

    it("Should accept engagement level of zero", () => {
      const user = accounts.get("wallet_1")!;
      
      // First log a charge to create service record
      chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"service-002"',
            "u1500000"
          ],
          user.address
        )
      ]);

      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "update-engagement-rating",
          [
            '"service-002"',
            "u0"
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });
  });

  describe("Service Charge Recording", () => {
    it("Should record new service charge event", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"cloud-storage"',
            "u2500000"
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok true/);
    });

    it("Should handle multiple charge records for same service", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"streaming-service"',
            "u999000"
          ],
          user.address
        ),
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"streaming-service"',
            "u999000"
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
      expect(result[1].result).toMatch(/ok/);
    });

    it("Should accept charge amount of any positive value", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"test-service"',
            "u1"  // Minimal amount
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });
  });

  describe("Service Tracking Removal", () => {
    beforeEach(() => {
      const user = accounts.get("wallet_1")!;
      chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"temp-service"',
            "u3500000"
          ],
          user.address
        )
      ]);
    });

    it("Should remove service from tracking", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "untrack-service",
          ['"temp-service"'],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok true/);
    });

    it("Should reject removal of non-existent service", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "untrack-service",
          ['"non-existent"'],
          user.address
        )
      ]);

      expect(result[0].result).toContain("1002");  // ERR-INVALID-SERVICE-ID
    });

    it("Alternative function should also remove service", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "remove-service-tracking",
          ['"temp-service"'],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });
  });

  describe("Engagement Mark Recording", () => {
    beforeEach(() => {
      const user = accounts.get("wallet_1")!;
      chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"engagement-test"',
            "u1200000"
          ],
          user.address
        )
      ]);
    });

    it("Should mark engagement level", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "mark-engagement",
          [
            '"engagement-test"',
            "u8"
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should reject invalid engagement mark", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "mark-engagement",
          [
            '"engagement-test"',
            "u20"  // Out of range
          ],
          user.address
        )
      ]);

      expect(result[0].result).toContain("1002");  // ERR-INVALID-SERVICE-ID
    });
  });

  describe("Charge Event Recording Variations", () => {
    it("Alternative charge record method should work", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "record-charge-event",
          [
            '"alt-service"',
            "u1800000"
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should handle large charge amounts", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "record-charge-event",
          [
            '"premium-service"',
            "u999999999"
          ],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });
  });

  describe("Analytics Query Functions", () => {
    beforeEach(() => {
      const user = accounts.get("wallet_1")!;
      chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"entertainment-service"',
            "u1500000"
          ],
          user.address
        ),
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          [
            '"productivity-tool"',
            "u500000"
          ],
          user.address
        )
      ]);
    });

    it("Should retrieve category spending summary", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "summarize-category-expenses",
          [
            user.address,
            '"entertainment"'
          ],
          user.address
        )
      ]);

      expect(result[0].result).toContain("category");
    });

    it("Should identify optimization opportunities", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "identify-optimization-opportunities",
          [],
          user.address
        )
      ]);

      expect(result[0].result).toContain("ok");
    });

    it("Should retrieve service analytics", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "retrieve-service-analytics",
          ['"entertainment-service"'],
          user.address
        )
      ]);

      expect(result[0].result).toContain("frequency");
    });

    it("Should analyze historical costs", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "analyze-historical-costs",
          [
            user.address,
            "u30"
          ],
          user.address
        )
      ]);

      expect(result[0].result).toContain("period-days");
    });
  });

  describe("Monthly Normalization", () => {
    it("Should normalize quarterly subscription to monthly", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "normalize-to-monthly",
          [{
            "service-label": '"Quarterly Payment"',
            "cost-per-cycle": "u9000000",
            "assigned-category": '"productivity"',
            "frequency-days": "u90",
            "effective-date": "u0",
            "most-recent-charge": "u0",
            "engagement-score": "u5"
          }],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should normalize annual subscription to monthly", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "normalize-to-monthly",
          [{
            "service-label": '"Annual Service"',
            "cost-per-cycle": "u36000000",
            "assigned-category": '"other"',
            "frequency-days": "u365",
            "effective-date": "u0",
            "most-recent-charge": "u0",
            "engagement-score": "u9"
          }],
          user.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });
  });

  describe("Multi-User Isolation", () => {
    it("Different users should have isolated records", () => {
      const user1 = accounts.get("wallet_1")!;
      const user2 = accounts.get("wallet_2")!;
      
      chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          ['"user1-service"', "u1000000"],
          user1.address
        ),
        Tx.contractCall(
          "insight-aggregator",
          "log-service-charge",
          ['"user2-service"', "u2000000"],
          user2.address
        )
      ]);

      const result1 = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "retrieve-service-analytics",
          ['"user1-service"'],
          user1.address
        )
      ]);

      const result2 = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "retrieve-service-analytics",
          ['"user2-service"'],
          user2.address
        )
      ]);

      expect(result1[0].result).toContain("frequency");
      expect(result2[0].result).toContain("frequency");
    });
  });

  describe("Spending Trajectory Analysis", () => {
    it("Should analyze spending changes over years", () => {
      const user = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "insight-aggregator",
          "analyze-spending-trajectory",
          [
            user.address,
            "u2024",
            "u2023"
          ],
          user.address
        )
      ]);

      expect(result[0].result).toContain("current-period-total");
    });
  });
});
