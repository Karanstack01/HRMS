# StackDrove HRMS — Enterprise HRMS on Google Apps Script
### Complete System Documentation — v1.0
Prepared for: Antigravity (build agent) | Prepared by: Karan Singh Rawat (StackDrove)

---

## 1. System Identity

| Item | Value |
|---|---|
| Company Name | **StackDrove** |
| System Name | **StackDrove HRMS** |
| Tagline | **"Build. Automate. Scale."** |
| Business Positioning | Business Systems Engineering & Operations Automation |
| Target Scale | 100–500 employee organizations, single or multi-location |
| Stack | Google Apps Script (server), HTML Service (client), Google Sheets (DB), Drive (files), Gmail (mail), CacheService/PropertiesService (session & config) |
| Architecture Style | Single Web App (doGet/doPost) + client-side SPA shell with hash-routed sections |
| Auth Model | Google Workspace domain login (Session.getActiveUser) + internal Employee Directory role mapping |
| Roles | Admin, HR, Manager, Employee (4-tier RBAC, extensible to 5 with "Finance" for payroll) |

## 2. Brand & Visual Identity (Style Guide v1.0)

**Color System (CSS Variables)**
```css
:root {
  /* Brand Tokens - Controlled Working Palette */
  --sd-navy: #0B1635;             /* StackDrove Navy: Primary brand / sidebar / headings */
  --sd-primary: #2563EB;          /* Royal Blue: Primary action / active states / links */
  --sd-primary-dark: #1D4ED8;
  --sd-primary-light: #EFF6FF;
  --sd-accent-green: #22C55E;     /* Bright Green: Success / positive accent (use sparingly) */
  --sd-accent-green-light: #DCFCE7;
  
  --sd-bg: #F5F7FA;               /* Soft Gray: Page background / section separation */
  --sd-surface: #FFFFFF;          /* White: Primary surface / cards / forms */
  --sd-surface-subtle: #F8FAFC;
  --sd-border: #E5E7EB;           /* Border Gray: Borders / dividers */
  --sd-border-light: #F1F5F9;
  
  --sd-text-primary: #232D3C;     /* Text Charcoal: Primary body text */
  --sd-text-secondary: #4B5563;
  --sd-text-muted: #64748B;       /* Muted Text: Secondary metadata */
  
  --sd-danger: #DC2626;           /* Danger Red: Errors / destructive actions */
  --sd-warning: #D97706;          /* Warning Amber: Warnings / attention states */
  --sd-success: #22C55E;          /* Bright Green: Approved / present */

  /* Navigation Chrome */
  --sd-sidebar-bg: #0B1635;       /* Dark Navy Surface */
  --sd-sidebar-text: #94A3B8;
  --sd-sidebar-text-active: #FFFFFF;
  --sd-sidebar-active: #2563EB;   /* Royal Blue active navigation item */
  --sd-sidebar-hover: rgba(255, 255, 255, 0.08);

  /* Geometry & Rules */
  --sd-radius-sm: 6px;
  --sd-radius-md: 10px;           /* 10-14px card radius */
  --sd-radius-lg: 12px;
  --sd-radius-xl: 14px;
  --sd-shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
}
```

**Status Semantics**
| Status Family | HEX | Rule |
|---|---|---|
| **Approved / Active / Present** | `#22C55E` | Green |
| **Pending / In Review** | `#2563EB` | Blue |
| **Draft / Neutral** | `#64748B` | Gray |
| **Warning / Late / Action Needed** | `#D97706` | Amber |
| **Rejected / Absent / Failed** | `#DC2626` | Red |

**Typography**
- Primary font stack: `Aptos, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- Page Title: Display Bold 28–32px, color `#0B1635`
- Section Heading: Bold 18–22px, color `#0B1635`
- Card Heading: Semibold 14–16px, color `#0B1635` or `#232D3C`
- Body Text: Regular 13–14px, color `#232D3C`
- Table Data: Regular 12–13px, color `#232D3C`
- Metadata: Regular 11–12px, color `#64748B`
- Buttons: Semibold 13–14px

**Non-Negotiable Brand Rules**
- Official StackDrove logo used without distortion.
- Navy (`#0B1635`) + Royal Blue (`#2563EB`) create the primary visual hierarchy.
- Green is used as a controlled positive accent, not a dominant background.
- White (`#FFFFFF`) cards and Soft Gray (`#F5F7FA`) canvas keep information clear and easy to scan.
- No gradients, floating glassmorphism, or excessive shadows.

**Layout Shell**
- Fixed left sidebar: 250px, dark navy surface (`#0B1635`), light text, royal blue active item.
- Top bar: 64px, `#FFFFFF` background, 1px `#E5E7EB` border, global search + live clock + quick punch + profile avatar.
- Content area: Soft Gray (`#F5F7FA`) background, 24–32px consistent padding.
- Cards: 10–14px radius, `#FFFFFF` surface, subtle `#E5E7EB` border, minimal shadow.
- Tables: Sticky header, compact row heights, uppercase 11px letter-spaced headers, clear status badges.

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
