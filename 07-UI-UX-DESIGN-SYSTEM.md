# 07 — UI/UX Design System

(Colors/fonts already defined in `00-OVERVIEW`. This file covers components, states, and interaction patterns.)

## 1. Core Components

**Buttons**
- Primary: solid `--nx-primary`, white text, `--nx-radius-sm`, 10px/16px padding, hover darkens to `--nx-primary-dark`
- Secondary: white bg, `--nx-border` outline, `--nx-text-primary` text
- Danger: outline red, fills solid on hover (used for Reject/Delete)
- Icon-only buttons: 32px square, ghost style, tooltip on hover

**Status Pills** (used everywhere — leave, expense, letters, resignation status)
```css
.pill{padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}
.pill-pending{background:#FEF3C7;color:#92400E}
.pill-approved{background:#DCFCE7;color:#166534}
.pill-rejected{background:#FEE2E2;color:#991B1B}
.pill-cancelled{background:#F3F4F6;color:#6B7280}
```

**Cards**: `--nx-surface` bg, `--nx-shadow-card`, `--nx-radius-md`, 16–20px padding, optional top accent bar (2px, colored by category) for reward/appraisal cards.

**Tables**
- Sticky header row, `--nx-bg` header background, uppercase 11px letter-spaced labels
- Row height 48px (comfortable) / 36px (compact) — density toggle top-right of every table
- Sortable column headers (chevron indicator)
- Row actions in a trailing "⋯" kebab menu (Edit/View/Delete/etc.) to keep rows clean
- Sticky first column for wide tables (e.g. employee name in attendance reports)

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
