# 05 — Email Configuration, Priority Queue & Triggers

## 1. Delivery Mechanism & Priority Queue
- `GmailApp.sendEmail()` is used with HTML templates and attachments.
- **Priority Queue Architecture**:
  - **Priority 1 (Urgent / Immediate)**: Critical transactional updates (Leave submissions/approvals, attendance regularization alerts, resignation notices, emergency escalations). Dispatched immediately on event completion.
  - **Priority 2 (Daily Digests / Summaries)**: Celebration digests (birthdays/anniversaries), weekly manager summaries, warranty expiry alerts. Dispatched during scheduled morning windows.
  - **Priority 3 (Bulk / Announcements)**: Org-wide policy releases, quarterly reviews. Throttled in batches (e.g. 50 recipients per 10 minutes) to avoid hitting Workspace daily quota limits.
- If daily quota drops below safety threshold (e.g. < 100 emails remaining), non-urgent Priority 2/3 emails are automatically paused and delayed to the next day while Priority 1 transactional emails continue unimpeded.

```javascript
function queueEmail_(priority, toEmail, templateKey, data, attachments){
  if (priority === 1) {
    // Immediate dispatch with fallback to queue on transient network error
    try {
      dispatchMailDirect_(toEmail, templateKey, data, attachments);
      return;
    } catch(e) {
      logError_(e);
    }
  }
  DB.EmailQueue.enqueue_(priority, toEmail, templateKey, data);
}

function processEmailQueue_(){
  const quotaRemaining = MailApp.getRemainingDailyQuota();
  if (quotaRemaining < 50) {
    Logger.log('Low daily email quota (' + quotaRemaining + '). Pausing bulk email dispatch.');
    return;
  }
  const pending = DB.EmailQueue.getPendingBatch_(Math.min(quotaRemaining - 50, 40));
  pending.forEach(item => {
    try {
      dispatchMailDirect_(item.toEmail, item.templateKey, JSON.parse(item.payloadJson));
      DB.EmailQueue.markSent_(item.queueId);
    } catch(e) {
      DB.EmailQueue.markFailed_(item.queueId, e.message);
    }
  });
}
```

- All templates stored in `Config` sheet or a dedicated `EmailTemplates` sheet (editable from Admin Console) with `{{mergeField}}` placeholders.

## 2. Complete Trigger & Priority List

| Event | Recipient | Priority | Template Key | Merge Fields |
|---|---|---|---|---|
| Leave request submitted | Approver (manager) | 1 | `LEAVE_SUBMITTED_TO_APPROVER` | employeeName, leaveType, fromDate, toDate, dayCount, reason, approveLink |
| Leave approved | Requester | 1 | `LEAVE_APPROVED` | leaveType, fromDate, toDate, approverName, remarks |
| Leave rejected | Requester | 1 | `LEAVE_REJECTED` | leaveType, fromDate, toDate, approverName, remarks (mandatory) |
| Leave cancelled by employee | Approver (FYI) | 2 | `LEAVE_CANCELLED_FYI` | employeeName, leaveType, dates |
| Leave pending >48h | Admin/HR (escalation) | 1 | `LEAVE_ESCALATION` | employeeName, approverName, pendingHours |
| Attendance regularization requested | Approver | 1 | `REGULARIZATION_REQUESTED` | employeeName, date, reason |
| Regularization approved/rejected | Requester | 1 | `REGULARIZATION_RESULT` | date, result, remarks |
| Asset request submitted | Approver | 2 | `ASSET_REQUEST_SUBMITTED` | employeeName, category, reason |
| Asset request approved/rejected | Requester | 2 | `ASSET_REQUEST_RESULT` | category, result |
| Asset assigned | Employee | 2 | `ASSET_ASSIGNED` | assetTag, category, assignedDate |
| New policy published (ack required) | All active employees | 3 | `POLICY_PUBLISHED` | policyTitle, deadlineNote |
| Policy acknowledgement reminder (7 days unacknowledged) | Employee | 2 | `POLICY_ACK_REMINDER` | policyTitle |
| Reward given | Employee (+ public feed) | 2 | `REWARD_RECEIVED` | rewardTitle, givenBy, message |
| Appraisal cycle opened | All employees in scope | 3 | `APPRAISAL_CYCLE_OPEN` | cycleName, deadline |
| Appraisal stage moved to you | Next actor (manager/HR) | 1 | `APPRAISAL_ACTION_NEEDED` | employeeName, cycleName |
| Appraisal completed | Employee | 2 | `APPRAISAL_COMPLETED` | cycleName, finalRating |
| Travel/Expense submitted | Approver | 1 | `EXPENSE_SUBMITTED` | employeeName, type, amount, purpose |
| Expense approved/rejected | Requester | 1 | `EXPENSE_RESULT` | amount, result, remarks |
| Expense reimbursed | Requester | 2 | `EXPENSE_REIMBURSED` | amount, reimbursedDate |
| Letter requested | HR queue | 2 | `LETTER_REQUESTED` | employeeName, letterType |
| Letter generated | Employee | 1 | `LETTER_READY` | letterType, letterNumber, attachment: PDF |
| Payslip published | Employee | 1 | `PAYSLIP_PUBLISHED` | month, year, attachment: PDF |
| Resignation submitted | Manager | 1 | `RESIGNATION_SUBMITTED` | employeeName, proposedLWD, reason |
| Resignation LWD finalized | Employee + Manager | 1 | `RESIGNATION_LWD_FINAL` | finalLWD |
| Clearance item pending (3 days before LWD) | HR | 1 | `CLEARANCE_REMINDER` | employeeName, pendingItems |
| Resignation completed | Employee + Admin | 1 | `RESIGNATION_COMPLETED` | lastWorkingDay |
| Birthday / Work anniversary (daily digest 8AM) | Relevant team / org | 2 | `CELEBRATION_DIGEST` | list of names+occasions |
| Weekly attendance summary (Mon 9AM) | Manager | 2 | `WEEKLY_ATTENDANCE_SUMMARY` | team stats table |
| Monthly attendance summary (1st of month) | HR/Admin | 2 | `MONTHLY_ATTENDANCE_SUMMARY` | org-wide stats + attachment |
| New employee onboarded | New employee + team | 1 | `WELCOME_ONBOARD` | employeeName, startDate, managerName, loginInstructions |

## 3. Installable Triggers (Triggers.gs)

| Function | Frequency |
|---|---|
| `trg_dailyAttendanceSeed` | Daily, 00:05 — creates today's attendance placeholder rows (Holiday/Weekend/Pending) |
| `trg_dailyAutoAbsentMark` | Daily, 23:55 — marks no-punch working days as Absent (unless on approved leave) |
| `trg_dailyCelebrationDigest` | Daily, 08:00 |
| `trg_weeklyAttendanceSummary` | Weekly, Monday 09:00 |
| `trg_monthlyAttendanceSummary` | Monthly, 1st, 09:00 |
| `trg_monthlyLeaveAccrual` | Monthly, 1st, 00:30 |
| `trg_quarterlyELAccrual` | Quarterly |
| `trg_leaveEscalationCheck` | Every 6 hours |
| `trg_policyAckReminder` | Daily, 10:00 |
| `trg_processEmailQueue` | Every 10 minutes |
| `trg_yearlySheetArchival` | Yearly, Jan 1 — creates new `Attendance_<YEAR>` sheet, archives old |
| `trg_warrantyExpiryCheck` | Weekly |
