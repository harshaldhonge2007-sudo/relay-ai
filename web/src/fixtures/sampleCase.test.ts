/**
 * sampleCase.test.ts
 *
 * Asserts that the shared fixture mirrors the seed data so there is a
 * single source of truth between the landing page and the demo data.
 */
import { describe, it, expect } from "vitest";
import {
  HANDOVER_ITEMS,
  PROOF_CARDS,
  CASE_NAME,
  CASE_PERSON,
} from "./sampleCase";

describe("sampleCase fixture", () => {
  it("contains the correct case name and person", () => {
    expect(CASE_NAME).toContain("ShopLedger");
    expect(CASE_PERSON).toBe("Priya Nair");
  });

  it("handover items reference SL-ticket keys from seed/jira.json", () => {
    const all = HANDOVER_ITEMS.map((i) => i.text).join(" ");
    expect(all).toContain("SL-234");
    expect(all).toContain("SL-456");
    expect(all).toContain("SL-412");
  });

  it("handover items use the correct Slack channel (C_ENG, not #incidents)", () => {
    const slackItems = HANDOVER_ITEMS.filter((i) => i.source === "Slack");
    expect(slackItems.length).toBeGreaterThan(0);
    slackItems.forEach((item) => {
      expect(item.text).not.toContain("#incidents");
    });
  });

  it("contains no invented ticket keys (PAY-SEC-001 must not appear)", () => {
    const all = HANDOVER_ITEMS.map((i) => i.text).join(" ");
    expect(all).not.toContain("PAY-SEC-001");
  });

  it("completeness proof card matches expected_findings.json (52 % → 87 %)", () => {
    const card = PROOF_CARDS.find((c) => c.id === "completeness");
    expect(card).toBeDefined();
    expect(card!.body).toContain("52 %");
    expect(card!.body).toContain("87 %");
  });

  it("every handover item has at least one role", () => {
    HANDOVER_ITEMS.forEach((item) => {
      expect(item.roles.length).toBeGreaterThan(0);
    });
  });

  it("engineering lead can see all handover items", () => {
    const leadVisible = HANDOVER_ITEMS.filter((i) =>
      (i.roles as readonly string[]).includes("lead"),
    );
    expect(leadVisible.length).toBe(HANDOVER_ITEMS.length);
  });

  it("contractor sees fewer items than engineering lead", () => {
    const leadCount = HANDOVER_ITEMS.filter((i) =>
      (i.roles as readonly string[]).includes("lead"),
    ).length;
    const contractorCount = HANDOVER_ITEMS.filter((i) =>
      (i.roles as readonly string[]).includes("contractor"),
    ).length;
    expect(contractorCount).toBeLessThan(leadCount);
  });
});

