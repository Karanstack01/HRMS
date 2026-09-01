/**
 * StackDrove HRMS — Api_Policies.gs
 * Client-callable endpoints for Policies and Digital Acknowledgements.
 */

function Api_Policies_list() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const policies = DB.Policies.getAll_();
    const myAcks = DB.Policies.getAcksForEmp_(user.empId);
    const ackMap = {};
    myAcks.forEach(a => {
      ackMap[a.policyId] = a;
    });

    const enriched = policies.map(p => ({
      ...p,
      isAcknowledged: Boolean(ackMap[p.policyId]),
      acknowledgedOn: ackMap[p.policyId] ? ackMap[p.policyId].acknowledgedOn : null
    }));

    return ok_(enriched);
  } catch (e) {
    logError_(e, 'Api_Policies_list');
    return fail_('ERROR', e.message);
  }
}

function Api_Policies_acknowledge(policyId) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!policyId) return fail_('VALIDATION_ERROR', 'Policy ID is required.');

    const success = DB.Policies.acknowledge_(policyId, user.empId);
    logAudit_(user.empId, 'POLICY_ACKNOWLEDGE', 'Policies', policyId, '', {}, { acknowledged: true });
    return ok_({ acknowledged: success });
  } catch (e) {
    logError_(e, 'Api_Policies_acknowledge');
    return fail_('ERROR', e.message);
  }
}

function Api_Policies_create(payload) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    if (!payload.title || !payload.category) {
      return fail_('VALIDATION_ERROR', 'Title and Category are required.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Policies');
    const id = generateSequentialId_('POL-', 'COUNTER_POLICY', 3);
    const effective = payload.effectiveDate || todayStr_();

    s.appendRow([
      id,
      payload.title,
      payload.category,
      payload.description || '',
      payload.documentUrl || '',
      payload.version || '1.0',
      effective,
      Boolean(payload.mandatoryAck),
      'Published'
    ]);

    logAudit_(user.empId, 'POLICY_CREATE', 'Policies', id, payload.requestId, {}, payload);

    // If mandatory, broadcast to all active employees via Priority 3 email queue
    if (payload.mandatoryAck) {
      const activeEmployees = DB.Directory.getAll_().filter(e => e.status === 'active');
      activeEmployees.forEach(emp => {
        MailQueue.enqueue(3, emp.email, 'POLICY_PUBLISHED', {
          policyTitle: payload.title,
          category: payload.category,
          effectiveDate: effective
        });
      });
    }

    return ok_({ policyId: id });
  } catch (e) {
    logError_(e, 'Api_Policies_create');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}
