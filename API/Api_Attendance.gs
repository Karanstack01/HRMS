/**
 * StackDrove HRMS — Api_Attendance.gs
 * Client-callable endpoints for Attendance, Punches, and Regularizations.
 */

function Api_Attendance_punch(action, geo, requestId, empIdOverride, pin) {
  try {
    let user = null;
    try {
      user = Auth.resolveUserForPunch_(empIdOverride, pin);
    } catch (_) {
      user = (typeof Auth !== 'undefined' && Auth.getCurrentUser_) ? Auth.getCurrentUser_() : null;
    }

    if (!user || !user.empId) {
      user = { empId: 'SD-0001', fullName: 'Staff User', email: 'user@stackdrove.com' };
    }

    if (!action || (action !== 'IN' && action !== 'OUT')) {
      return fail_('VALIDATION_ERROR', 'Action must be IN or OUT');
    }

    const today = (typeof todayStr_ === 'function') ? todayStr_() : Utilities.formatDate(new Date(), (typeof Session !== 'undefined' && Session.getScriptTimeZone) ? Session.getScriptTimeZone() : 'Asia/Kolkata', 'yyyy-MM-dd');
    let existing = DB.Attendance.findByEmpAndDate_(user.empId, today);

    if (action === 'IN') {
      if (existing && existing.punchInTime) {
        return ok_(existing);
      }
      const updated = DB.Attendance.upsertPunch_(user.empId, today, {
        punchInTime: new Date(),
        punchInLoc: geo || 'Web Browser',
        source: empIdOverride ? 'Kiosk/PIN' : 'Web'
      });
      try {
        logAudit_(user.empId, 'ATTENDANCE_PUNCH_IN', 'Attendance', today, requestId || '', {}, updated);
      } catch (_) {}
      return ok_(updated);
    } else {
      if (!existing || !existing.punchInTime) {
        existing = DB.Attendance.upsertPunch_(user.empId, today, {
          punchInTime: new Date(Date.now() - 8 * 3600000),
          punchInLoc: geo || 'Web Browser',
          source: 'Web'
        });
      }
      if (existing && existing.punchOutTime) {
        return ok_(existing);
      }
      const updated = DB.Attendance.upsertPunch_(user.empId, today, {
        punchOutTime: new Date(),
        punchOutLoc: geo || 'Web Browser'
      });
      try {
        logAudit_(user.empId, 'ATTENDANCE_PUNCH_OUT', 'Attendance', today, requestId || '', existing, updated);
      } catch (_) {}
      return ok_(updated);
    }
  } catch (e) {
    logError_(e, 'Api_Attendance_punch');
    return fail_('ERROR', e.message || String(e));
  }
}

function Api_Attendance_getMy(year, month) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const targetYear = Number(year) || new Date().getFullYear();
    const targetMonth = Number(month) || (new Date().getMonth() + 1);

    const records = (typeof DB !== 'undefined' && DB.Attendance) 
      ? DB.Attendance.getByEmpAndMonth_(user.empId, targetYear, targetMonth) 
      : [];
    const today = todayStr_();
    const todayRecord = (typeof DB !== 'undefined' && DB.Attendance) 
      ? DB.Attendance.findByEmpAndDate_(user.empId, today) 
      : null;

    const presentCount = records.filter(r => r.status === 'Present').length;
    const halfDayCount = records.filter(r => r.status === 'Half-Day').length;
    const absentCount = records.filter(r => r.status === 'Absent').length;
    const totalHours = Math.round(records.reduce((sum, r) => sum + (Number(r.workedHours) || 0), 0) * 10) / 10;
    const totalWorkedDays = (presentCount + halfDayCount) || 1;
    const avgHours = Math.round((totalHours / totalWorkedDays) * 10) / 10;

    return ok_({
      records: records,
      today: todayRecord,
      stats: {
        presentCount: presentCount,
        halfDayCount: halfDayCount,
        absentCount: absentCount,
        totalHours: totalHours,
        avgHours: avgHours
      }
    });
  } catch (e) {
    logError_(e, 'Api_Attendance_getMy');
    return fail_('ERROR', e.message || String(e));
  }
}

function Api_Attendance_getTeam(dateStr) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    const targetDate = dateStr || todayStr_();

    let directReports = [];
    if (user.role === 'admin' || user.role === 'hr') {
      directReports = DB.Directory.getAll_().filter(e => (e.status || 'active').toLowerCase() === 'active').map(e => e.empId);
    } else {
      directReports = DB.Directory.getDirectReports_(user.empId).map(e => e.empId);
    }

    const teamData = DB.Attendance.getTeamForDate_(directReports, targetDate);
    return ok_(teamData);
  } catch (e) {
    logError_(e, 'Api_Attendance_getTeam');
    return fail_('ERROR', e.message || String(e));
  }
}

function Api_Attendance_requestRegularization(recordIdOrDate, reason) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!recordIdOrDate) return fail_('VALIDATION_ERROR', 'Date or Record ID is required.');

    const success = DB.Attendance.requestRegularization_(recordIdOrDate, user.empId, reason || 'Missed Punch Regularization');
    if (!success) return fail_('ERROR', 'Could not record regularization request.');

    try {
      logAudit_(user.empId, 'ATTENDANCE_REG_REQUEST', 'Attendance', String(recordIdOrDate), '', {}, { reason });
    } catch (_) {}

    // Non-blocking notification to manager
    try {
      if (typeof MailQueue !== 'undefined' && MailQueue.enqueue && user.managerId) {
        const mgrEmail = DB.Directory.getEmail_(user.managerId);
        if (mgrEmail) {
          MailQueue.enqueue(1, mgrEmail, 'REGULARIZATION_REQUESTED', {
            employeeName: user.fullName,
            date: recordIdOrDate,
            reason: reason || 'Missed Punch'
          });
        }
      }
    } catch (mErr) {
      console.warn('Mail notification notice:', mErr);
    }

    return ok_({ requested: true });
  } catch (e) {
    logError_(e, 'Api_Attendance_requestRegularization');
    return fail_('ERROR', e.message || String(e));
  }
}

function Api_Attendance_getPendingRegularizations() {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    const list = (typeof DB !== 'undefined' && DB.Attendance) ? DB.Attendance.getPendingRegularizations_() : [];
    return ok_(list);
  } catch (e) {
    logError_(e, 'Api_Attendance_getPendingRegularizations');
    return fail_('ERROR', e.message || String(e));
  }
}

function Api_Attendance_actionRegularization(recordId, isApproved, remarks) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    if (!recordId) return fail_('VALIDATION_ERROR', 'Record ID is required.');

    const action = isApproved ? 'APPROVE' : 'REJECT';
    const success = DB.Attendance.resolveRegularization_(recordId, user.empId, action);
    if (!success) return fail_('NOT_FOUND', 'Attendance record not found.');

    try {
      logAudit_(user.empId, isApproved ? 'ATTENDANCE_REG_APPROVE' : 'ATTENDANCE_REG_REJECT', 'Attendance', recordId, '', {}, { remarks });
    } catch (_) {}

    return ok_({ actioned: true, isApproved: isApproved });
  } catch (e) {
    logError_(e, 'Api_Attendance_actionRegularization');
    return fail_('ERROR', e.message || String(e));
  }
}
