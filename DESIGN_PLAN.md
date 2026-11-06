# RELAY AI Design Plan

## Color Tokens

```
--paper: #F3F5F2 (cool green-grey base)
--ink: #18212F (deep blue for text)
--focus: #4A6FA5 (restrained blue accent)
--inferred: #6B7280 (slate)
--stated: #C27830 (ochre)
--verified: #2D6A4F (green)
--conflict: #9B2C2C (brick red)
--risk-low: #E8EDF0
--risk-mid: #9DB4C6
--risk-high: #4A6FA5
```

## Type Roles

- **Interface**: Schibsted Grotesk - 13/15/17/21/28/40px, line-height 1.5
- **Reading**: Literata - 15/17px, line-height 1.6, under 75 chars
- **Code**: JetBrains Mono - 13px, tabular figures for scores

## Layout Structure

**Desktop (1440px+): Three-pane workbench**
```
┌──────────┬─────────────────────┬─────────────────┐
│  Nav     │   Main Reading      │  Source Pane    │
│  240px   │   Flexible         │  320-400px      │
│          │                     │  (slides in)    │
│  Case    │   [Content varies  │                 │
│  Outline │    by screen]       │  [Original      │
│          │                     │   artifact with │
│          │                     │   highlight]    │
└──────────┴─────────────────────┴─────────────────┘
```

**Mobile (390px): Stacked with sheets**
```
┌─────────────────┐
│  Menu (top bar) │
├─────────────────┤
│                 │
│  Main Content   │
│                 │
│                 │
└─────────────────┘
[Source: bottom sheet on citation tap]
```

## Screens

### 1. Cases
Plain table with columns: case, repo, leaver, status, source banner, last run.

### 2. Knowledge Radar
Treemap of repo directories. Color = risk (sequential ramp). Click opens breakdown in source pane showing: share, bench strength, doc coverage, criticality, formula.

### 3. Work Timeline
Dense list grouped by component. Indented relations show links with method badges. Each row clickable to source pane.

### 4. Findings
Two-column list: hidden deps | inflight work, contradictions, undocumented decisions. Side-by-side evidence for contradictions with confidence and actions.

### 5. Interview
Conversation layout. Question with evidence inline + reason. Answer textarea. Accepted answers become handover items marked "stated by [person]".

### 6. Handover
Serif reading layout. Provenance marks in margin. Citations open source pane. Quiet top bar with approve/release controls.

### 7. Completeness Test
Task description. Required facts checklist. Agent run transcript. Score with spread. Facts flip to found as results arrive. Previous/current score shown after re-run.

### 8. Admin
Sources table, identity overrides table, audit log table.

## Principles

1. **Source pane is the signature element** - invest interaction design here
2. **Disciplined everywhere else** - minimal decoration
3. **Semantic color only** - provenance colors used consistently
4. **No decorative motion** - only functional transitions
5. **Reading-first** - handover is a document, not a dashboard
6. **Evidence required** - nothing ships without citations
7. **Single sequential risk ramp** - no RAG traffic lights

## What Changed from Generic Defaults

- Removed: hero sections, stat cards, gradient backgrounds, rounded cards everywhere
- Added: three-pane workbench with source focus, provenance color system, two-type families for interface vs reading
- Refined: treemap visualization instead of widget dashboard, sequential risk colors instead of categorical
- Emphasized: source pane interaction as the distinctive product element
