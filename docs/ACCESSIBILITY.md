# Accessibility & Quality Gates Audit Report

**Specification Version:** WCAG 2.1 Level AA Compliance  
**Audit Date:** November 2026  
**Auditing Engines:** `axe-core` 4.10.3 / `vitest-axe` 4.0.0, deterministic Python contrast analyzer (`relay/scripts/measure_contrast.py`)  
**Scope:** RELAY AI Web Application (`relay/web`) across all responsive breakpoints and theme modes.

---

## 1. Executive Summary

RELAY AI provides empirical, test-backed accessibility compliance conforming to **WCAG 2.1 Level AA**. Rather than resting on self-attested claims, accessibility is enforced via automated test gates in CI/CD:

1. **Automated Axe-Core Audits:** **32 screen/viewport/theme permutations** audited across 4 viewports (390px, 768px, 1024px, 1440px) in both Light and Dark modes. **Zero critical violations, zero serious violations.**
2. **Palette Contrast Verification:** **26/26 semantic token pairings (100%)** meet or exceed WCAG AA contrast thresholds (minimum 4.5:1 for body text, 3:1 for large text/UI borders). Full JSON report logged in `relay/eval/contrast_report.json`.
3. **Keyboard Complete Operation:** Full triage workflow is executable without a pointing device (`J`/`K` navigation, `A`/`R`/`E`/`U`/`Z` actions, `?` shortcuts cheat sheet).
4. **Focus Traps & Focus Restoration:** All modal dialogs and slide-out drawers (Evidence Drawer, Version History, Side-by-Side Diff, Pre-Flight Checklist, Ask Lead Dialog, Batch Confirmation) implement robust focus traps with Tab wrapping, Escape dismiss, and automatic focus restoration to the trigger element.
5. **Non-Color-Only Status Cues:** All state indicators, provenance tiers, and diff views use shape, icon (`✓`, `✎`, `≈`, `?`), border styling, and text labels in addition to monochromatic contrast.
6. **Reduced Motion:** Fully honors `prefers-reduced-motion: reduce`, dropping animation iterations and transition durations to `0.01ms`.

---

## 2. Testing Methodology & Tooling

Accessibility testing is integrated into the automated test runner:

- **Runner:** `vitest` with `@testing-library/react` and `vitest-axe`.
- **Axe-core Rule Engine:** Evaluates DOM trees against WCAG 2.0 / 2.1 rules (`wcag2a`, `wcag2aa`, `wcag21aa`, `cat.aria`, `cat.keyboard`, `cat.color`, `cat.name-role-value`).
- **Test File:** `relay/web/src/tests/AccessibilityAxe.test.tsx` (37 automated tests).
- **Execution Command:**
  ```bash
  cd relay/web && npx vitest run src/tests/AccessibilityAxe.test.tsx
  ```

### Responsive Viewports & Themes Matrix
Every primary screen was rendered into an active JSDOM instance at four responsive widths in both Light (`:root`) and Dark (`[data-theme="dark"]`) themes:
- **390px:** Mobile viewport (compact stacked navigation, mobile triage layout)
- **768px:** Tablet viewport (hybrid layout, adaptive header controls)
- **1024px:** Small desktop / laptop viewport (standard 3-pane navigation)
- **1440px:** Wide desktop monitor (full multi-column evidence layout)

---

## 3. Screen Test Matrix & Axe Audit Results

