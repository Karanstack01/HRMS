/**
 * StackDrove HRMS — Triggers.gs
 * Automated Time-Driven Background Jobs and Cron Handlers.
 */

var Triggers = (function() {

  /**
   * Idempotently installs all system triggers.
   * Safe to run multiple times without duplicating triggers.
   */
  function installAll() {
    const existing = ScriptApp.getProjectTriggers();
    const existingHandlers = new Set(existing.map(t => t.getHandlerFunction()));

    function createDailyTrigger(fnName, hour, minute) {
      if (!existingHandlers.has(fnName)) {
        ScriptApp.newTrigger(fnName)
          .timeBased()
          .atHour(hour)
          .nearMinute(minute || 0)
          .everyDays(1)
          .create();
      }
    }

    function createEveryMinutesTrigger(fnName, minutes) {
      if (!existingHandlers.has(fnName)) {
        ScriptApp.newTrigger(fnName)
          .timeBased()
          .everyMinutes(minutes)
          .create();
      }
    }

    function createMonthlyTrigger(fnName, dayOfMonth, hour) {
      if (!existingHandlers.has(fnName)) {
        ScriptApp.newTrigger(fnName)
          .timeBased()
          .onMonthDay(dayOfMonth)
          .atHour(hour)
          .create();
      }
    }

    createDailyTrigger('trg_dailyAttendanceSeed', 0, 5);
    createDailyTrigger('trg_dailyAutoAbsentMark', 23, 55);
    createDailyTrigger('trg_dailyCelebrationDigest', 8, 0);
    createMonthlyTrigger('trg_monthlyLeaveAccrual', 1, 1);
    createEveryMinutesTrigger('trg_processEmailQueue', 10);
    createEveryMinutesTrigger('trg_leaveEscalationCheck', 30);

    Logger.log('[Triggers] System background cron triggers registered successfully.');
    return { success: true, count: ScriptApp.getProjectTriggers().length };
  }

  return {
    installAll: installAll
  };
})();

/**
 * 00:05 Daily — Seeds today's attendance row for all active employees
 * Pre-populates Weekend and Holiday statuses so they are never marked Absent.
 */
function trg_dailyAttendanceSeed() {
  try {
    const today = todayStr_();
    const isWknd = isWeekend_(today);
    const employees = DB.Directory.getAll_().filter(e => e.status === 'active');
    const yr = new Date().getFullYear();

    employees.forEach(emp => {
      const existing = DB.Attendance.findByEmpAndDate_(emp.empId, today);
      if (!existing) {
        const isHol = isHoliday_(today, emp.location);
        let defaultStatus = 'Pending';
        if (isHol) defaultStatus = 'Holiday';
        else if (isWknd) defaultStatus = 'Weekend';

        // Check if employee has approved leave for today
        if (wasEmployeeOnLeaveOnDate_(emp.empId, today)) {
          defaultStatus = 'On-Leave';
        }

        if (defaultStatus !== 'Pending') {
          DB.Attendance.upsertPunch_(emp.empId, today, {
            source: 'Auto-Seed',
            punchInLoc: defaultStatus
          });
        }
      }
    });
  } catch (e) {
    logError_(e, 'trg_dailyAttendanceSeed');
  }
}

/**
 * 23:55 Daily — Marks unpunched working days as Absent
 */
function trg_dailyAutoAbsentMark() {
  try {
    const today = todayStr_();
    const isWknd = isWeekend_(today);
    const employees = DB.Directory.getAll_().filter(e => e.status === 'active');

    employees.forEach(emp => {
      const isHol = isHoliday_(today, emp.location);
      if (!isWknd && !isHol) {
        const record = DB.Attendance.findByEmpAndDate_(emp.empId, today);
        if (!record || (!record.punchInTime && record.status === 'Pending')) {
          if (!wasEmployeeOnLeaveOnDate_(emp.empId, today)) {
            DB.Attendance.upsertPunch_(emp.empId, today, {
              source: 'Auto-Absent',
              punchInLoc: 'Absent'
            });
          }
        }
      }
    });
  } catch (e) {
    logError_(e, 'trg_dailyAutoAbsentMark');
  }
}

