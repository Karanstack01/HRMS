# 01 — Architecture
 
## 1. High-Level Model
 
```
┌─────────────────────────────────────────────────────────┐
│  Google Apps Script Project: "StackDrove-HRMS-Core"      │
│                                                           │
│  doGet(e)  → routes to Index.html (main SPA) or          │
│              Attendance.html / Leave.html (standalone)   │
│                                                           │
│  Server (.gs files) ── Sheets DB ("StackDrove-DB")       │
│                     ── Drive (StackDrove_Files root)     │
│                     ── Gmail (MailApp/GmailApp/Queue)     │
│                     ── PropertiesService (config/secrets) │
│                     ── CacheService (session, rate-limit) │
│                     ── LockService (concurrency-safe      │
│                        writes: attendance punch, leave    │
│                        balance deduction, ID generation)  │
└─────────────────────────────────────────────────────────┘
```
 
## 2. Why a single bound Spreadsheet as DB
 
At 100–500 employees, expected row volumes:
- Attendance: ~500 emp × 300 working days/yr = 150,000 rows/yr → **use one sheet per year** (`Attendance_2026`), archived automatically each Jan 1 via time-trigger.
- Leave Requests: ~500 emp × 15 requests/yr = 7,500 rows/yr — single growing sheet is fine, archive every 2 years.
- Everything else (Directory, Assets, Policies, Payroll, Letters) is low-volume — single sheet.
 
This keeps every sheet under Apps Script's practical read/write comfort zone (<50k rows queried per call) and avoids `Range` timeouts.
 
## 3. GAS Project File Structure
 
```
StackDrove-HRMS-Core/
├── Code.gs                 (doGet/doPost, routing, global constants)
├── Config.gs                (PropertiesService wrapper: org name, working days, leave policy JSON, email templates map)
├── Setup.gs                 (One-click self-contained installer for sheets, folders, seed data)
├── Auth.gs                  (session resolution, role lookup, permission guards)
├── Utils.gs                  (date helpers, ID generators, sandwich-leave calc, response wrappers)
├── DB/
│   ├── Sheet_Directory.gs
│   ├── Sheet_Attendance.gs
│   ├── Sheet_Leave.gs
│   ├── Sheet_Holidays.gs
│   ├── Sheet_Policies.gs
│   ├── Sheet_Assets.gs
│   ├── Sheet_Rewards.gs
│   ├── Sheet_Appraisals.gs
│   ├── Sheet_Travel.gs
│   ├── Sheet_Letters.gs
│   ├── Sheet_Payroll.gs
│   ├── Sheet_Resignation.gs
│   ├── Sheet_EmailQueue.gs
│   └── Sheet_AuditLog.gs
├── API/
│   ├── Api_Directory.gs      (all client-callable functions for Directory module)
│   ├── Api_Attendance.gs
│   ├── Api_Leave.gs
│   ├── Api_Holidays.gs
│   ├── Api_Policies.gs
│   ├── Api_Assets.gs
│   ├── Api_Rewards.gs
│   ├── Api_Appraisals.gs
│   ├── Api_Travel.gs
│   ├── Api_Letters.gs
│   ├── Api_Payroll.gs
│   ├── Api_Resignation.gs
│   ├── Api_Profile.gs
│   └── Api_Admin.gs
├── Mail/
│   ├── MailTemplates.gs
│   ├── MailQueue.gs
│   └── MailDispatcher.gs
├── Triggers.gs               (installable time triggers: daily attendance auto-close, monthly payroll snapshot, birthday/anniversary digest, yearly leave accrual, sheet archival)
└── Html/
    ├── Index.html             (SPA shell: sidebar + topbar + content mount)
    ├── Attendance.html        (standalone form, own doGet route ?page=attendance)
    ├── Leave.html              (standalone form, own doGet route ?page=leave)
    ├── Partials/
    │   ├── Sidebar.html
    │   ├── Topbar.html
    │   ├── Icons.html
    │   ├── Styles.html         (all CSS variables + component classes)
    │   ├── Modal.html
    │   └── AppCore.html
    └── Modules/
        ├── Dashboard.html
        ├── Directory.html
        ├── Policies.html
        ├── Assets.html
        ├── Holidays.html
        ├── Rewards.html
        ├── Appraisals.html
        ├── Travel.html
        ├── Letters.html
        ├── Payroll.html
        ├── Resignation.html
        ├── Profile.html
        └── AdminConsole.html
```
 
