/**
 * StackDrove HRMS — Api_Attendance.gs
 * Client-callable endpoints for Attendance, Punches, and Regularization.
 */

function Api_Attendance_punch(action, geo, requestId, empIdOverride, pin) {
  try {
    const user = Auth.resolveUserForPunch_(empIdOverride, pin);
    if (!action || (action !== 'IN' && action !== 'OUT')) {
      return fail_('VALIDATION_ERROR', 'Action must be IN or OUT');
    }

    if (isDuplicateRequest_(requestId)) {
      return fail_('DUPLICATE', 'This punch request is already being processed.');
    }

    const today = todayStr_();
    let existing = DB.Attendance.findByEmpAndDate_(user.empId, today);

    if (action === 'IN') {
      if (existing && existing.punchInTime) {
        return fail_('ALREADY_PUNCHED_IN', 'You have already punched in for today.');
      }
      const updated = DB.Attendance.upsertPunch_(user.empId, today, {
        punchInTime: new Date(),
        punchInLoc: geo || '',
        source: empIdOverride ? 'Kiosk/PIN' : 'Web'
      });
      logAudit_(user.empId, 'ATTENDANCE_PUNCH_IN', 'Attendance', today, requestId, {}, updated);
      return ok_(updated);
    } else {
      if (!existing || !existing.punchInTime) {
        return fail_('NOT_PUNCHED_IN', 'You have not punched in yet today.');
      }
      if (existing.punchOutTime) {
        return fail_('ALREADY_PUNCHED_OUT', 'You have already punched out for today.');
      }
      const updated = DB.Attendance.upsertPunch_(user.empId, today, {
        punchOutTime: new Date(),
        punchOutLoc: geo || ''
      });
      logAudit_(user.empId, 'ATTENDANCE_PUNCH_OUT', 'Attendance', today, requestId, existing, updated);
      return ok_(updated);
    }
  } catch (e) {
    logError_(e, 'Api_Attendance_punch');
    return fail_('ERROR', e.message);
  }
}

function Api_Attendance_getMy(year, month) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);

    const records = DB.Attendance.getByEmpAndMonth_(user.empId, targetYear, targetMonth);
    const today = todayStr_();
    const todayRecord = DB.Attendance.findByEmpAndDate_(user.empId, today);

    return ok_({
      records: records,
      today: todayRecord,
      stats: {
        presentCount: records.filter(r => r.status === 'Present').length,
        halfDayCount: records.filter(r => r.status === 'Half-Day').length,
        absentCount: records.filter(r => r.status === 'Absent').length,
        totalHours: records.reduce((sum, r) => sum + (r.workedHours || 0), 0)
      }
    });
  } catch (e) {
    logError_(e, 'Api_Attendance_getMy');
    return fail_('ERROR', e.message);
  }
}

function Api_Attendance_getTeam(dateStr) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    const targetDate = dateStr || todayStr_();

    let directReports = [];
    if (user.role === 'admin' || user.role === 'hr') {
      directReports = DB.Directory.getAll_().filter(e => e.status === 'active').map(e => e.empId);
    } else {
      directReports = DB.Directory.getDirectReports_(user.empId).map(e => e.empId);
    }

    const teamData = DB.Attendance.getTeamForDate_(directReports, targetDate);
    return ok_(teamData);
  } catch (e) {
    logError_(e, 'Api_Attendance_getTeam');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Attendance_requestRegularization(recordId, reason) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!recordId) return fail_('VALIDATION_ERROR', 'Record ID is required.');

    const success = DB.Attendance.requestRegularization_(recordId, user.empId, reason);
    if (!success) return fail_('NOT_FOUND', 'Attendance record not found.');

    logAudit_(user.empId, 'ATTENDANCE_REG_REQUEST', 'Attendance', recordId, '', {}, { reason });

    // Notify manager
    const mgrEmail = DB.Directory.getEmail_(user.managerId);
    if (mgrEmail) {
      MailQueue.enqueue(1, mgrEmail, 'REGULARIZATION_REQUESTED', {
        employeeName: user.fullName,
        date: todayStr_(),
        reason: reason || 'Missed Punch'
      });
    }

    return ok_({ requested: true });
  } catch (e) {
    logError_(e, 'Api_Attendance_requestRegularization');
    return fail_('ERROR', e.message);
  }
}

function Api_Attendance_actionRegularization(recordId, isApproved, remarks) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    if (!recordId) return fail_('VALIDATION_ERROR', 'Record ID is required.');

    const success = DB.Attendance.actionRegularization_(recordId, isApproved, user.empId, remarks);
    if (!success) return fail_('NOT_FOUND', 'Attendance record not found.');

    logAudit_(user.empId, isApproved ? 'ATTENDANCE_REG_APPROVE' : 'ATTENDANCE_REG_REJECT', 'Attendance', recordId, '', {}, { remarks });
    return ok_({ actioned: true, isApproved: isApproved });
  } catch (e) {
    logError_(e, 'Api_Attendance_actionRegularization');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}