| Screen | Viewport | Theme | Target Component | Critical Violations | Serious Violations | Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Handover / Triage** | 390px | Light | `Handover.tsx` | 0 | 0 | **PASS** |
| **Handover / Triage** | 390px | Dark | `Handover.tsx` | 0 | 0 | **PASS** |
| **Handover / Triage** | 768px | Light | `Handover.tsx` | 0 | 0 | **PASS** |
| **Handover / Triage** | 768px | Dark | `Handover.tsx` | 0 | 0 | **PASS** |
| **Handover / Triage** | 1024px | Light | `Handover.tsx` | 0 | 0 | **PASS** |
| **Handover / Triage** | 1024px | Dark | `Handover.tsx` | 0 | 0 | **PASS** |
| **Handover / Triage** | 1440px | Light | `Handover.tsx` | 0 | 0 | **PASS** |
| **Handover / Triage** | 1440px | Dark | `Handover.tsx` | 0 | 0 | **PASS** |
| **Cases Dashboard** | 390px | Light | `Cases.tsx` | 0 | 0 | **PASS** |
| **Cases Dashboard** | 390px | Dark | `Cases.tsx` | 0 | 0 | **PASS** |
| **Cases Dashboard** | 768px | Light | `Cases.tsx` | 0 | 0 | **PASS** |
| **Cases Dashboard** | 768px | Dark | `Cases.tsx` | 0 | 0 | **PASS** |
| **Cases Dashboard** | 1024px | Light | `Cases.tsx` | 0 | 0 | **PASS** |
| **Cases Dashboard** | 1024px | Dark | `Cases.tsx` | 0 | 0 | **PASS** |
| **Cases Dashboard** | 1440px | Light | `Cases.tsx` | 0 | 0 | **PASS** |
| **Cases Dashboard** | 1440px | Dark | `Cases.tsx` | 0 | 0 | **PASS** |
| **System Boundaries** | 390px | Light | `Limits.tsx` | 0 | 0 | **PASS** |
| **System Boundaries** | 390px | Dark | `Limits.tsx` | 0 | 0 | **PASS** |
| **System Boundaries** | 768px | Light | `Limits.tsx` | 0 | 0 | **PASS** |
| **System Boundaries** | 768px | Dark | `Limits.tsx` | 0 | 0 | **PASS** |
| **System Boundaries** | 1024px | Light | `Limits.tsx` | 0 | 0 | **PASS** |
| **System Boundaries** | 1024px | Dark | `Limits.tsx` | 0 | 0 | **PASS** |
| **System Boundaries** | 1440px | Light | `Limits.tsx` | 0 | 0 | **PASS** |
| **System Boundaries** | 1440px | Dark | `Limits.tsx` | 0 | 0 | **PASS** |
| **Landing Screen** | 390px | Light | `Landing.tsx` | 0 | 0 | **PASS** |
| **Landing Screen** | 390px | Dark | `Landing.tsx` | 0 | 0 | **PASS** |
| **Landing Screen** | 768px | Light | `Landing.tsx` | 0 | 0 | **PASS** |
| **Landing Screen** | 768px | Dark | `Landing.tsx` | 0 | 0 | **PASS** |
| **Landing Screen** | 1024px | Light | `Landing.tsx` | 0 | 0 | **PASS** |
| **Landing Screen** | 1024px | Dark | `Landing.tsx` | 0 | 0 | **PASS** |
| **Landing Screen** | 1440px | Light | `Landing.tsx` | 0 | 0 | **PASS** |
| **Landing Screen** | 1440px | Dark | `Landing.tsx` | 0 | 0 | **PASS** |

*All 32 parameterized screen permutations resulted in zero serious or critical violations.*

---

## 4. Color Palette Contrast Verification

Contrast calculations follow the W3C WCAG 2.1 specification:
$$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
where $L_1$ is the relative luminance of the lighter color and $L_2$ is the relative luminance of the darker color. Relative luminance $L$ is calculated from sRGB components:
$$L = 0.2126 R + 0.7152 G + 0.0722 B$$
where $C = c / 12.92$ when $c \le 0.04045$, and $C = ((c + 0.055) / 1.055)^{2.4}$ when $c > 0.04045$.

The deterministic script `relay/scripts/measure_contrast.py` extracts active CSS custom properties from `web/src/index.css` and computes actual ratios against standard background surfaces.

### Token Calibration
During our empirical audit, `--ink-tertiary` was recalibrated to guarantee AA compliance across all background surfaces:
- **Light mode:** Updated from `#767676` (4.35:1 on `#FAFAFA`) to `#6E6E6E` (4.89:1 on `#FAFAFA`, 5.10:1 on `#FFFFFF`, 4.64:1 on `#F4F4F4`).
- **Dark mode:** Updated from `#888888` (4.27:1 on `#262626`) to `#949494` (6.18:1 on `#121212`, 5.50:1 on `#1E1E1E`, 4.99:1 on `#262626`).

### Contrast Audit Results Table

