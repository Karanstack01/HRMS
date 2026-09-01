# StackDrove HRMS — Enterprise HRMS on Google Apps Script
### Complete System Documentation — v1.0
Prepared for: Antigravity (build agent) | Prepared by: Karan Singh Rawat (StackDrove)

---

## 1. System Identity

| Item | Value |
|---|---|
| System Name | **StackDrove HRMS** |
| Tagline | "One system. Every employee moment." |
| Target Scale | 100–500 employee organizations, single or multi-location |
| Stack | Google Apps Script (server), HTML Service (client), Google Sheets (DB), Drive (files), Gmail (mail), CacheService/PropertiesService (session & config) |
| Architecture Style | Single Web App (doGet/doPost) + client-side SPA shell with hash-routed sections |
| Auth Model | Google Workspace domain login (Session.getActiveUser) + internal Employee Directory role mapping |
| Roles | Admin, HR, Manager, Employee (4-tier RBAC, extensible to 5 with "Finance" for payroll) |

## 2. Brand & Visual Identity

**Color System (CSS variables)**
```css
:root{
  --sd-primary:#4F46E5;      /* Indigo 600 - primary actions, active nav */
  --sd-primary-dark:#3730A3;
  --sd-primary-light:#EEF2FF;
  --sd-secondary:#0EA5A4;    /* Teal - success/positive metrics */
  --sd-accent:#F59E0B;       /* Amber - pending/attention states */
  --sd-danger:#EF4444;       /* Rejections, errors, absent */
  --sd-success:#22C55E;      /* Approved, present */
  --sd-bg:#F6F7FB;           /* App background */
  --sd-surface:#FFFFFF;      /* Cards, panels */
  --sd-border:#E5E7EB;
  --sd-text-primary:#111827;
  --sd-text-secondary:#6B7280;
  --sd-text-muted:#9CA3AF;
  --sd-sidebar-bg:#111827;   /* Dark sidebar for premium feel */
  --sd-sidebar-text:#D1D5DB;
  --sd-sidebar-active:#4F46E5;
  --sd-radius-sm:6px;
  --sd-radius-md:10px;
  --sd-radius-lg:16px;
  --sd-shadow-card:0 1px 3px rgba(16,24,40,.08), 0 1px 2px rgba(16,24,40,.04);
  --sd-shadow-modal:0 20px 25px -5px rgba(16,24,40,.15);
}
```

**Typography**
- Primary font: `Inter` (Google Fonts CDN) — UI text, tables, forms
- Numeric/metric font: `Inter` with `font-variant-numeric: tabular-nums` for dashboards
- Headings: Inter 600/700
- Base size: 14px body, 13px table cells, 12px meta text, 20–28px section headers
- Line-height: 1.5 body, 1.25 headings

**Iconography**: Lucide icons (inline SVG, no external runtime dependency issues in GAS — icons embedded as SVG strings in a shared `Icons.html` partial).

**Layout Shell**
- Fixed left sidebar: 240px expanded / 64px collapsed (icon-only), dark theme (`--sd-sidebar-bg`)
- Top bar: 64px, breadcrumb + global search + notification bell + profile avatar dropdown
- Content area: max-width 1440px, 24px gutter padding, responsive to 1024px (sidebar auto-collapses), 768px (sidebar becomes off-canvas drawer)
- Card grid: CSS grid, `repeat(auto-fill, minmax(280px,1fr))`, 16px gap
- Tables: sticky header, zebra-free (flat white rows, 1px `--sd-border` dividers), row hover `--sd-primary-light`, density toggle (comfortable/compact)

## 3. Sidebar — Module List (in order)

1. Dashboard (home — role-specific widgets)
2. Directory
3. Attendance
4. Leave
5. Holiday Calendar
6. Company Policies
7. Assets
8. Rewards & Recognition
9. My Appraisals
10. Travel & Expenses
11. My Letters
12. My Payroll
13. Resignation
14. My Profile
15. Admin Console (visible to Admin/HR only — pinned bottom, separated by divider)

Each module is a **separate hash route** (`#/attendance`, `#/leave`, etc.) rendered into a single `<div id="app-content">` via `google.script.run` calls that return JSON payloads — no full page reloads. This is what makes it feel like a modern SPA even inside GAS's HTML Service.

## 4. Documents Included in This Package

1. `00-OVERVIEW-AND-SYSTEM-IDENTITY.md` (this file)
2. `01-ARCHITECTURE.md` — technical architecture, file structure, execution model
3. `02-DATA-MODEL.md` — every Google Sheet, every column, every relationship
4. `03-RBAC-AND-BUSINESS-LOGIC.md` — role matrix + core logic (sandwich leave, holiday skip, approval chains)
5. `04-MODULE-SPECS.md` — feature-by-feature spec for all 14 modules
6. `05-EMAIL-SYSTEM.md` — every triggered email, template, and trigger condition
7. `06-ATTENDANCE-LEAVE-STANDALONE-FORMS.md` — the two independent HTML forms and their sync logic
8. `07-UI-UX-DESIGN-SYSTEM.md` — components, states, filters, search, empty/loading/error states
9. `08-IMPLEMENTATION-PLAN-TASKS.md` — the Antigravity task breakdown (phases, tasks, acceptance criteria)
10. `09-CODE-STRUCTURE-AND-CONVENTIONS.md` — file/function naming, apps script project layout, sample core functions

Read them in this order once — then `08` is the working checklist during build.
