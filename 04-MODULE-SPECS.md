# 04 — Module-by-Module Feature Specs

Each module below lists: **Views**, **Filters/Search**, **Card & Table behavior**, **Actions per role**, **Empty/Edge states**.

---
## 1. Dashboard
- **Employee view**: attendance-this-month ring chart, leave balance cards (per type), pending approvals (none), upcoming holidays strip, birthday/anniversary shoutouts, quick-punch button, latest policy updates.
- **Manager view**: adds team attendance heatmap (who's in/out today), pending approvals count (leave + regularization + asset requests) as actionable cards.
- **HR/Admin view**: org-wide headcount, attrition trend (mini chart), pending across all modules, payroll processing status widget, compliance flags (unacknowledged policies count).
- Widgets are cards, 3-column grid desktop → 1-column mobile.

## 2. Directory
- **Views**: Grid (card per employee: photo, name, designation, dept, quick-contact icons) / Table (sortable columns) toggle.
- **Filters**: department, designation, location, status (active/resigned), employment type.
- **Search bar**: instant client-side filter over name/empId/email/department (debounced 200ms), placeholder "Search by name, ID, or department".
- **Detail drawer** (click a card): full profile read-only tabs — Overview, Contact, Employment, Documents.
- **Admin-only**: "+ Add Employee" opens multi-step modal (Personal → Employment → Role & Reporting → Documents); bulk import via CSV upload (mapped to Directory columns) — validation report shown before commit.
- **Org Chart** sub-tab: rendered as a simple collapsible tree (built client-side from `managerId` links).

## 3. Attendance
- **My Attendance tab**: calendar-month view, color-coded days (present green, absent red, half-day amber, holiday gray, leave blue, weekend light-gray). Click a day → detail popover with punch times, regularize button if flagged/missing.
- **Team tab (Manager+)**: table — Employee | Today's Status | This Month % | Late Count | pending regularizations, with row-expand for daily grid.
- **Reports tab (HR/Admin)**: filter by dept/employee/date range → generates Weekly / Monthly summary table + export to Sheet/PDF. Includes "Days present, Absent, Leave, Late count, Avg check-in time" columns.
- **Filters**: month/year picker, department, employee search, status chips (Present/Absent/Late/On Leave — toggle multi-select).
- **Quick actions**: Punch In / Punch Out button lives in Topbar globally (visible everywhere), not just inside the module — always-accessible per real HRMS UX convention.

## 4. Leave
- **Apply tab**: form (leave type dropdown w/ live balance shown inline, date range picker with auto sandwich/holiday preview text "This will consume 4 days including 1 weekend", half-day toggle, reason, attachment).
- **My Requests tab**: table/timeline of past requests — status pill (Pending amber / Approved green / Rejected red / Cancelled gray), cancel button on pending ones.
- **Team Calendar tab (Manager+)**: month grid showing overlapping team leaves (avoid everyone approving leave same week) — avatars stacked on dates.
- **Approvals tab (Manager/HR)**: queue of pending requests as cards — Approve/Reject with mandatory remark on reject, shows requester's current balance and team-overlap warning inline.
- **Filters**: leave type, status, date range, employee (manager+ scope).
- **Balance widget**: persistent sidebar-of-module card showing all leave-type balances as mini progress bars.

## 5. Holiday Calendar
- **Views**: List (grouped by month) / Calendar grid.
- Restricted holiday "claim" picker for employees within quota.
- **Admin**: CRUD holidays, mark location-specific, mark optional/restricted.
- **Filters**: location, type (National/Restricted).

## 6. Company Policies
- **Views**: category-grouped card list (HR Policy, IT Policy, Code of Conduct, Leave Policy, Travel Policy, etc.), each card shows title, version, "Acknowledged ✓" or "Action Required" badge.
- **Search bar**: search by title/category.
- Click → opens PDF viewer (Drive embed) with "I Acknowledge" button (writes to `PolicyAcknowledgements`, disabled once done).
- **HR/Admin**: Upload new policy (Drive file picker or upload), set acknowledgementRequired, view acknowledgement completion % per policy (progress bar + drill-down table of who hasn't).

## 7. Assets
- **My Assets tab**: cards of currently assigned assets (tag, category, assigned date, condition).
- **Request Asset tab**: simple form → category + reason → goes to manager/admin queue.
- **Inventory tab (Admin)**: full table, filters (category/status/condition), search by tag/serial, "+ Add Asset", "Assign", "Retrieve/Return", "Mark for Repair/Retire" actions, warranty-expiry flags (badge if <30 days).
- **Reports**: asset utilization, category-wise count, depreciation-ready value export.

## 8. Rewards & Recognition
- **Wall of Fame**: public feed (card per reward, employee photo, badge icon, title, given-by), filterable by category/month.
- **My Recognitions tab**: personal history + points total (if points-based program enabled).
- **Give Recognition (Manager+)**: form — select employee, category, message, points.
- **Admin**: configure categories, monthly "Employee of the Month" flow (nomination → shortlist → HR finalize).

## 9. My Appraisals
- **Timeline view** of past cycles; current cycle shows stage progress (Self-Review → Manager Review → HR Calibration → Completed) as a stepper.
- **Self-review form**: goals from last cycle rated, achievements text, self-rating.
- **Manager view**: rate direct reports, set next-cycle goals, comment.
- **HR view**: calibration table across teams (all ratings side-by-side to spot outliers), finalize & lock ratings, trigger increment-letter workflow link into Letters module.
- **Filters**: cycle, department (manager/HR scope), rating band.

## 10. Travel & Expenses
- **New Request tab**: Travel request (dates, cities, purpose, advance) OR Expense claim (line items with bill upload, category, amount) — same module, tab-switch.
- **My Requests tab**: table, status pill, total claimed vs approved vs reimbursed.
- **Approvals tab (Manager)**: queue with per-line-item review.
- **Finance/HR tab**: reimbursement processing, export for accounting, policy-limit flags (e.g. "Food claim exceeds ₹800/day policy" shown as inline warning, not a hard block).
- **Filters**: status, date range, category, employee.

## 11. My Letters
- **Request tab**: pick letter type (dropdown), optional purpose note, submit.
- **My Letters tab**: table of requested/generated letters, download link once generated.
- **HR/Admin tab**: queue of pending requests, "Generate" action auto-fills a Google Docs template (merge fields: name, designation, DOJ, CTC-in-words for offer/salary letters) → exports PDF → stores in Drive → updates status → **triggers email to employee with the letter attached**.
- Auto-numbering: `letterNumber` generated via LockService-guarded counter per letter type per year (e.g. `NX/HR/2026/00042`).

## 12. My Payroll
- **My Payslips tab**: month-wise list, click → payslip viewer (earnings/deductions breakdown), download PDF.
- **Annual tab**: Form-16-style annual earnings summary, investment declaration status (if implemented).
- **HR/Admin (Process Payroll) tab**: month selector → "Generate Draft" pulls Attendance (LOP days), Directory (CTC structure) → editable draft table (allowances/deductions override per employee) → "Process & Publish" locks + generates PDFs + **emails payslip to each employee**.
- **Filters**: month/year, department, status (Draft/Processed/Paid).
- Salary structure config lives in Admin Console (basic %, HRA %, standard allowances, statutory deduction rates).

## 13. Resignation
- **My Resignation tab (Employee)**: if none active — "Submit Resignation" form (reason, proposed LWD). If active — status stepper + clearance checklist read-view.
- **Team tab (Manager)**: pending resignations from reports, negotiate LWD, add remarks.
- **HR tab**: full clearance checklist management (per-item checkbox: assets returned, KT done, dues cleared, exit interview scheduled/done), FnF settlement entry, final approve → triggers relieving letter + Directory status update.
- **Filters (HR)**: status, department, notice-period-ending-soon flag.

## 14. My Profile
- **Tabs**: Personal Info, Contact & Emergency, Employment Details (read-only for employee), Documents (upload ID proofs etc.), Bank Details (for payroll, masked display, edit opens confirmation + notifies HR of change for verification), Preferences (notification settings).
- Profile photo upload → stored in Drive, `photoUrl` updated, propagates to Directory/Topbar avatar.

## 15. Admin Console (Admin/HR only, separate nav section)
- **Organization Setup**: org name/logo, departments list, designations list, locations, working days/weekends config.
- **Roles & Access**: assign roles to employees, reporting-line bulk editor.
- **Leave Policy Config**: leave types, accrual rates, carry-forward caps, sandwich rule toggle, notice period matrix.
- **Email Templates**: edit subject/body of every triggered email (with merge-field helper tags shown).
- **Audit Log Viewer**: searchable log of all sensitive actions.
- **System Health**: trigger status, last run times, error log surfaced from a wrapped try/catch logger in every Api function writing to `AuditLog`/a dedicated `ErrorLog` sheet.