#### Light Theme (`:root`)
| Context | Foreground Hex | Background Hex | Measured Ratio | WCAG AA Threshold | Status |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Primary Text on Page Base | `#111111` | `#FAFAFA` | **18.09:1** | 4.5:1 | **PASS** |
| Primary Text on Card Surface | `#111111` | `#FFFFFF` | **18.88:1** | 4.5:1 | **PASS** |
| Primary Text on Elevated Surface | `#111111` | `#F4F4F4` | **17.17:1** | 4.5:1 | **PASS** |
| Secondary Body Text on Page Base | `#555555` | `#FAFAFA` | **7.14:1** | 4.5:1 | **PASS** |
| Secondary Body Text on Card Surface | `#555555` | `#FFFFFF` | **7.46:1** | 4.5:1 | **PASS** |
| Secondary Text on Elevated Surface | `#555555` | `#F4F4F4` | **6.78:1** | 4.5:1 | **PASS** |
| Tertiary Metadata / Timestamps on Base | `#6E6E6E` | `#FAFAFA` | **4.89:1** | 4.5:1 | **PASS** |
| Tertiary Metadata / Citations on Card | `#6E6E6E` | `#FFFFFF` | **5.10:1** | 4.5:1 | **PASS** |
| Tertiary Labels on Elevated Surface | `#6E6E6E` | `#F4F4F4` | **4.64:1** | 4.5:1 | **PASS** |
| Solid Primary Button Label | `#FFFFFF` | `#111111` | **18.88:1** | 4.5:1 | **PASS** |
| Secondary Button Label | `#111111` | `#FFFFFF` | **18.88:1** | 4.5:1 | **PASS** |
| Navigation Link on Sidebar | `#111111` | `#F4F4F4` | **17.17:1** | 4.5:1 | **PASS** |
| Secondary Navigation on Sidebar | `#555555` | `#F4F4F4` | **6.78:1** | 4.5:1 | **PASS** |

#### Dark Theme (`[data-theme="dark"]`)
| Context | Foreground Hex | Background Hex | Measured Ratio | WCAG AA Threshold | Status |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Primary Text on Page Base | `#EDEDED` | `#121212` | **16.00:1** | 4.5:1 | **PASS** |
| Primary Text on Card Surface | `#EDEDED` | `#1E1E1E` | **14.24:1** | 4.5:1 | **PASS** |
| Primary Text on Elevated Surface | `#EDEDED` | `#262626` | **12.93:1** | 4.5:1 | **PASS** |
| Secondary Body Text on Page Base | `#A8A8A8` | `#121212` | **7.88:1** | 4.5:1 | **PASS** |
| Secondary Body Text on Card Surface | `#A8A8A8` | `#1E1E1E` | **7.01:1** | 4.5:1 | **PASS** |
| Secondary Text on Elevated Surface | `#A8A8A8` | `#262626` | **6.36:1** | 4.5:1 | **PASS** |
| Tertiary Metadata / Timestamps on Base | `#949494` | `#121212` | **6.18:1** | 4.5:1 | **PASS** |
| Tertiary Metadata / Citations on Card | `#949494` | `#1E1E1E` | **5.50:1** | 4.5:1 | **PASS** |
| Tertiary Labels on Elevated Surface | `#949494` | `#262626` | **4.99:1** | 4.5:1 | **PASS** |
| Solid Primary Button Label | `#121212` | `#EDEDED` | **16.00:1** | 4.5:1 | **PASS** |
| Secondary Button Label | `#EDEDED` | `#1E1E1E` | **14.24:1** | 4.5:1 | **PASS** |
| Navigation Link on Sidebar | `#EDEDED` | `#181818` | **15.17:1** | 4.5:1 | **PASS** |
| Secondary Navigation on Sidebar | `#A0A0A0` | `#181818` | **6.79:1** | 4.5:1 | **PASS** |

*Overall: 26 out of 26 evaluated pairings (100%) meet WCAG AA standards.*

---

## 5. Keyboard Navigation & Interaction Guide

RELAY AI provides keyboard interaction for all core workflows without requiring mouse clicks.

### Global Shortcuts & Triage Review
When on the Handover triage screen (`/cases/:caseId/handover`):

| Key Binding | Action | Description |
| :---: | :--- | :--- |
| `J` | **Next Triage Item** | Navigates down to the subsequent claim or continuation task. |
| `K` | **Previous Triage Item** | Navigates up to the previous claim or continuation task. |
| `A` | **Accept / Verify Claim** | Marks the focused claim as Verified with explicit timestamp and actor ID. |
| `R` | **Reject / Question Claim** | Flags the focused claim for clarification or review. |
| `E` | **Edit Inline** | Opens an inline markdown editor with keyboard focus for modifying claim text. |
| `U` or `Z` | **Undo Action** | Restores the previous review status of the claim. |
| `?` | **Shortcuts Cheat Sheet** | Opens the accessible keyboard shortcuts dialog. |
| `Escape` | **Dismiss Active Dialog/Drawer** | Closes any open modal dialog or slide-out drawer, returning focus to the trigger. |

### Focus Management & Trapping
- **Evidence Drawer (`EvidenceDrawer.tsx`):**
  When a user opens evidence citations from a provenance badge, focus immediately shifts inside the drawer to the close button (`Close evidence panel`). The drawer maintains a focus trap ensuring Tab and Shift+Tab cycle within drawer interactive elements. Dismissing the drawer (via `Escape` or the close button) automatically returns DOM focus to the button that originally triggered it.
