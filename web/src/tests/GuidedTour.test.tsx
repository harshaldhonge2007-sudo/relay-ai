import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { GuidedTour } from "../components/shell/GuidedTour";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/cases" }),
  };
});

describe("GuidedTour Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <BrowserRouter>
        <GuidedTour isOpen={false} onClose={vi.fn()} caseId="case-001" />
      </BrowserRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders with Step 1 when opened", () => {
    render(
      <BrowserRouter>
        <GuidedTour isOpen={true} onClose={vi.fn()} caseId="case-001" />
      </BrowserRouter>
    );

    expect(screen.getByLabelText("Guided Tour")).toBeDefined();
    expect(screen.getByText("Step 1 of 6")).toBeDefined();
    expect(screen.getByText("1. Connect: Authorized Sources & Ingest")).toBeDefined();
    expect(screen.getByText(/Audit connected GitHub repositories/)).toBeDefined();
  });

  it("advances to Step 2 when Next is clicked and navigates", () => {
    render(
      <BrowserRouter>
        <GuidedTour isOpen={true} onClose={vi.fn()} caseId="case-001" />
      </BrowserRouter>
    );

    const nextBtn = screen.getByText("Next →");
    fireEvent.click(nextBtn);

    expect(screen.getByText("Step 2 of 6")).toBeDefined();
    expect(screen.getByText("2. Reconstruct: Bus-Factor Risk & Knowledge Distribution")).toBeDefined();
    expect(mockNavigate).toHaveBeenCalledWith("/case/case-001/busfactor");
  });

  it("navigates to specific step when pill button is clicked", () => {
    render(
      <BrowserRouter>
        <GuidedTour isOpen={true} onClose={vi.fn()} caseId="case-001" />
      </BrowserRouter>
    );

    // Pill for step 4 (Review)
    const pills = screen.getAllByRole("button", { name: /^[1-6]$/ });
    expect(pills.length).toBe(6);

    fireEvent.click(pills[3]); // 4th pill (0-indexed 3)

    expect(screen.getByText("Step 4 of 6")).toBeDefined();
    expect(screen.getByText("4. Review: Provenance-Enforced Handover Document")).toBeDefined();
    expect(mockNavigate).toHaveBeenCalledWith("/case/case-001/handover");
  });

  it("calls onClose when Dismiss button is clicked", () => {
    const onCloseMock = vi.fn();
    render(
      <BrowserRouter>
        <GuidedTour isOpen={true} onClose={onCloseMock} caseId="case-001" />
      </BrowserRouter>
    );

    const dismissBtn = screen.getByRole("button", { name: "Dismiss guided tour" });
    fireEvent.click(dismissBtn);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
