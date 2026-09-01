# 06 — Standalone Attendance & Leave Forms
 
**Requirement**: These must work as independent HTML pages (own shareable URL, minimal UI, fast load — usable from a shared kiosk tablet or a bookmarked mobile link) while writing to the *same* Sheets DB as the main SPA, so data reflects instantly in both places.
 
## 1. URLs
- Main App: `https://script.google.com/macros/s/{ID}/exec`
- Standalone Attendance: `https://script.google.com/macros/s/{ID}/exec?page=attendance`
- Standalone Leave: `https://script.google.com/macros/s/{ID}/exec?page=leave`
 
Both routed through the same `doGet(e)` (see 01-ARCHITECTURE) and the same `Api_Attendance.gs` / `Api_Leave.gs` server functions as the SPA — **there is only one data-writing code path**, guaranteeing sync.
 
## 2. Attendance.html (standalone) — Spec
 
- Single-screen, mobile-first, responsive design.
- **Authentication & Identification Modes (Configurable in Admin Console)**:
  1. **Workspace SSO Mode (Default)**: Automatically detects `Session.getActiveUser().getEmail()` from the browser session.
  2. **Emp ID / PIN Mode**: Form prompts employee for Employee ID (`SD-0001`) and 4-digit PIN (or last 4 digits of phone number), verifying against the Directory before logging punch.
  3. **Shared Kiosk Tablet Mode (`?kiosk=1`)**: Auto-resets to the search/punch screen 5 seconds after a successful punch, clearing any displayed sensitive details.
- **Primary Punch Interface**:
  - Not punched in yet $\rightarrow$ large green "PUNCH IN" button
  - Punched in, not out $\rightarrow$ large red "PUNCH OUT" button + live worked-hours counter
  - Already completed today $\rightarrow$ "You're done for today ✓" + day summary (in/out times, hours worked)
- Geolocation capture via `navigator.geolocation` (lat/long captured and stored in punch record; can be set to optional or required in Settings).
- Below the button: mini calendar strip of last 7 days with status indicators, and a "Request Regularization" link if any missed punches exist.
- Link to "Open Full HRMS" for employees desiring full portal access.
 
```javascript
function Api_Attendance_punch(action, geo, requestId, empIdOverride){
  const user = Auth.resolveUserForPunch_(empIdOverride);
  return withLock_(() => {
    if (isDuplicateRequest_(requestId)) return fail_('DUPLICATE','Already processed');
    const today = todayStr_();
    let row = DB.Attendance.findByEmpAndDate_(user.empId, today);
    if (action === 'IN'){
      if (row && row.punchInTime) return fail_('ALREADY_IN','Already punched in');
      DB.Attendance.upsertPunch_(user.empId, today, {punchInTime:new Date(), punchInLoc:geo, source:'Web'});
    } else {
      if (!row || !row.punchInTime) return fail_('NOT_PUNCHED_IN','Punch in first');
      DB.Attendance.upsertPunch_(user.empId, today, {punchOutTime:new Date(), punchOutLoc:geo});
    }
    logAudit_(user.empId,'ATTENDANCE_PUNCH',action);
    return ok_(DB.Attendance.findByEmpAndDate_(user.empId, today));
  });
}
```
 
## 3. Leave.html (standalone) — Spec
 
- Single-screen form: Leave type dropdown (live balance displayed inline), date range pickers (live preview of sandwich calculation: e.g. "Consumes 4 days including 2 weekend days"), half-day toggle, reason textarea, optional medical/supporting file upload to Drive folder `StackDrove_Files/LeaveAttachments/{empId}`.
- Submit $\rightarrow$ routed to `Api_Leave_apply`.
- Below the form: compact list of "My Recent Requests" (last 5) with color-coded status pills.
- Confirmation screen after submit: "Submitted to {approverName} for approval" + link to return to portal.
 
## 4. Real-time Synchronization
 
Because standalone pages and the main SPA execute the exact same `Api_*.gs` server endpoints and write to the same sheets, all punches, regularizations, and leave requests reflect in real-time with zero sync latency or database drift.
