# 03 — RBAC & Core Business Logic

## 1. Role Matrix

| Module | Employee | Manager | HR | Admin |
|---|---|---|---|---|
| Directory | view self + org chart (read-only, limited fields) | view self + direct reports | full CRUD | full CRUD |
| Attendance | punch in/out, view own, request regularization | view team, approve regularization | view all, override, run reports | full |
| Leave | apply, view own, cancel pending | approve/reject team, view team calendar | override any decision, configure policy | full |
| Holiday Calendar | view | view | CRUD | CRUD |
| Policies | view + acknowledge | view + acknowledge | CRUD, track acknowledgement | full |
| Assets | view own, raise request | approve team asset requests | assign/retrieve, CRUD inventory | full |
| Rewards | view own + wall of fame | nominate team member | approve/give, CRUD | full |
| My Appraisals | self-review, view final | rate team, set goals | configure cycles, HR review, calibration | full |
| Travel & Expenses | raise request, submit bills | approve team | finance-review, reimburse, reports | full |
| My Letters | request letter, download | — | generate, approve, track | full |
| My Payroll | view own payslip | — | process, generate, configure structure | full |
| Resignation | submit, track own | review team resignation, initiate clearance items | HR review, approve, F&F, generate docs | full |
| My Profile | edit personal fields only | same | edit any field | full |
| Admin Console | — | — | limited (policy/leave config) | full setup |

**Enforcement pattern (server-side, every Api_*.gs function):**
```javascript
function Api_Leave_approve(payload){
  const user = Auth.requireRole_(['manager','hr','admin']);
  const leave = DB.Leave.getById_(payload.leaveId);
  if (user.role === 'manager' && leave.approverEmpId !== user.empId) {
    return fail_('FORBIDDEN','Not your approval to action');
  }
  // ...proceed
}
```

## 2. Approval Chain Resolution

- Default approver = `Directory.managerId` of the requester, resolved **at time of application** and frozen on the record (`approverEmpId`) — so a later reporting-line change doesn't retroactively alter history.
- If a manager is on leave when a request lands, Admin/HR gets a **fallback escalation** email after 48 hours of no action (`Triggers.gs` daily job scans `LeaveRequests` where `status=Pending` and `appliedOn` > 48h old).
- Skip-level approval: Admin/HR can override/approve any pending request via Admin Console regardless of `approverEmpId`.

## 3. Sandwich Leave Rule (Leave day-count logic)

**Rule**: If an employee takes leave on the last working day before a weekend/holiday AND the first working day after it, the weekend/holiday itself is also counted as leave ("sandwiched").

```javascript
function calcLeaveDaysWithSandwich_(fromDate, toDate, empId){
  const cal = buildCalendarRange_(fromDate, toDate); // array of {date, isWeekend, isHoliday}
  let days = 0;
  cal.forEach(d => { if(!d.isWeekend && !d.isHoliday) days++; });

  // Check leading sandwich: day before fromDate is weekend/holiday AND day before that was also on leave
  // Check trailing sandwich: day after toDate is weekend/holiday AND employee has leave immediately after
  const leadingGap = getNonWorkingGapBefore_(fromDate);   // consecutive weekend/holiday days immediately preceding
  const trailingGap = getNonWorkingGapAfter_(toDate);

  if (leadingGap.length && wasOnLeaveImmediatelyBefore_(empId, leadingGap[0])) {
    days += leadingGap.length; // sandwich the gap in
  }
  if (trailingGap.length && hasLeaveRequestImmediatelyAfter_(empId, toDate, trailingGap)) {
    days += trailingGap.length;
  }
  return days;
}
```
- Config toggle: `Config.SANDWICH_LEAVE_RULE = {enabled:true, appliesTo:['Casual','Earned'], exempt:['Sick','Maternity','Paternity']}` — HR can disable per org policy from Admin Console.

## 4. Holiday Skip in Attendance

When generating daily attendance rows (nightly trigger) or when computing "days present %":
```javascript
function isCountableWorkingDay_(dateStr, location){
  if (isWeekend_(dateStr)) return false;
  if (isHoliday_(dateStr, location)) return false; // location-aware holiday list
  return true;
}
```
- Attendance rows are **not created** for non-working days (status directly seeded as `Holiday`/`Weekend`) so managers' reports never flag them as "Absent".
- Optional/Restricted holidays: employee can select up to N per year (configured in `Config.RESTRICTED_HOLIDAY_QUOTA`) — a small picker in the Holiday Calendar module lets them "claim" one, which then blocks attendance-absence flags for that date only for that employee.

## 5. Leave Balance Accrual

- Casual/Sick: accrued monthly on the 1st via trigger (`ACCRUAL_RATE` from Config, e.g. 1.25/month = 15/year).
- Earned Leave: accrued quarterly, capped at `MAX_CARRY_FORWARD` (e.g. 45 days), excess auto-lapses or encashes per `Config.EL_ENCASHMENT_POLICY`.
- New joiners: pro-rated from `dateOfJoining` (no back-accrual for months before joining).
- On approval of a leave: `LeaveBalances.used += dayCount` (LockService-guarded to prevent race when two tabs submit simultaneously).
- On rejection/cancellation after approval: reverse the deduction.

## 6. Attendance Regularization Flow

Employee misses punch → requests regularization with reason → routes to manager (same approver logic as leave) → on approval, `Attendance` row status updated + `regularizationRequested=false`, audit-logged. 3+ regularizations in a rolling 30 days auto-flags to HR dashboard (pattern-of-abuse guard) — visible only as a soft flag, never auto-rejected.

## 7. Resignation & Clearance Logic

1. Employee submits resignation with proposed LWD → status `Submitted`, notice period computed from `Directory.employmentType` + tenure via `Config.NOTICE_PERIOD_MATRIX`.
2. Manager reviews (can negotiate LWD) → `Manager-Review`.
3. HR finalizes LWD, generates clearance checklist (auto-includes any `Assets` currently `assignedTo` this empId) → `HR-Review`.
4. On all checklist items ticked + FnF processed → `Completed`, triggers: Directory.status → `resigned`, dateOfExit set, account access review reminder emailed to Admin, relieving letter auto-queued in `Letters`.

## 8. Payroll Processing Guardrails

- Payroll can only be generated for a month once Attendance for that month is "closed" (a trigger locks each `Attendance_<YEAR>` month range as read-only via a `Config.CLOSED_MONTHS` list after HR runs "Close Month" from Admin Console).
- Unpaid leave days and excess absences auto-compute a `lossOfPay` deduction line pulled from Attendance status counts for the month.
- Payslip PDF generated once, stored in Drive, `payslipUrl` frozen — reprocessing a month creates a new record with incremented version, old one archived not deleted (audit trail for compliance).
