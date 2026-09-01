/**
 * StackDrove HRMS — Api_Travel.gs
 * Client-callable endpoints for Travel Pre-approvals and Expense claims.
 */

function Api_Travel_getMy() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const isPrivileged = (user.role === 'admin' || user.role === 'hr' || user.role === 'manager');

    const myList = DB.Travel.getByEmp_(user.empId);
    const allList = isPrivileged ? DB.Travel.getAll_().map(t => {
      const emp = DB.Directory.getById_(t.empId);
      return {
        ...t,
        employeeName: emp ? emp.fullName : t.empId,
        department: emp ? emp.department : ''
      };
    }) : [];

    return ok_({
      myList: myList,
      allList: allList
    });
  } catch (e) {
    logError_(e, 'Api_Travel_getMy');
    return fail_('ERROR', e.message);
  }
}

function Api_Travel_create(payload, items) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!payload.purpose || (!payload.estimatedCost && (!items || !items.length))) {
      return fail_('VALIDATION_ERROR', 'Purpose and Amount are required.');
    }

    const totalCost = (items && items.length) 
      ? items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
      : Number(payload.estimatedCost) || 0;

    const approverId = user.managerId || DB.Directory.getAllHrAndAdmins_()[0]?.empId || 'SD-0001';

    const created = DB.Travel.create_({
      ...payload,
      empId: user.empId,
      estimatedCost: totalCost,
      approverEmpId: approverId
    }, items || []);

    logAudit_(user.empId, 'EXPENSE_SUBMIT', 'TravelExpense', created.requestId, payload.requestId, {}, created);

    // Notify approver
    const approverEmail = DB.Directory.getEmail_(approverId);
    if (approverEmail) {
      MailQueue.enqueue(1, approverEmail, 'EXPENSE_SUBMITTED', {
        employeeName: user.fullName,
        type: created.type,
        amount: formatCurrency(created.estimatedCost),
        purpose: created.purpose
      });
    }

    return ok_(created);
  } catch (e) {
    logError_(e, 'Api_Travel_create');
    return fail_('ERROR', e.message);
  }
}

function Api_Travel_action(requestId, action) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    const statusMap = {
      'APPROVE': 'Approved',
      'REJECT': 'Rejected',
      'REIMBURSE': 'Reimbursed'
    };

    const newStatus = statusMap[action];
    if (!newStatus) return fail_('INVALID_ACTION', 'Action not recognized.');

    const updated = DB.Travel.updateStatus_(requestId, newStatus);
    logAudit_(user.empId, 'EXPENSE_' + action, 'TravelExpense', requestId, '', {}, { status: newStatus });
    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Travel_action');
    return fail_('ERROR', e.message);
  }
}
