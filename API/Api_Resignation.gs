/**
 * StackDrove HRMS — Api_Resignation.gs
 * Client-callable endpoints for Resignations, Clearance Checklist, and Offboarding.
 */

function Api_Resignation_getMy() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const isPrivileged = (user.role === 'admin' || user.role === 'hr' || user.role === 'manager');

    const activeResignation = DB.Resignation.getActiveForEmp_(user.empId);
    const allList = isPrivileged ? DB.Resignation.getAll_().map(r => {
      const emp = DB.Directory.getById_(r.empId);
      return {
        ...r,
        employeeName: emp ? emp.fullName : r.empId,
        department: emp ? emp.department : ''
      };
    }) : [];

    return ok_({
      active: activeResignation,
      allList: allList
    });
  } catch (e) {
    logError_(e, 'Api_Resignation_getMy');
    return fail_('ERROR', e.message);
  }
}

function Api_Resignation_submit(payload) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!payload.reason || !payload.proposedLWD) {
      return fail_('VALIDATION_ERROR', 'Reason and proposed Last Working Day are required.');
    }

    const existing = DB.Resignation.getActiveForEmp_(user.empId);
    if (existing) return fail_('ALREADY_EXISTS', 'An active resignation workflow is already in progress.');

    const noticeMatrix = Config.getJson('NOTICE_PERIOD_DAYS') || { 'full-time': 60 };
    const empRecord = DB.Directory.getById_(user.empId);
    const noticeDays = noticeMatrix[empRecord?.employmentType || 'full-time'] || 60;

    const created = DB.Resignation.submit_({
      empId: user.empId,
      reason: payload.reason,
      proposedLWD: payload.proposedLWD,
      noticePeriodDays: noticeDays
    });

    logAudit_(user.empId, 'RESIGNATION_SUBMIT', 'Resignations', created.resignationId, payload.requestId, {}, created);

    // Notify manager via Priority 1 email
    const mgrEmail = DB.Directory.getEmail_(user.managerId);
    if (mgrEmail) {
      MailQueue.enqueue(1, mgrEmail, 'RESIGNATION_SUBMITTED', {
        employeeName: user.fullName,
        proposedLWD: created.lastWorkingDay,
        reason: created.reason
      });
    }

    return ok_(created);
  } catch (e) {
    logError_(e, 'Api_Resignation_submit');
    return fail_('ERROR', e.message);
  }
}

function Api_Resignation_updateChecklist(resignationId, checklistObj) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    const updated = DB.Resignation.updateChecklist_(resignationId, checklistObj);
    if (!updated) return fail_('NOT_FOUND', 'Resignation record not found.');

    logAudit_(user.empId, 'CLEARANCE_UPDATE', 'Resignations', resignationId, '', {}, checklistObj);
    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Resignation_updateChecklist');
    return fail_('ERROR', e.message);
  }
}

function Api_Resignation_finalize(resignationId, lwdFinal) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    const updated = DB.Resignation.finalizeExit_(resignationId, lwdFinal, user.empId);
    if (!updated) return fail_('NOT_FOUND', 'Resignation record not found.');

    logAudit_(user.empId, 'RESIGNATION_FINALIZE', 'Resignations', resignationId, '', {}, { lwdFinal });

    // Notify employee
    const empEmail = DB.Directory.getEmail_(updated.empId);
    if (empEmail) {
      MailQueue.enqueue(1, empEmail, 'RESIGNATION_COMPLETED', {
        lastWorkingDay: lwdFinal || todayStr_()
      });
    }

    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Resignation_finalize');
    return fail_('ERROR', e.message);
  }
}
