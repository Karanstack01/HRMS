/**
 * StackDrove HRMS — Api_Leave.gs
 * Client-callable endpoints for Leave Application, Sandwich preview, and Approvals.
 */

function Api_Leave_previewDayCount(fromDate, toDate, leaveType, isHalfDay) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!fromDate || !toDate) return ok_({ dayCount: 0, message: '' });

    const dayCount = calcLeaveDaysWithSandwich_(fromDate, toDate, user.empId, leaveType, isHalfDay);
    
    // Check if sandwich rule added days
    const workingOnly = calcLeaveDaysWithSandwich_(fromDate, toDate, user.empId, 'Sick', isHalfDay);
    let note = `This request will consume ${dayCount} day(s).`;
    if (dayCount > workingOnly) {
      note = `This request will consume ${dayCount} day(s) (including ${dayCount - workingOnly} sandwiched non-working days).`;
    }

    return ok_({
      dayCount: dayCount,
      message: note
    });
  } catch (e) {
    logError_(e, 'Api_Leave_previewDayCount');
    return fail_('ERROR', e.message);
  }
}

function Api_Leave_apply(payload) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!payload.fromDate || !payload.toDate || !payload.leaveType) {
      return fail_('VALIDATION_ERROR', 'From Date, To Date, and Leave Type are required.');
    }

    if (isDuplicateRequest_(payload.requestId)) {
      return fail_('DUPLICATE', 'This leave request has already been submitted.');
    }

    const dayCount = calcLeaveDaysWithSandwich_(payload.fromDate, payload.toDate, user.empId, payload.leaveType, payload.isHalfDay);
    if (dayCount <= 0) {
      return fail_('INVALID_DATES', 'Leave duration must be greater than 0.');
    }

    // Verify balance if not unpaid
    if (payload.leaveType !== 'Unpaid') {
      const balances = DB.LeaveBalances.getByEmp_(user.empId, new Date().getFullYear());
      const balObj = balances.find(b => b.leaveType === payload.leaveType);
      const available = balObj ? balObj.balance : 0;
      if (available < dayCount) {
        return fail_('INSUFFICIENT_BALANCE', `Insufficient ${payload.leaveType} leave balance. Available: ${available}, Required: ${dayCount}.`);
      }
    }

    const approverEmpId = user.managerId || DB.Directory.getAllHrAndAdmins_()[0]?.empId || 'SD-0001';

    const created = DB.Leave.create_({
      ...payload,
      empId: user.empId,
      dayCount: dayCount,
      approverEmpId: approverEmpId
    });

    logAudit_(user.empId, 'LEAVE_APPLY', 'Leave', created.leaveId, payload.requestId, {}, created);

    // Notify approver via Priority 1 immediate email
    const approverEmail = DB.Directory.getEmail_(approverEmpId);
    if (approverEmail) {
      MailQueue.enqueue(1, approverEmail, 'LEAVE_SUBMITTED_TO_APPROVER', {
        employeeName: user.fullName,
        leaveType: created.leaveType,
        fromDate: created.fromDate,
        toDate: created.toDate,
        dayCount: created.dayCount,
        reason: created.reason || 'Personal',
        approveLink: MailDispatcher.buildAppUrl_('leave', { leaveId: created.leaveId })
      });
    }

    return ok_(created);
  } catch (e) {
    logError_(e, 'Api_Leave_apply');
    return fail_('ERROR', e.message);
  }
}

function Api_Leave_getMyRequests() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const requests = DB.Leave.getByEmp_(user.empId);
    const balances = DB.LeaveBalances.getByEmp_(user.empId, new Date().getFullYear());
    return ok_({
      requests: requests,
      balances: balances
    });
  } catch (e) {
    logError_(e, 'Api_Leave_getMyRequests');
    return fail_('ERROR', e.message);
  }
}

function Api_Leave_getApprovals() {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    const scope = (user.role === 'admin' || user.role === 'hr') ? 'ALL' : user.empId;
    const pending = DB.Leave.getPendingForApprover_(scope);

    const enriched = pending.map(p => {
      const emp = DB.Directory.getById_(p.empId);
      const balances = DB.LeaveBalances.getByEmp_(p.empId, new Date().getFullYear());
      return {
        ...p,
        employeeName: emp ? emp.fullName : p.empId,
        department: emp ? emp.department : '',
        photoUrl: emp ? emp.photoUrl : '',
        currentBalances: balances
      };
    });

    return ok_(enriched);
  } catch (e) {
    logError_(e, 'Api_Leave_getApprovals');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Leave_approve(leaveId, remarks) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    const leave = DB.Leave.getById_(leaveId);
    if (!leave) return fail_('NOT_FOUND', 'Leave request not found.');

    if (user.role === 'manager' && leave.approverEmpId !== user.empId) {
      return fail_('FORBIDDEN', 'You do not have permission to action this request.');
    }

    const updated = DB.Leave.updateStatus_(leaveId, 'Approved', remarks, user.empId);
    logAudit_(user.empId, 'LEAVE_APPROVE', 'Leave', leaveId, '', leave, updated);

    // Notify requester via Priority 1 email
    const reqEmail = DB.Directory.getEmail_(leave.empId);
    if (reqEmail) {
      MailQueue.enqueue(1, reqEmail, 'LEAVE_APPROVED', {
        leaveType: leave.leaveType,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        approverName: user.fullName,
        remarks: remarks || 'Approved'
      });
    }

    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Leave_approve');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Leave_reject(leaveId, remarks) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    if (!remarks) return fail_('VALIDATION_ERROR', 'A rejection remark is mandatory.');

    const leave = DB.Leave.getById_(leaveId);
    if (!leave) return fail_('NOT_FOUND', 'Leave request not found.');

    const updated = DB.Leave.updateStatus_(leaveId, 'Rejected', remarks, user.empId);
    logAudit_(user.empId, 'LEAVE_REJECT', 'Leave', leaveId, '', leave, updated);

    // Notify requester via Priority 1 email
    const reqEmail = DB.Directory.getEmail_(leave.empId);
    if (reqEmail) {
      MailQueue.enqueue(1, reqEmail, 'LEAVE_REJECTED', {
        leaveType: leave.leaveType,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        approverName: user.fullName,
        remarks: remarks
      });
    }

    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Leave_reject');
    return fail_('ERROR', e.message);
  }
}

function Api_Leave_cancel(leaveId) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const leave = DB.Leave.getById_(leaveId);
    if (!leave) return fail_('NOT_FOUND', 'Leave record not found.');

    if (leave.empId !== user.empId && user.role !== 'admin' && user.role !== 'hr') {
      return fail_('FORBIDDEN', 'You cannot cancel another employee’s leave.');
    }

    const updated = DB.Leave.updateStatus_(leaveId, 'Cancelled', 'Cancelled by employee', user.empId);
    logAudit_(user.empId, 'LEAVE_CANCEL', 'Leave', leaveId, '', leave, updated);
    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Leave_cancel');
    return fail_('ERROR', e.message);
  }
}
