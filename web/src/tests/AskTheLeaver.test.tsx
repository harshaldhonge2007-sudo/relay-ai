import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AskTheLeaver from "../components/chat/AskTheLeaver";
import { EvidenceDrawerProvider } from "../components/EvidenceDrawer";

function Harness({ caseId = "case-001" }: { caseId?: string }) {
  return (
    <BrowserRouter>
      <EvidenceDrawerProvider>
        <AskTheLeaver caseId={caseId} leaverName="Priya Nair" />
      </EvidenceDrawerProvider>
    </BrowserRouter>
  );
}

describe("AskTheLeaver Component", () => {
  it("renders with header, avatar, and suggested question pills", () => {
    render(<Harness />);

    expect(screen.getByText("Ask Priya Nair")).not.toBeNull();
    expect(screen.getByText(/Grounded Avatar/i)).not.toBeNull();
    expect(screen.getByText(/Why was JWT token lifetime changed/i)).not.toBeNull();
    expect(screen.getByPlaceholderText(/Ask Priya Nair about architecture/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).not.toBeNull();
  });

  it("sends query and renders grounded response with citations", async () => {
    render(<Harness />);

    const jwtPill = screen.getByText(/Why was JWT token lifetime changed/i);
    fireEvent.click(jwtPill);

    await waitFor(() => {
      expect(screen.getByText(/JWT access token lifetime was reduced from 2 hours down to 15 minutes/i)).not.toBeNull();
    }, { timeout: 3000 });

    // Check citation chips
    expect(screen.getByText("[COMMIT a1b2c3d]")).not.toBeNull();
    expect(screen.getByText("[PR 142]")).not.toBeNull();
    expect(screen.getByText(/95% Grounded/i)).not.toBeNull();
  });

  it("renders abstention notice and interview queue button on trap query", async () => {
    render(<Harness />);

    const trapPill = screen.getByText(/Where are the AWS production root keys/i);
    fireEvent.click(trapPill);

    await waitFor(() => {
      expect(screen.getByText(/Insufficient Evidence Trace/i)).not.toBeNull();
      expect(screen.getByRole("button", { name: /View in Interview Queue/i })).not.toBeNull();
    }, { timeout: 3000 });
  });
});

