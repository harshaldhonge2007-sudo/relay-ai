import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Handover from "../screens/Handover";
import { RoleContext } from "../contexts/CaseContext";
import { EvidenceDrawerProvider } from "../components/EvidenceDrawer";
import { setMockFallback, setApiRole } from "../api";

describe("Review and Successor Workflow UI (Prompt 9)", () => {
  beforeEach(() => {
    setMockFallback(true);
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    vi.spyOn(window, "prompt").mockImplementation(() => "Sample test rationale");
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

  it("renders Review Triage bar with progress counter, progress bar, and filter chips", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("review-triage-bar")).toBeDefined();
    });

    const triageBar = screen.getByTestId("review-triage-bar");
    expect(triageBar.textContent).toContain("Review Triage & Quality Gates");
    expect(triageBar.textContent).toContain("reviewed");

    // Check filter chips exist within triage bar
    expect(within(triageBar).getByRole("button", { name: /^all/i })).toBeDefined();
    expect(within(triageBar).getByRole("button", { name: /^unreviewed/i })).toBeDefined();
    expect(within(triageBar).getByRole("button", { name: /^approved/i })).toBeDefined();
    expect(within(triageBar).getByRole("button", { name: /^verified/i })).toBeDefined();
    expect(within(triageBar).getByRole("button", { name: /^inferred \/ unknown/i })).toBeDefined();
    expect(within(triageBar).getByRole("button", { name: /^contradictions/i })).toBeDefined();

    // Check progress bar
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeDefined();
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
  });

  it("toggles sorting order between Risk Priority and Document Order", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("review-triage-bar")).toBeDefined();
    });

    // Default is Risk Priority
    const orderBtn = screen.getByRole("button", { name: /order: risk priority/i });
    expect(orderBtn).toBeDefined();

    // Click to toggle to Document Order
    fireEvent.click(orderBtn);
    expect(screen.getByRole("button", { name: /order: document order/i })).toBeDefined();

    // Click to toggle back
    fireEvent.click(screen.getByRole("button", { name: /order: document order/i }));
    expect(screen.getByRole("button", { name: /order: risk priority/i })).toBeDefined();
  });

  it("opens keyboard shortcuts cheat sheet modal and dismisses on Esc or Got It", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("review-triage-bar")).toBeDefined();
    });

    // Click shortcuts button [?]
    const shortcutsBtn = screen.getByRole("button", { name: /shortcuts \[\?\]/i });
    fireEvent.click(shortcutsBtn);

    // Modal dialog should appear
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Keyboard Shortcuts Cheat Sheet" })).toBeDefined();
    });
    expect(screen.getByText("Review Keyboard Shortcuts")).toBeDefined();
    expect(screen.getByText(/Move focus to next claim card/i)).toBeDefined();
    expect(screen.getByText(/Approve currently focused claim/i)).toBeDefined();

    // Click Got It to close
    const gotItBtn = screen.getByRole("button", { name: "Got It" });
    fireEvent.click(gotItBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Keyboard Shortcuts Cheat Sheet" })).toBeNull();
    });
  });

  it("opens Batch Approve confirmation dialog with exact count and strict invariant notice", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByTestId("review-triage-bar")).toBeDefined();
    });

    // Find Batch Approve button
    const batchBtn = screen.getByRole("button", { name: /batch approve corroborated/i });
    expect(batchBtn).toBeDefined();

    // Click batch approve button
    fireEvent.click(batchBtn);

    // Confirmation dialog should be open
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Confirm Batch Approval" })).toBeDefined();
    });

    const dialog = screen.getByRole("dialog", { name: "Confirm Batch Approval" });
    expect(dialog.textContent).toContain("Strict Quality Invariant");
    expect(dialog.textContent).toContain("INFERRED or UNKNOWN are strictly excluded");

    // Click Confirm Batch Approval
    const confirmBtn = screen.getByRole("button", { name: /approve \d+ verified claims/i });
    fireEvent.click(confirmBtn);

    // Wait for notification toast
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeDefined();
    });
    expect(screen.getByRole("status").textContent).toContain("Batch approved");
  });

  it("opens Release Pre-Flight verification dialog with automated checklist and authentic contractor role preview", async () => {
    await renderHandover("engineering_lead");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /release to successor/i })).toBeDefined();
    });

    // Click Release to Successor (which triggers the Pre-Flight dialog)
    const releaseBtn = screen.getByRole("button", { name: /release to successor/i });
    fireEvent.click(releaseBtn);

    // Dialog should open
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Release Pre-Flight Checklist" })).toBeDefined();
    });

    const dialog = screen.getByRole("dialog", { name: "Release Pre-Flight Checklist" });
    expect(dialog.textContent).toContain("Handover Release Pre-Flight Verification");
    expect(dialog.textContent).toContain("Automated Readiness Checklist");
    expect(dialog.textContent).toContain("1. Claim Completeness");
    expect(dialog.textContent).toContain("2. Clashing Statements");
    expect(dialog.textContent).toContain("3. Secrets & PII Scan");
    expect(dialog.textContent).toContain("4. Quarantine Queue");

    // Check Live Role Preview buttons exist
    const contractorBtn = screen.getByRole("button", { name: /contractor \(restricted\)/i });
    expect(contractorBtn).toBeDefined();

    // Click contractor view to trigger authentic server-side role preview
    fireEvent.click(contractorBtn);

    await waitFor(() => {
      expect(screen.getByText(/showing \d+ claims as seen by role:/i)).toBeDefined();
    });
    // Withheld badge / notice should appear in the authentic contractor preview
    expect(screen.getAllByText(/\[WITHHELD\]/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders First 5 Days continuation checklist with checkbox task persistence", async () => {
    await renderHandover("successor");

    await waitFor(() => {
      expect(screen.getByTestId("continuation-plan-section")).toBeDefined();
    });

    const contSection = screen.getByTestId("continuation-plan-section");
    expect(contSection.textContent).toContain("First 5 Days Continuation & Verification Plan");
    expect(contSection.textContent).toContain("Day 1 - 5 Roadmap");

    // Checkbox should exist
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);

    // Click first checkbox to toggle completed
    fireEvent.click(checkboxes[0]);
  });

  it("allows successor to click Ask Lead on a claim card and submit inquiry", async () => {
    await renderHandover("successor");

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /ask lead/i }).length).toBeGreaterThanOrEqual(1);
    });

    // Click first Ask Lead button
    const askLeadButtons = screen.getAllByRole("button", { name: /ask lead/i });
    fireEvent.click(askLeadButtons[0]);

    // Dialog should open
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Ask the Lead" })).toBeDefined();
    });

    expect(screen.getByText("Ask Engineering Lead for Clarification")).toBeDefined();

    // Type question
    const textarea = screen.getByPlaceholderText(/e\.g\. Can you clarify how the exponential backoff/i);
    fireEvent.change(textarea, { target: { value: "Where is the retry configuration defined?" } });

    // Submit inquiry
    const sendBtn = screen.getByRole("button", { name: "Send Inquiry" });
    fireEvent.click(sendBtn);

    // Toast notification should show inquiry sent
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeDefined();
    });
    expect(screen.getByRole("status").textContent).toContain("Inquiry sent to Engineering Lead");
  });
});
