import { describe, it, expect, beforeEach } from "vitest";
import { Clarinet, Tx, Chain, Account } from "@hirosystems/clarinet-sdk";

describe("Orchestrator Core Contract", () => {
  let chain: Chain;
  let accounts: Map<string, Account>;

  beforeEach(async () => {
    const project = new Clarinet();
    chain = await project.getChainForTest();
    accounts = chain.getAccounts();
  });

  describe("Subscription Enrollment", () => {
    it("Should successfully enroll a new subscription service", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Premium Music Streaming"',
            "u9999000",
            "u30",
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should reject invalid billing cycles", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Test Service"',
            "u5000000",
            "u45",  // Invalid period
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("102");  // ERR-INVALID-CYCLE-PERIOD
    });

    it("Should reject zero payment amounts", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Test Service"',
            "u0",  // Invalid amount
            "u30",
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("103");  // ERR-INVALID-AMOUNT
    });

    it("Should reject past dates", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Test Service"',
            "u5000000",
            "u30",
            "u1"  // Past date
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("104");  // ERR-INVALID-DATE
    });
  });

  describe("Subscription Modification", () => {
    beforeEach(() => {
      const deployer = accounts.get("deployer")!;
      chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Video Platform"',
            "u1499000",
            "u30",
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);
    });

    it("Should successfully update subscription details", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "modify-subscription",
          [
            "u0",
            '"Updated Video Platform"',
            "u2499000",
            "u30",
            "(+ block-height u576)"
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should reject modification of non-existent subscriptions", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "modify-subscription",
          [
            "u999",  // Non-existent ID
            '"Non-existent"',
            "u1000000",
            "u30",
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("101");  // ERR-SUBSCRIPTION-NOT-FOUND
    });
  });

  describe("Status Transitions", () => {
    beforeEach(() => {
      const deployer = accounts.get("deployer")!;
      chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Test Service"',
            "u7500000",
            "u90",
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);
    });

    it("Should transition subscription to suspended state", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "change-status",
          [
            "u0",
            "u2"  // Suspended state
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should transition subscription to terminated state", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "change-status",
          [
            "u0",
            "u3"  // Terminated state
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should reject invalid state values", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "change-status",
          [
            "u0",
            "u99"  // Invalid state
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("106");  // ERR-INVALID-STATUS-CHANGE
    });
  });

  describe("Transaction Recording", () => {
    beforeEach(() => {
      const deployer = accounts.get("deployer")!;
      chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Cloud Storage"',
            "u1999000",
            "u365",
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);
    });

    it("Should record payment transaction", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "record-txn",
          [
            "u0",
            "block-height",
            "u1999000"
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should reject transactions with zero amount", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "record-txn",
          [
            "u0",
            "block-height",
            "u0"  // Invalid amount
          ],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("103");  // ERR-INVALID-AMOUNT
    });
  });

  describe("Subscription Retrieval", () => {
    beforeEach(() => {
      const deployer = accounts.get("deployer")!;
      chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"First Service"',
            "u5000000",
            "u30",
            "(+ block-height u288)"
          ],
          deployer.address
        ),
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Second Service"',
            "u10000000",
            "u90",
            "(+ block-height u576)"
          ],
          deployer.address
        )
      ]);
    });

    it("Should retrieve user's subscription list", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "fetch-user-subscriptions",
          [deployer.address],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("svc-ids");
    });

    it("Should retrieve specific subscription details", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "query-subscription",
          [deployer.address, "u0"],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("svc-description");
    });

    it("Should retrieve transaction history", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "get-txn-history",
          [deployer.address, "u0"],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("txn-records");
    });

    it("Should retrieve state change history", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "get-state-log",
          [deployer.address, "u0"],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("state-changes");
    });
  });

  describe("Subscription Deletion", () => {
    beforeEach(() => {
      const deployer = accounts.get("deployer")!;
      chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Temporary Service"',
            "u3000000",
            "u30",
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);
    });

    it("Should successfully revoke subscription", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "revoke-subscription",
          ["u0"],
          deployer.address
        )
      ]);

      expect(result[0].result).toMatch(/ok/);
    });

    it("Should reject revocation of non-existent subscription", () => {
      const deployer = accounts.get("deployer")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "revoke-subscription",
          ["u999"],
          deployer.address
        )
      ]);

      expect(result[0].result).toContain("101");  // ERR-SUBSCRIPTION-NOT-FOUND
    });
  });

  describe("Authorization", () => {
    beforeEach(() => {
      const deployer = accounts.get("deployer")!;
      chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "enroll-subscription",
          [
            '"Protected Service"',
            "u8000000",
            "u30",
            "(+ block-height u288)"
          ],
          deployer.address
        )
      ]);
    });

    it("Should prevent modification by non-owner", () => {
      const wallet_1 = accounts.get("wallet_1")!;
      
      const result = chain.mineBlock([
        Tx.contractCall(
          "orchestrator-core",
          "modify-subscription",
          [
            "u0",
            '"Unauthorized Update"',
            "u9000000",
            "u30",
            "(+ block-height u288)"
          ],
          wallet_1.address
        )
      ]);

      expect(result[0].result).toContain("101");  // ERR-SUBSCRIPTION-NOT-FOUND
    });
  });
});
