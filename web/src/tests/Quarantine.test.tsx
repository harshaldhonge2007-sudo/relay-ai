import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Admin from "../screens/Admin";
import { RoleContext } from "../contexts/CaseContext";
import { setMockFallback, setApiRole } from "../api";

describe("Quarantine Queue UI Component", () => {
  beforeEach(() => {
    setMockFallback(true);
  });

  const renderWithRole = async (role: "engineering_lead" | "successor" | "contractor") => {
    await setApiRole(role);
    return render(
      <RoleContext.Provider value={{ role, setRole: () => {} }}>
        <MemoryRouter initialEntries={["/cases/case-001/admin"]}>
          <Routes>
            <Route path="/cases/:caseId/admin" element={<Admin />} />
          </Routes>
        </MemoryRouter>
      </RoleContext.Provider>
    );
  };

  it("renders quarantine queue section and items for engineering_lead", async () => {
    await renderWithRole("engineering_lead");

    // Wait for screen to load
    await waitFor(() => {
      expect(screen.getByText("Item-Level Sensitive-Content Quarantine Queue")).toBeDefined();
    });

    // Check header and item counts
    expect(screen.getByText("2 Quarantined Item(s)")).toBeDefined();

    // Check quarantined item titles
    expect(
      screen.getByText("#engineering - Q4 compensation and retention package update")
    ).toBeDefined();
    expect(
      screen.getByText("#engineering - Customer support escalation robert.morris@enterpriseclient.com")
    ).toBeDefined();

    // Check reason chips
    expect(screen.getByText("hr:salary")).toBeDefined();
    expect(screen.getByText("legal:nda_lawsuit")).toBeDefined();
    expect(screen.getByText("customer:id")).toBeDefined();
    expect(screen.getByText("pii:email")).toBeDefined();

    // Verify resolve action buttons exist
    const redactButtons = screen.getAllByRole("button", { name: /Redact & Keep/i });
    expect(redactButtons.length).toBeGreaterThan(0);
    const clearButtons = screen.getAllByRole("button", { name: /Clear/i });
    expect(clearButtons.length).toBeGreaterThan(0);
  });

  it("toggles sensitive snippet visibility for engineering_lead", async () => {
    await renderWithRole("engineering_lead");

    await waitFor(() => {
      expect(screen.getByText("Item-Level Sensitive-Content Quarantine Queue")).toBeDefined();
    });

    const snippetToggles = screen.getAllByRole("button", { name: /Show Detected Snippet/i });
    expect(snippetToggles.length).toBe(2);

    // Click first toggle to expand snippet
    fireEvent.click(snippetToggles[0]);

    // Snippet containing canary or compensation text is now visible
    expect(
      screen.getByText(/Elena Vance shared the Q4 compensation and retention package update/i)
    ).toBeDefined();

    // Toggle button text changes to Hide
    expect(screen.getByRole("button", { name: /Hide Snippet/i })).toBeDefined();
  });

  it("restricts quarantine queue for non-lead roles (successor)", async () => {
    await renderWithRole("successor");

    await waitFor(() => {
      expect(screen.getByText("Administration & Security")).toBeDefined();
    });

    // Quarantined items must NOT be visible
    expect(screen.queryByText("#engineering - Q4 compensation and retention package update")).toBeNull();
    expect(
      screen.queryByText("#engineering - Customer support escalation robert.morris@enterpriseclient.com")
    ).toBeNull();

    // Access restricted banner must be displayed
    expect(screen.getByText("Access Restricted — Engineering Lead Required")).toBeDefined();
    expect(
      screen.getByText(/Quarantined items are default-denied and excluded from derived views/i)
    ).toBeDefined();
  });

  it("allows engineering_lead to resolve a quarantined item", async () => {
    await renderWithRole("engineering_lead");

    await waitFor(() => {
      expect(
        screen.getByText("#engineering - Q4 compensation and retention package update")
      ).toBeDefined();
    });

    // Click Redact & Keep on first item
    const redactBtns = screen.getAllByRole("button", { name: /^Redact & Keep$/i });
    fireEvent.click(redactBtns[0]);

    // The item should be removed from view
    await waitFor(() => {
      expect(
        screen.queryByText("#engineering - Q4 compensation and retention package update")
      ).toBeNull();
    });
  });
});
