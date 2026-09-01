# 08 — Implementation Plan (Antigravity Task Board)

**Instructions for Antigravity**: Work phase by phase, in order. Do not start a phase until the previous phase's acceptance criteria all pass. After each task, run the listed check and report pass/fail before moving on. Reference `01`–`07` docs for exact schema/logic — do not invent field names or business rules not specified there.

---

## PHASE 0 — Project Bootstrap
- [ ] T0.1 Create Apps Script project `StackDrove-HRMS-Core`, bind to a Spreadsheet `StackDrove-DB`.
- [ ] T0.2 Create `Setup.gs` with `initializeSystem()` to automatically create all Drive folders: `StackDrove_Files/`, subfolders `Policies/`, `Letters/`, `Payslips/`, `LeaveAttachments/`, `ExpenseBills/`, `Profiles/`.
- [ ] T0.3 Create all sheets per `02-DATA-MODEL.md` with exact headers in row 1, frozen.
- [ ] T0.4 Build `Utils.gs` (`ok_`, `fail_`, date helpers, `withLock_`, `logAudit_`, `isDuplicateRequest_`, `generateSequentialId_`).
- [ ] T0.5 Build `Auth.gs` (`resolveCurrentUser_`, `requireRole_`, `getNavForRole_`).
- [ ] T0.6 Build `MailQueue.gs` and `Sheet_EmailQueue.gs` with priority queue routing.

**Phase 0 Acceptance**: All sheets exist with correct schema; Auth resolves a role correctly; no console errors on an empty `doGet`.

---

## PHASE 1 — Core Shell & Directory (foundation everything else depends on)
- [ ] T1.1 Build `Html/Partials/Styles.html` with full CSS variable set + component classes from `07-UI-UX-DESIGN-SYSTEM.md`.
- [ ] T1.2 Build `Html/Partials/Sidebar.html`, `Topbar.html`, `Icons.html`, `Modal.html`.
- [ ] T1.3 Build `Html/Index.html` shell wiring sidebar/topbar/content mount + `callApi()` JS helper.
- [ ] T1.4 Build `doGet` routing in `Code.gs` (main app + `?page=attendance`/`?page=leave` stubs returning "Coming in Phase 3/4").
  - **Check**: deploying as web app and visiting the URL renders sidebar+topbar with correct nav items per test-role login.
- [ ] T1.5 Build `Api_Directory.gs` + `Sheet_Directory.gs`: list, get by id, create, update, deactivate, bulk-CSV import with validation report.
- [ ] T1.6 Build `Modules/Directory.html`: Grid/Table toggle, filters, search, detail drawer, Add/Edit modal (Admin only), Org Chart tab.
  - **Check**: as Admin — add an employee, see it appear in grid within same session without page reload; as Employee — cannot see Add button, cannot fetch another employee's masked fields (verify via direct `Api_Directory_get` call in console — must return `FORBIDDEN` for out-of-scope non-manager).

**Phase 1 Acceptance**: Directory is fully CRUD-functional with correct RBAC; shell renders all future modules correctly once added to sidebar config.

---