Each `Modules/*.html` is loaded into the SPA via `google.script.run.withSuccessHandler(renderModule).getModuleView('directory')` pattern OR pre-templated with `HtmlService.createTemplateFromFile` and `include()` at doGet time, then hidden/shown by JS (faster perceived nav, higher initial payload — recommended for ≤500 users since Apps Script HTML Service payload limits (~50MB) are not a constraint at this scale).
 
## 4. Routing Logic (Code.gs)
 
```javascript
function doGet(e) {
  const page = e.parameter.page;
  if (page === 'attendance') return renderStandalone_('Html/Attendance', 'StackDrove HRMS — Attendance');
  if (page === 'leave')      return renderStandalone_('Html/Leave', 'StackDrove HRMS — Leave');
  return renderApp_();
}

function renderApp_() {
  const user = Auth.resolveCurrentUser_();
  if (!user) return HtmlService.createHtmlOutput(UNAUTHORIZED_HTML);
  const tmpl = HtmlService.createTemplateFromFile('Html/Index');
  tmpl.user = user;                       // {empId, name, role, dept, photoUrl}
  tmpl.navConfig = Auth.getNavForRole_(user.role);
  return tmpl.evaluate()
    .setTitle('StackDrove HRMS')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(path){ return HtmlService.createHtmlOutputFromFile(path).getContent(); }
```

## 5. Client ⇄ Server Contract

Every API function returns a uniform envelope so the client has one error-handling path:

```javascript
// Utils.gs
function ok_(data){ return {success:true, data:data, ts:new Date().toISOString()}; }
function fail_(code,message){ return {success:false, error:{code:code, message:message}}; }
```

Client wrapper (shared JS, `Partials/Styles.html` companion `App.js` inline block):
```javascript
function callApi(fnName, args, onSuccess, onError){
  google.script.run
    .withSuccessHandler(res => res.success ? onSuccess(res.data) : (onError||showToastError)(res.error))
    .withFailureHandler(err => (onError||showToastError)({code:'SERVER_ERROR', message: err.message}))
    [fnName].apply(null, args || []);
}
```

## 6. Concurrency & Data Integrity

- **LockService.getScriptLock()** wraps: attendance punch-in/out, leave balance debit/credit, ID/serial generation (employee code, asset tag, letter number), payroll snapshot generation.
- **Idempotency**: every write API accepts a client-generated `requestId` (uuid) stored in a rolling `AuditLog` sheet; duplicate `requestId` within 5 minutes is rejected — protects against double-submits from slow GAS round trips on mobile.
- **Optimistic row versioning**: Leave/Attendance edit operations pass a `rowVersion` (last-modified timestamp) fetched with the record; server rejects the write with `CONFLICT` if the sheet's current value differs, forcing client to refetch — prevents two managers approving/rejecting the same leave simultaneously.

## 7. Performance Guardrails (100–500 users)

- Never use `getDataRange().getValues()` on the full Attendance sheet for a single employee's view — always filter via a maintained **index sheet** (`Idx_Attendance_ByEmp`) rebuilt nightly by trigger, mapping `empId → {sheetName, rowStart, rowEnd}` per month, OR simpler: keep Attendance keyed and use `TextFinder` / binary search on a sorted `empId+date` column.
- Cache read-heavy, low-change data (Directory list, Holiday Calendar, Policies index) in `CacheService.getScriptCache()` with 6-hour TTL, invalidated on admin write.
- Dashboard widgets computed via nightly trigger into a `Snapshots` sheet (per-employee attendance %, leave balance, pending approvals count) rather than live-aggregated on every login — keeps dashboard load under 1s.
- Batch all sheet writes with `setValues()` on ranges, never cell-by-cell loops.

## 8. Security

- All `Api_*.gs` functions call `Auth.requireRole_(user, ['admin','hr'])` (or equivalent) as the **first line** — deny-by-default.
- Employees can only fetch rows where `empId === session.empId` unless role permits broader scope (enforced server-side, never trust client-passed empId for data scope, only for admin/manager-initiated queries).
- Sensitive fields (bank details in Payroll, salary in Directory) are visible only to Admin/HR/Finance role and to the employee's own profile — masked (`XXXX1234`) elsewhere.
- Standalone Attendance/Leave forms authenticate via the same `Session.getActiveUser().getEmail()` — no separate login, no token in URL.
