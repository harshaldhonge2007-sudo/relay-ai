import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Admin from "../screens/Admin";
import { RoleContext } from "../contexts/CaseContext";
import { setMockFallback, setApiRole } from "../api";

describe("Bring-Your-Own-Data (BYOD) & Identity Management Component", () => {
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

  it("renders BYOD import button for engineering_lead but not for successor", async () => {
    const { unmount } = await renderWithRole("engineering_lead");

    await waitFor(() => {
      expect(screen.getByText("+ Import Project Data (BYOD)")).toBeDefined();
    });

    unmount();

    await renderWithRole("successor");
    await waitFor(() => {
      expect(screen.getByText("Connected Sources & Access Control")).toBeDefined();
    });

    expect(screen.queryByText("+ Import Project Data (BYOD)")).toBeNull();
  });

  it("opens BYOD import modal, loads sample preview, and displays staging metrics", async () => {
    await renderWithRole("engineering_lead");

    await waitFor(() => {
      expect(screen.getByText("+ Import Project Data (BYOD)")).toBeDefined();
    });

    // Click import button to open modal
    fireEvent.click(screen.getByText("+ Import Project Data (BYOD)"));

    expect(screen.getByText("Bring Your Own Project Data (BYOD)")).toBeDefined();
    expect(
      screen.getByText(/1-Click: Load Sample Dataset/i)
    ).toBeDefined();

    // Click Load Sample Dataset
    fireEvent.click(screen.getByText(/1-Click: Load Sample Dataset/i));

    // Wait for preview to render
    await waitFor(() => {
      expect(screen.getByText(/Total Items Staged:/i)).toBeDefined();
    });

    // Verify preview metrics and sensitive content alert
    expect(screen.getByText(/Item-Level Sensitive Content Detected/i)).toBeDefined();
    expect(screen.getByText(/Assign Source Visibility Tiers/i)).toBeDefined();
    expect(screen.getByText("Confirm & Ingest Data")).toBeDefined();

    // Click commit
    fireEvent.click(screen.getByText("Confirm & Ingest Data"));

    // Verify success feedback
    await waitFor(() => {
      expect(screen.getByText(/Successfully imported 9 items/i)).toBeDefined();
    });
  });

  it("allows engineering_lead to confirm and split identity merges", async () => {
    await renderWithRole("engineering_lead");

    await waitFor(() => {
      expect(screen.getByText("Cross-Tool Identity Resolution")).toBeDefined();
    });

    // Confirm buttons should exist
    const confirmButtons = screen.getAllByRole("button", { name: /^Confirm$/i });
    expect(confirmButtons.length).toBeGreaterThan(0);

    // Click confirm on first item
    fireEvent.click(confirmButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/\[Confirmed\]/i)).toBeDefined();
    });

    // Split buttons should exist
    const splitButtons = screen.getAllByRole("button", { name: /^Split$/i });
    expect(splitButtons.length).toBeGreaterThan(0);

    // Click split on second item
    fireEvent.click(splitButtons[1]);

    await waitFor(() => {
      expect(screen.getAllByText(/\[Split\]/i).length).toBe(2);
    });
  });
});
