import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CoveragePanel, CoverageData } from "../components/CoveragePanel";
import { AppLayout } from "../components/shell/AppLayout";
import { CaseProvider } from "../contexts/CaseContext";
import { setMockFallback, isMockFallback } from "../api";

describe("CoveragePanel Component", () => {
  const sampleCoverage: CoverageData = {
    sources_included: ["github", "slack", "jira"],
    sources_failed: ["confluence_sync"],
    sources_withheld: ["confidential_notes"],
    sources_not_connected: ["pagerduty", "linear"],
    claims_by_provenance: {
      verified: 12,
      stated: 4,
      inferred: 2,
      unknown: 1,
    },
    what_this_handover_cannot_tell_you: [
      "Uncommitted local changes on the leaver machine",
      "Private 1:1 hallway conversations",
    ],
  };

  it("renders system boundary header and all 4 source status categories", () => {
    render(<CoveragePanel coverage={sampleCoverage} />);

    expect(screen.getByText("Handover Coverage & Ingestion Status")).toBeDefined();
    expect(screen.getByText("Included (3)")).toBeDefined();
    expect(screen.getByText("Failed (1)")).toBeDefined();
    expect(screen.getByText("Withheld (1)")).toBeDefined();
    expect(screen.getByText("Not Connected (2)")).toBeDefined();

    // Source labels
    expect(screen.getByText("+ github")).toBeDefined();
    expect(screen.getByText("! confluence_sync (claims downgraded)")).toBeDefined();
  });

  it("renders provenance claim counts and honest limitations disclosures", () => {
    render(<CoveragePanel coverage={sampleCoverage} />);

    // Provenance labels & numbers
    expect(screen.getByText("[VERIFIED]")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("[STATED]")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("[INFERRED]")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("[UNKNOWN]")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();

    // Limitations section
    expect(screen.getByText("3. What this handover cannot tell you")).toBeDefined();
    expect(screen.getByText("Uncommitted local changes on the leaver machine")).toBeDefined();
    expect(screen.getByText("Private 1:1 hallway conversations")).toBeDefined();
  });

  it("handles null coverage gracefully with sensible defaults", () => {
    render(<CoveragePanel coverage={null} />);

    expect(screen.getByText("Handover Coverage & Ingestion Status")).toBeDefined();
    expect(screen.getByText("0 sources failed")).toBeDefined();
    expect(screen.getByText("No withheld sources")).toBeDefined();
  });
});

describe("Client-side Mock Fallback Banner & State", () => {
  beforeEach(() => {
    setMockFallback(false);
  });

  it("isMockFallback toggles correctly via setMockFallback helper", () => {
    expect(isMockFallback()).toBe(false);
    setMockFallback(true);
    expect(isMockFallback()).toBe(true);
    setMockFallback(false);
    expect(isMockFallback()).toBe(false);
  });

  it("renders persistent fallback alert banner when backend is unreachable", () => {
    render(
      <MemoryRouter initialEntries={["/case/case-001"]}>
        <CaseProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/case/:caseId" element={<div>Active Case Screen</div>} />
            </Route>
          </Routes>
        </CaseProvider>
      </MemoryRouter>
    );

    // Initially not in fallback mode
    expect(
      screen.queryByText(/Backend unreachable: showing static sample data/)
    ).toBeNull();

    // Trigger mock fallback
    act(() => {
      setMockFallback(true);
    });

    // Alert banner is now visible
    const alertBanner = screen.getByRole("alert");
    expect(alertBanner).toBeDefined();
    expect(
      screen.getByText(/Backend unreachable: showing static sample data\. Changes are not saved\./)
    ).toBeDefined();
    expect(screen.getByText("Mutations Disabled")).toBeDefined();

    // Clear fallback
    act(() => {
      setMockFallback(false);
    });

    expect(
      screen.queryByText(/Backend unreachable: showing static sample data/)
    ).toBeNull();
  });
});