## PHASE 2 — Holiday Calendar & Company Policies (low-complexity, validates file/Drive pattern early)
- [ ] T2.1 `Sheet_Holidays.gs` + `Api_Holidays.gs` + `Modules/Holidays.html` (List/Calendar toggle, Admin CRUD, restricted-holiday claim for employees).
- [ ] T2.2 `Sheet_Policies.gs`, `Sheet_PolicyAcknowledgements` handling + `Api_Policies.gs` + `Modules/Policies.html` (upload to Drive, PDF viewer embed, acknowledge flow, HR completion tracker).
  - **Check**: upload a policy PDF as HR, confirm it lands in `Policies/` Drive folder and appears instantly for an Employee test session; acknowledging writes exactly one row to `PolicyAcknowledgements` (test double-click doesn't duplicate — idempotency check).

**Phase 2 Acceptance**: Confirms Drive read/write + PDF embed pattern works — this pattern reused in Letters/Payroll/Assets later.

---

## PHASE 3 — Attendance (main module + standalone form)
- [ ] T3.1 `Sheet_Attendance.gs` with year-sheet resolution logic (`getOrCreateYearSheet_`).
- [ ] T3.2 `Api_Attendance.gs`: `punch`, `getMy_`, `getTeam_`, `requestRegularization`, `actionRegularization`, `generateReport_`.
- [ ] T3.3 `Modules/Attendance.html`: My Attendance calendar, Team table (Manager+), Reports tab (HR/Admin) with export.
- [ ] T3.4 `Html/Attendance.html` standalone page (per `06-ATTENDANCE-LEAVE-STANDALONE-FORMS.md`), wired to same `Api_Attendance.gs`.
- [ ] T3.5 `Triggers.gs`: `trg_dailyAttendanceSeed`, `trg_dailyAutoAbsentMark`. Install both as time-driven triggers.
  - **Check A**: punch in from standalone URL as Test Employee, then open main SPA Attendance tab in the same session (or a new tab) — punch reflects without any manual refresh trigger beyond normal re-fetch.
  - **Check B**: manually run `trg_dailyAttendanceSeed` for a mock date that is a configured holiday — confirm row status seeds as `Holiday`, not left blank.
  - **Check C**: run `trg_dailyAutoAbsentMark` for a past working day where a test employee has no punch and no approved leave — confirms marked `Absent`; a second test employee with an approved leave that day is marked `On-Leave` not `Absent`.

**Phase 3 Acceptance**: Both entry points write to identical data; holiday/weekend rows never show as Absent; reports tab produces correct weekly/monthly aggregates for seeded test data.

---

## PHASE 4 — Leave (main module + standalone form) — depends on Phase 3 (holiday/weekend data) + Phase 1 (manager resolution)
- [ ] T4.1 `Sheet_Leave.gs`, `Sheet_LeaveBalances.gs`.
- [ ] T4.2 Implement `calcLeaveDaysWithSandwich_` exactly per `03-RBAC-AND-BUSINESS-LOGIC.md` §3 — write standalone test cases:
  - Leave Fri+Mon around a normal weekend → expect Sat/Sun included (sandwich) = 4 days total.
  - Leave only Fri (no Monday leave) → expect 1 day, weekend NOT included.
  - Leave spanning a public holiday mid-range → holiday not double-counted as leave.
- [ ] T4.3 `Api_Leave.gs`: `previewDayCount`, `apply`, `getMyRequests_`, `getTeamCalendar_`, `approve`, `reject`, `cancel`, `escalationCheck` (used by trigger).
- [ ] T4.4 Monthly/quarterly accrual functions + `trg_monthlyLeaveAccrual`, `trg_quarterlyELAccrual`.
- [ ] T4.5 `Modules/Leave.html`: Apply, My Requests, Team Calendar, Approvals tabs; persistent balance widget.
- [ ] T4.6 `Html/Leave.html` standalone page.
- [ ] T4.7 Wire emails: `LEAVE_SUBMITTED_TO_APPROVER`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED_FYI`, `LEAVE_ESCALATION` (needs Phase 8 templates or stub templates now, finalize in Phase 8).
  - **Check**: full round trip — Employee test account applies leave from standalone form → Manager test account receives email + sees it in Approvals tab → approves with remark → Employee receives approval email and balance decreases correctly in `LeaveBalances`. Reject the same flow on a second request and confirm balance is NOT deducted.

**Phase 4 Acceptance**: Sandwich rule test cases all pass; approval round trip works end-to-end with correct emails and balance math.

---

## PHASE 5 — Assets, Rewards
- [ ] T5.1 `Sheet_Assets.gs`, `Sheet_AssetRequests.gs`, `Api_Assets.gs`, `Modules/Assets.html` (My Assets, Request, Inventory, Assign/Retrieve).
- [ ] T5.2 `Sheet_Rewards.gs`, `Api_Rewards.gs`, `Modules/Rewards.html` (Wall of Fame, Give Recognition, My Recognitions).
  - **Check**: assign an asset to Test Employee as Admin — confirms it appears under their My Assets and their prior "available" inventory count decrements; give a reward as Manager — confirms it appears on public Wall of Fame feed for all test roles.

---

## PHASE 6 — Appraisals, Travel & Expenses
- [ ] T6.1 `Sheet_Appraisals.gs`, `Api_Appraisals.gs`, `Modules/Appraisals.html` (stepper flow: self → manager → HR calibration).
- [ ] T6.2 `Sheet_TravelExpense.gs`, `Sheet_ExpenseItems.gs`, `Api_Travel.gs`, `Modules/Travel.html`.
  - **Check**: run a full appraisal cycle test with one employee — self-rating locked once submitted (cannot edit after submit), manager stage unlocks only after self stage complete, HR calibration table shows all direct comparisons correctly.
  - **Check**: expense claim with 3 line items totaling above a configured per-day policy limit shows the inline warning but still allows submission (soft flag, not hard block, per spec).

---

## PHASE 7 — Letters, Payroll, Resignation (highest compliance sensitivity — build last, most scrutiny)
- [ ] T7.1 `Sheet_Letters.gs`, `Api_Letters.gs`, Google Docs template merge + PDF export pipeline, `Modules/Letters.html`.
- [ ] T7.2 `Sheet_Payroll.gs`, `Api_Payroll.gs` (draft generation pulling Attendance LOP + Directory CTC structure), payslip PDF generation, `Modules/Payroll.html`.
- [ ] T7.3 `Sheet_Resignations.gs`, `Api_Resignation.gs` (submission → clearance checklist auto-populated from active Assets → FnF → completion), `Modules/Resignation.html`.
  - **Check A**: generate an Experience Letter for a test employee — verify PDF merge fields (name, DOJ, designation) are correct, letter number increments correctly and never collides even if two letters requested back-to-back (LockService test — fire two requests near-simultaneously via two script triggers, confirm sequential unique numbers).
  - **Check B**: process payroll draft for a test employee with 2 unpaid-leave days in the month — confirm LOP deduction matches Attendance data exactly.
  - **Check C**: submit resignation, confirm clearance checklist auto-lists the 1 asset currently assigned to that test employee; mark all checklist items complete + FnF settled → confirm Directory.status flips to `resigned` and dateOfExit populates.

---

## PHASE 8 — Email Templates, Notifications, Reports Finalization
- [ ] T8.1 Build `EmailTemplates` sheet with every template from `05-EMAIL-SYSTEM.md` §2, editable via Admin Console UI.
- [ ] T8.2 Wire every remaining trigger event listed in §2 that wasn't already wired in earlier phases.
- [ ] T8.3 Install all triggers from `05-EMAIL-SYSTEM.md` §4 via an "Initialize System" button in Admin Console (`ScriptApp.newTrigger` calls) — must be idempotent (running twice doesn't create duplicate triggers; check `ScriptApp.getProjectTriggers()` before creating).
  - **Check**: run "Initialize System" twice in a row — trigger count in Apps Script dashboard does not double.

---

## PHASE 9 — Profile, Dashboard, Admin Console (cross-cutting, built once other modules exist to aggregate from)
- [ ] T9.1 `Api_Profile.gs`, `Modules/Profile.html`.
- [ ] T9.2 `Modules/Dashboard.html` + nightly `Snapshots` sheet builder trigger for fast widget loads.
- [ ] T9.3 `Modules/AdminConsole.html`: Org setup, Roles & Access, Leave Policy config, Email Template editor, Audit Log viewer, System Health page.
  - **Check**: dashboard load time under 1.5s measured via `console.time` in browser for a test HR account with seeded data across all modules (minimum 20 employees, 50 leave records, 100 attendance rows for realistic load test).

---

## PHASE 10 — Hardening & UAT
- [ ] T10.1 RBAC sweep: for every `Api_*` function, confirm a denial test exists and passes (employee cannot call manager/HR/admin-only functions — verify via direct console calls bypassing UI).
- [ ] T10.2 Load test: seed 500 employees, 1 year of attendance (~150k rows), confirm Directory search, Attendance report generation, and Dashboard load all complete without GAS 6-minute execution timeout (batch/paginate any query risking this).
- [ ] T10.3 Idempotency sweep: fire duplicate submit on Leave apply, Attendance punch, Expense submit — confirm no duplicate records in each case.
- [ ] T10.4 Mobile responsive pass on all 18 screens from `07-UI-UX-DESIGN-SYSTEM.md` §7 at 375px width.
- [ ] T10.5 Full UAT script: run one complete employee lifecycle end-to-end — onboarding (Directory add) → attendance punches for a week → apply and get leave approved → receive a reward → complete an appraisal cycle → raise a travel expense and get reimbursed → request and receive a letter → view a processed payslip → submit and complete resignation. Every step must produce the correct email and correct Sheet state.

**Final Acceptance**: Phase 10 UAT script completes with zero manual data patches required and zero unhandled errors in `ErrorLog`.

---

## Definition of Done (applies to every task)
1. Server function has role-guard as first line and a passing denial test.
2. Client view has loading, empty, and error states implemented (not just happy path).
3. Any write path is wrapped in `withLock_` if it touches balances/counters/sequential IDs.
4. Any user-facing action that should notify someone has its email wired and tested.
5. Data written matches the exact schema in `02-DATA-MODEL.md` — no ad hoc extra columns without updating that doc.
