import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Handover from "../screens/Handover";
import { RoleContext } from "../contexts/CaseContext";
import { EvidenceDrawerProvider } from "../components/EvidenceDrawer";
import { setMockFallback, setApiRole } from "../api";

describe("Handover Gaps & Prompt 7 Enhancements UI", () => {
  beforeEach(() => {
    setMockFallback(true);
    // Mock window.confirm to auto-approve restore confirmation
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  const renderHandover = async (role: "engineering_lead" | "successor" | "contractor" = "engineering_lead") => {
    await setApiRole(role);
    return render(
      <RoleContext.Provider value={{ role, setRole: () => {} }}>
        <EvidenceDrawerProvider>
          <MemoryRouter initialEntries={["/cases/case-001/handover"]}>
            <Routes>
              <Route path="/cases/:caseId/handover" element={<Handover />} />
            </Routes>
          </MemoryRouter>
        </EvidenceDrawerProvider>
      </RoleContext.Provider>
    );
  };

  it("renders Recurring Operational Vulnerabilities section with 4 detected problems", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("recurring-problems-section")).toBeDefined();
    });

    expect(screen.getByText("Recurring Operational Vulnerabilities")).toBeDefined();
    expect(screen.getByText("4 detected")).toBeDefined();

    // Verify all 4 category cards are present
    expect(screen.getByText(/High churn on auth\.config\.ts/i)).toBeDefined();
    expect(screen.getByText(/Reopened Bug: Fix JWT token expiry/i)).toBeDefined();
    expect(screen.getByText(/Repeated Incident: Timeout Errors/i)).toBeDefined();
    expect(screen.getByText(/Flaky Test Pattern: Intermittent CI Failures/i)).toBeDefined();

    // Verify suggested action callouts are rendered
    expect(screen.getByText(/Extract session timeout middleware into tested pure function/i)).toBeDefined();
  });

  it("filters recurring problems when category filter pills are clicked", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("recurring-problems-section")).toBeDefined();
    });

    // Click 'Code Churn' filter pill
    const churnBtn = screen.getByRole("button", { name: /^code churn$/i });
    fireEvent.click(churnBtn);

    // Churn problem should remain visible
    expect(screen.getByText(/High churn on auth\.config\.ts/i)).toBeDefined();
    // Others should be filtered out
    expect(screen.queryByText(/Flaky Test Pattern: Intermittent CI Failures/i)).toBeNull();
    expect(screen.queryByText(/Repeated Incident: Timeout Errors/i)).toBeNull();

    // Click 'All' filter pill to restore
    const allBtn = screen.getByRole("button", { name: /^all$/i });
    fireEvent.click(allBtn);
    expect(screen.getByText(/Flaky Test Pattern: Intermittent CI Failures/i)).toBeDefined();
  });

  it("renders Key Contacts by component with critical warning for Database & Migrations", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("key-contacts-section")).toBeDefined();
    });

    expect(screen.getByText(/Key Contacts \("Who to Ask" by Component\)/i)).toBeDefined();

    // Check internal and external vendor contacts
    expect(screen.getAllByText("Alex Chen").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("(@alex)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Sam Rodriguez")).toBeDefined();
    expect(screen.getByText("Stripe Merchant Support")).toBeDefined();
    expect(screen.getByText("SendGrid Postmaster Support")).toBeDefined();

    // Leaver Priya Nair must NOT be listed as a remaining owner/contact
    const contactsSection = screen.getByTestId("key-contacts-section");
    expect(contactsSection.textContent).not.toContain("Priya Nair (@priya)");

    // Database & Migrations has no remaining owner -> must show CRITICAL WARNING banner
    const warning = screen.getByTestId("no-owner-warning");
    expect(warning).toBeDefined();
    expect(warning.textContent).toContain("No remaining owner");
    expect(warning.textContent).toContain("sole knowledge holder");
  });

  it("renders First 5 Days Onboarding Roadmap table with objectives and target claims", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("continuation-plan-section")).toBeDefined();
    });

    expect(screen.getByText("First 5 Days Continuation & Verification Plan")).toBeDefined();
    expect(screen.getByText("Day 1 - 5 Roadmap")).toBeDefined();
    expect(screen.getAllByText(/Day 1/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Day 2/i).length).toBeGreaterThanOrEqual(1);
  });

  it("opens Version History modal and allows Engineering Lead to Restore as Draft", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("recurring-problems-section")).toBeDefined();
    });

    // Find and click top 'History (N)' trigger button
    const historyBtn = screen.getAllByRole("button", { name: /^history \(\d+\)$/i })[0];
    fireEvent.click(historyBtn);

    // Modal should be visible
    await waitFor(() => {
      expect(screen.getByText("Handover Version History")).toBeDefined();
    });

    // Check version row and Restore as Draft button
    expect(screen.getAllByText(/v1/).length).toBeGreaterThanOrEqual(1);
    const restoreBtn = screen.getByRole("button", { name: /Restore as Draft/i });
    expect(restoreBtn).toBeDefined();

    // Verify audit log link exists
    const auditLink = screen.getByText(/View Audit Log ↗/i);
    expect(auditLink).toBeDefined();

    // Trigger restore
    fireEvent.click(restoreBtn);
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
  });

  it("opens Side-by-Side Diff modal and renders WordDiffViewer token diffs and audit link", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("recurring-problems-section")).toBeDefined();
    });

    // Open diff modal directly via Compare Diff button
    const diffBtn = screen.getByRole("button", { name: /^compare diff$/i });
    fireEvent.click(diffBtn);

    await waitFor(() => {
      expect(screen.getByText("Side-by-Side Version Diff")).toBeDefined();
    });

    // Verify WordDiffViewer renders word diff token elements
    await waitFor(() => {
      expect(screen.getAllByText(/Word-Level Revision Diff/i).length).toBeGreaterThanOrEqual(1);
    });

    // Check deletion and insertion tokens
    expect(screen.getAllByText(/15 minutes/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2 hours \(corrected from 15 minutes\)/i).length).toBeGreaterThanOrEqual(1);

    // Verify audit trail link is rendered in diff modal footer
    expect(screen.getByText(/Audit Trail Endpoint ↗/i)).toBeDefined();

    // Check 'Restore v1 as New Draft' button
    const restoreDraftBtn = screen.getByRole("button", { name: /Restore v\d+ as New Draft/i });
    expect(restoreDraftBtn).toBeDefined();
  });
});
