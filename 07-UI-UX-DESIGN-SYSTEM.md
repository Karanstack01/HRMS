# 07 — UI/UX Design System
(Reflects StackDrove HRMS Branding & UI Style Guide Version 1.0)

## 1. Core Components

**Buttons**
- Primary: solid Royal Blue `--sd-primary` (`#2563EB`), white text, `--sd-radius-md` (10px), 9px/18px padding, hover darkens to `#1D4ED8`
- Secondary: white bg (`#FFFFFF`), `--sd-border` (`#E5E7EB`) outline, `--sd-text-primary` (`#232D3C`) text
- Destructive: solid Danger Red (`#DC2626`), fills with hover to `#B91C1C` (used for Reject / Delete / Cancel)
- Success: Bright Green (`#22C55E`), used only for semantically positive actions
- Icon-only buttons: 36px circular or rounded, subtle border, ghost hover

**Status Pills** (Strictly adhering to Section 7 Status Semantics)
```css
.pill { padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; line-height: 1.2; text-transform: capitalize; }
.pill-approved, .pill-present, .pill-active { background: #DCFCE7; color: #15803D; } /* #22C55E Green */
.pill-pending, .pill-review { background: #EFF6FF; color: #1D4ED8; }                 /* #2563EB Royal Blue */
.pill-draft, .pill-neutral { background: #F1F5F9; color: #475569; }                  /* #64748B Gray */
.pill-warning, .pill-late, .pill-halfday { background: #FEF3C7; color: #B45309; }    /* #D97706 Amber */
.pill-rejected, .pill-absent, .pill-failed { background: #FEE2E2; color: #B91C1C; }  /* #DC2626 Red */
```

**Cards**: `--sd-surface` (`#FFFFFF`) bg, `--sd-border` (`#E5E7EB`) 1px border, `--sd-radius-md` to `--sd-radius-lg` (10–14px), 20–24px padding. No floating glassmorphism, gradients, or excessive shadows.

**Tables**
- Sticky header row, `--sd-surface-subtle` (`#F8FAFC`) header background, uppercase 11px letter-spaced labels (`#64748B`)
- Row height 44–48px (comfortable) / 36px (compact)
- Sortable column headers
- Trailing row action buttons / pills to keep rows scannable
- Border dividers: 1px `--sd-border` (`#E5E7EB`)

**Filter Bar** (consistent across all list modules)
- Left-aligned: search input with icon (`🔍`), 280px wide, instant debounce filter
- Right-aligned: dropdown filter chips (department, status, date range) — each shows active-count badge when filters applied, "Clear all" link appears once any filter is active
- Below on mobile: filter bar collapses into a single "Filters (2)" button opening a bottom sheet

**Modals**
- Centered, `--nx-shadow-modal`, max-width 560px (forms) / 800px (detail views)
- Header: title + close X; Footer: right-aligned Cancel (ghost) + primary action button
- Multi-step modals (e.g. Add Employee) show a horizontal stepper at top

**Toasts**
- Bottom-right, auto-dismiss 4s, success (green left border), error (red left border), color-coded icon

**Empty States**
- Centered illustration (simple line-icon, not stock photo) + one-line message + primary CTA if applicable
- e.g. Leave → My Requests empty: "No leave taken yet" + "Apply for Leave" button

**Loading States**
- Skeleton screens (gray animated blocks matching card/table shape) — never a spinner-only blank page, so the layout doesn't jump

**Error States**
- Inline red text under form fields for validation
- Full-section error card with "Retry" button for failed data fetches (network/GAS timeout)

## 2. Calendar Components (Attendance / Leave / Holidays)
- Month grid, 7-column CSS grid, each day cell: date number top-left, colored dot/bar for status, click opens detail popover (not full modal — keeps flow light)
- Color legend strip always visible above the calendar

## 3. Navigation & Wayfinding
- Sidebar active item: `--nx-sidebar-active` background, white text, left 3px accent bar
- Breadcrumb in topbar: `Module / Sub-tab` (e.g. `Leave / Approvals`)
- Notification bell: red dot badge for unread, dropdown list grouped by module, "Mark all read"
- Global search (topbar): searches across Directory + Policies titles + Letters — results grouped by type in a dropdown

## 4. Responsive Rules
| Breakpoint | Behavior |
|---|---|
| ≥1280px | Full sidebar (240px), 3–4 col card grids |
| 1024–1279px | Sidebar auto-collapses to icons, tooltip on hover |
| 768–1023px | Sidebar becomes off-canvas drawer (hamburger toggle), 2-col grids |
| <768px | Single column, tables convert to stacked card-per-row layout, filter bar becomes bottom-sheet |

## 5. Accessibility Baseline
- All interactive elements keyboard-focusable with visible focus ring (`outline:2px solid var(--nx-primary)`)
- Color is never the only status indicator — pills always carry text, calendar dots paired with legend
- Minimum tap target 40px on mobile
- Form labels always visible (no placeholder-only labels)

## 6. Motion
- Transitions kept to 150–200ms ease-out for hover/press states only
- Module switch: simple fade (120ms), no heavy page-transition animation (keeps GAS's HTML Service feeling snappy rather than gimmicky)

## 7. Reference Screen Inventory (for Antigravity to build against)
1. Login/Unauthorized screen
2. Dashboard (3 role variants)
3. Directory — Grid view, Table view, Detail drawer, Add/Edit modal, Org chart
4. Attendance — My Attendance calendar, Team table, Reports/export screen
5. Leave — Apply form, My Requests, Team Calendar, Approvals queue
6. Holiday Calendar — List + Calendar toggle
7. Policies — Category grid, PDF viewer + acknowledge
8. Assets — My Assets, Request form, Inventory table, Assign modal
9. Rewards — Wall of Fame feed, Give Recognition form
10. Appraisals — Cycle stepper, Self-review form, Manager rating table, HR calibration grid
11. Travel & Expenses — New request tabs, My Requests, Approvals, Finance table
12. Letters — Request form, My Letters table, HR generation queue
13. Payroll — My Payslips, Payslip viewer, HR Process Payroll draft table
14. Resignation — Submit form, Status stepper, HR clearance checklist
15. Profile — Tabbed profile editor
16. Admin Console — Org setup, Roles, Leave policy config, Email templates, Audit log
17. Standalone Attendance.html
18. Standalone Leave.html
