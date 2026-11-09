import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EvidenceDrawerProvider, useEvidenceDrawer } from "../components/EvidenceDrawer";
import { RoleContext, RelayRole } from "../contexts/CaseContext";

// Test component for Evidence Drawer
function TestDrawerHarness() {
  const { openDrawer } = useEvidenceDrawer();
  return (
    <div>
      <button
        onClick={() =>
          openDrawer(
            [
              {
                artifact_id: "art-001",
                title: "PR #47: Webhook retry logic",
                source: "github",
                body: "PR #47 implementation details",
              },
            ],
            "Payment webhook retry logic"
          )
        }
      >
        Open Evidence
      </button>
    </div>
  );
}

describe("Evidence Drawer", () => {
  it("opens drawer with citations and closes on Escape", () => {
    render(
      <EvidenceDrawerProvider>
        <TestDrawerHarness />
      </EvidenceDrawerProvider>
    );

    // Initial state: drawer closed
    expect(screen.queryByText("PR #47: Webhook retry logic")).toBeNull();

    // Open drawer
    fireEvent.click(screen.getByText("Open Evidence"));
    expect(screen.getByText("PR #47: Webhook retry logic")).toBeDefined();
    expect(screen.getByText("Source Citations")).toBeDefined();
    expect(screen.getByText("1 source")).toBeDefined();

    // Close via Escape key
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("PR #47: Webhook retry logic")).toBeNull();
  });

  it("closes via close button", () => {
    render(
      <EvidenceDrawerProvider>
        <TestDrawerHarness />
      </EvidenceDrawerProvider>
    );

    fireEvent.click(screen.getByText("Open Evidence"));
    const closeBtn = screen.getByLabelText("Close evidence panel");
    fireEvent.click(closeBtn);
    expect(screen.queryByText("PR #47: Webhook retry logic")).toBeNull();
  });
});

describe("Role Switcher & Context", () => {
  it("renders role select and invokes role change callback", () => {
    const setRoleMock = vi.fn();

    render(
      <RoleContext.Provider value={{ role: "successor" as RelayRole, setRole: setRoleMock }}>
        <select
          aria-label="Demo authentication role switcher"
          value="successor"
          onChange={(e) => setRoleMock(e.target.value as RelayRole)}
        >
          <option value="engineering_lead">Engineering Lead</option>
          <option value="successor">Successor</option>
          <option value="contractor">Contractor</option>
        </select>
      </RoleContext.Provider>
    );

    const select = screen.getByLabelText("Demo authentication role switcher") as HTMLSelectElement;
    expect(select.value).toBe("successor");

    fireEvent.change(select, { target: { value: "engineering_lead" } });
    expect(setRoleMock).toHaveBeenCalledWith("engineering_lead");
  });
});

describe("Claim Review Controls", () => {
  it("renders approve, reject, and edit buttons for lead role", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onEdit = vi.fn();

    render(
      <div>
        <button onClick={() => onApprove("ho-001")}>Approve</button>
        <button onClick={() => onReject("ho-001")}>Reject</button>
        <button onClick={() => onEdit("ho-001")}>Edit</button>
      </div>
    );

    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("ho-001");

    fireEvent.click(screen.getByText("Reject"));
    expect(onReject).toHaveBeenCalledWith("ho-001");

    fireEvent.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith("ho-001");
  });
});
