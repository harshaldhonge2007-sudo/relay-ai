import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Handover from '../screens/Handover';
import IntelligenceDashboard from '../screens/IntelligenceDashboard';
import { RoleContext } from '../contexts/CaseContext';
import { EvidenceDrawerProvider } from '../components/EvidenceDrawer';
import { setMockFallback, setApiRole, apiFetch } from '../api';

describe('Prompt 12: Evidence Drift Detection & Living Handover UI', () => {
  beforeEach(() => {
    setMockFallback(true);
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'prompt').mockImplementation(() => 'Sample test rationale');
  });

  const renderScreen = async (
    ui: React.ReactElement,
    role: 'engineering_lead' | 'successor' | 'contractor' = 'engineering_lead',
    initialRoute = '/cases/case-001/handover'
  ) => {
    await setApiRole(role);
    return render(
      <RoleContext.Provider value={{ role, setRole: () => {} }}>
        <EvidenceDrawerProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/cases/:caseId/handover" element={ui} />
              <Route path="/cases/:caseId/intelligence" element={ui} />
              <Route path="/cases/:caseId" element={ui} />
            </Routes>
          </MemoryRouter>
        </EvidenceDrawerProvider>
      </RoleContext.Provider>
    );
  };

  it('renders "Evidence changed since approval" badge and diff panel on drifted claim', async () => {
    await apiFetch('/cases/case-001/webhooks/simulate-drift', { method: 'POST' });

    await renderScreen(<Handover />, 'engineering_lead');

    await waitFor(() => {
      expect(screen.getByText(/Handover Document/i)).toBeDefined();
    });

    // Verify badge
    const badge = await screen.findByText(/Evidence changed since approval/i);
    expect(badge).toBeDefined();

    // Verify diff panel
    expect(screen.getByText(/Post-Approval Evidence Drift Detected/i)).toBeDefined();
    expect(screen.getAllByText(/PR #47/i).length).toBeGreaterThan(0);

    // Verify approved text is strictly preserved
    expect(screen.getAllByText(/Payment Webhook Retry Logic/i).length).toBeGreaterThan(0);
  });

  it('renders Re-Review Queue button for engineering_lead and opens modal', async () => {
    await apiFetch('/cases/case-001/webhooks/simulate-drift', { method: 'POST' });

    await renderScreen(<Handover />, 'engineering_lead');

    await waitFor(() => {
      expect(screen.getByText(/Handover Document/i)).toBeDefined();
    });

    const queueButtons = await screen.findAllByText(/Re-Review Queue/i);
    expect(queueButtons.length).toBeGreaterThan(0);
    fireEvent.click(queueButtons[0]);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Re-Review Queue/i })).toBeDefined();
    });
    expect(screen.getByText(/Evidence Drift Review/i)).toBeDefined();
    expect(screen.getByText(/Original Approved Claim Text \(Preserved\):/i)).toBeDefined();
    expect(screen.getByText(/Amended Claim Text/i)).toBeDefined();
  });

  it('allows engineering_lead to amend claim and bump version in Re-Review modal', async () => {
    await apiFetch('/cases/case-001/webhooks/simulate-drift', { method: 'POST' });

    await renderScreen(<Handover />, 'engineering_lead');

    await waitFor(() => {
      expect(screen.getByText(/Handover Document/i)).toBeDefined();
    });

    const queueButtons = await screen.findAllByText(/Re-Review Queue/i);
    expect(queueButtons.length).toBeGreaterThan(0);
    fireEvent.click(queueButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Re-Review Queue/i })).toBeDefined();
    });

    const amendBtn = await screen.findByRole('button', { name: /Amend & Bump/i });
    expect(amendBtn).toBeDefined();
    fireEvent.click(amendBtn);

    // Modal closes upon successful resolution
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Re-Review Queue/i })).toBeNull();
    });
  });

  it('renders "Update Available" ribbon for successor when newer version is published', async () => {
    await renderScreen(<Handover />, 'successor');

    await waitFor(() => {
      expect(screen.getByText(/Handover Document/i)).toBeDefined();
    });

    // Successor sees Update Available banner
    const updateRibbon = await screen.findByText(/Update Available/i);
    expect(updateRibbon).toBeDefined();
    expect(screen.getByText(/Compare v/i)).toBeDefined();
  });

  it('connects to IntelligenceDashboard with Living Handover monitor and simulate button', async () => {
    await renderScreen(<IntelligenceDashboard />, 'engineering_lead', '/cases/case-001/intelligence');

    await waitFor(() => {
      expect(screen.getByText(/Post-Approval Evidence Drift Monitor/i)).toBeDefined();
    });

    expect(screen.getByText(/Living Handover Invariant/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Simulate Drift/i })).toBeDefined();
    expect(screen.getByText(/Inspect Handover/i)).toBeDefined();
  });

  it('restricts contractor from resolving re-review items', async () => {
    await renderScreen(<Handover />, 'contractor');

    await waitFor(() => {
      expect(screen.getByText(/Handover Document/i)).toBeDefined();
    });

    // Contractor must not see lead actions or Re-Review Queue button
    expect(screen.queryByRole('button', { name: /Re-Review Queue/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Release to Successor/i })).toBeNull();
  });
});