/**
 * 08:00 Daily — Celebration digest (birthdays and work anniversaries)
 */
function trg_dailyCelebrationDigest() {
  try {
    const employees = DB.Directory.getAll_().filter(e => e.status === 'active');
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDate = today.getDate();

    const celebrations = [];

    employees.forEach(emp => {
      if (emp.dateOfBirth) {
        const dob = parseDate_(emp.dateOfBirth);
        if (dob && dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDate) {
          celebrations.push(`🎂 <strong>${emp.fullName}</strong> (${emp.department}) — Happy Birthday!`);
        }
      }
      if (emp.dateOfJoining) {
        const doj = parseDate_(emp.dateOfJoining);
        if (doj && doj.getMonth() + 1 === todayMonth && doj.getDate() === todayDate && doj.getFullYear() < today.getFullYear()) {
          const tenure = today.getFullYear() - doj.getFullYear();
          celebrations.push(`🎉 <strong>${emp.fullName}</strong> (${emp.department}) — Celebrating ${tenure} Year(s) at StackDrove!`);
        }
      }
    });

    if (celebrations.length > 0) {
      const celebrationsListHtml = celebrations.map(c => `<p style="margin:6px 0;">${c}</p>`).join('');
      employees.forEach(emp => {
        MailQueue.enqueue(2, emp.email, 'CELEBRATION_DIGEST', {
          celebrationsListHtml: celebrationsListHtml
        });
      });
    }
  } catch (e) {
    logError_(e, 'trg_dailyCelebrationDigest');
  }
}

/**
 * Monthly 1st — Accrues monthly Casual / Sick leave days
 */
function trg_monthlyLeaveAccrual() {
  try {
    const employees = DB.Directory.getAll_().filter(e => e.status === 'active');
    const accrualRates = Config.getJson('LEAVE_ACCRUAL_RATES') || { Casual: 1.25, Sick: 1.0 };
    const currentYear = new Date().getFullYear();

    employees.forEach(emp => {
      for (const leaveType in accrualRates) {
        const rate = Number(accrualRates[leaveType]) || 0;
        if (rate > 0) {
          DB.LeaveBalances.restore_(emp.empId, leaveType, -rate); // add to balance
        }
      }
    });
  } catch (e) {
    logError_(e, 'trg_monthlyLeaveAccrual');
  }
}

/**
 * Periodic — Runs priority email dispatcher
 */
function trg_processEmailQueue() {
  try {
    MailQueue.processQueue();
  } catch (e) {
    logError_(e, 'trg_processEmailQueue');
  }
}

/**
 * Periodic — Checks for un-actioned leave requests older than 48 hours
 */
function trg_leaveEscalationCheck() {
  try {
    const hrUsers = DB.Directory.getAllHrAndAdmins_();
    const pending = DB.Leave.getPendingForApprover_('ALL');
    const now = new Date().getTime();

    pending.forEach(p => {
      const appliedTime = p.appliedOn ? new Date(p.appliedOn).getTime() : now;
      const diffHours = (now - appliedTime) / 3600000;
      if (diffHours >= 48) {
        const emp = DB.Directory.getById_(p.empId);
        const mgr = DB.Directory.getById_(p.approverEmpId);
        hrUsers.forEach(hr => {
          MailQueue.enqueue(1, hr.email, 'LEAVE_ESCALATION', {
            employeeName: emp ? emp.fullName : p.empId,
            approverName: mgr ? mgr.fullName : 'Manager',
            pendingHours: Math.round(diffHours)
          });
        });
      }
    });
  } catch (e) {
    logError_(e, 'trg_leaveEscalationCheck');
  }
}