- **Modal Dialogs (`useModalFocusTrap.ts`):**
  A custom React hook (`useModalFocusTrap`) manages focus lifecycle for all 6 system modals:
  1. *Version History Modal*
  2. *Side-by-Side Diff Modal*
  3. *Batch Review Confirmation Modal*
  4. *Pre-Flight Checklist Modal*
  5. *Ask Lead Clarification Modal*
  6. *Keyboard Shortcuts Cheat Sheet*
  
  When opened, focus is automatically moved to the first focusable element. When Tab reaches the last focusable element, it wraps to the first; Shift+Tab on the first element wraps to the last. Pressing `Escape` closes the modal, and the trigger element is refocused.
- **Role Switcher (`TopBar.tsx`):**
  The Demo Role Switcher uses a standard `<select>` element with explicit label association (`<label htmlFor="topbar-role">Viewing as:</label>`) and an accessible name (`aria-label="Demo Authentication Role Switcher"`). Users can Tab to the control and change roles using Arrow Up / Down keys.
- **Focus Rings:**
  All interactive controls (buttons, links, inputs, checkboxes) feature visible, high-contrast 2px focus rings (`focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400 focus:outline-none`).

---

## 6. Non-Color-Only Status Cues & Reduced Motion

In compliance with WCAG 1.4.1 (Use of Color), no state, provenance level, or diff status is communicated solely through color hue.

### Provenance Badges
Each provenance badge conveys meaning through text, symbols, and border styles:
- **`VERIFIED`:** Includes checkmark symbol (`✓`), solid border (`border-edge-strong`), uppercase text `"VERIFIED"`, and an informative ARIA label (`aria-label="Provenance: VERIFIED. Click to inspect supporting evidence in drawer"`).
- **`STATED`:** Includes pencil symbol (`✎`), solid border (`border-edge-strong`), uppercase text `"STATED"`, and descriptive ARIA label (`aria-label="Provenance: STATED. Click to inspect supporting evidence in drawer"`).
- **`INFERRED`:** Includes approximate symbol (`≈`), dashed border (`border-dashed border-edge-strong`), uppercase text `"INFERRED"`, and descriptive ARIA label (`aria-label="Provenance: INFERRED. Click to inspect supporting evidence in drawer"`).
- **`UNKNOWN`:** Includes question mark (`?`), dotted border (`border-dotted border-edge-strong`), uppercase text `"UNKNOWN"`, and descriptive ARIA label (`aria-label="Provenance: UNKNOWN. Click to inspect supporting evidence in drawer"`).

### Side-by-Side Diffing
The text diff viewer in `Handover.tsx` pairs red/green line highlighting with explicit textual prefixes:
- Additions are marked with a leading `+` symbol, green text, and a distinct left border.
- Deletions are marked with a leading `-` symbol, red text, and a distinct left border.
- Unchanged lines are marked with leading spaces and neutral ink color.

### Respecting User Motion Preferences
RELAY AI defines reduced motion rules in `web/src/index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
When a user activates the OS-level "Reduce Motion" setting, all pulse animations, slide transitions, and micro-interactions are instantly minimized to imperceptible transitions (0.01ms).

---

## 7. Known Gaps & Exceptions (Honest Disclosure)

In adherence to engineering integrity, the following minor limitations are documented:

1. **Complex SVG Topology & Dependency Graphs:**
   The interactive system boundaries diagram and architectural chord views provide container-level accessible summaries (`role="region"`, `aria-label`, and text fallbacks). However, individual interconnected bezier curves and dynamic node clusters in SVG do not yet support sequential per-edge keyboard arrow traversal. A tabular summary of all system boundaries is rendered below the chart as an accessible alternative.
2. **Visual Image Diffs (Screenshot Comparison):**
   When comparing visual screenshots across artifact versions, RELAY provides side-by-side images with metadata and structured text diff fallbacks. Pixel-by-pixel visual difference maps do not have automated semantic audio descriptions beyond textual change summaries.
3. **WCAG AAA Compliance on Tertiary Metadata:**
   While **100% of text pairings satisfy WCAG AA (≥ 4.5:1)**, five muted tertiary metadata pairings on elevated backgrounds measure between `4.64:1` and `6.79:1`. These meet Level AA requirements but do not meet the optional Level AAA threshold (≥ 7.0:1) to prevent metadata labels from visually competing with primary body copy.
