/**
 * StackDrove HRMS — Api_Holidays.gs
 * Client-callable endpoints for Holiday Calendar.
 */

function Api_Holidays_list() {
  try {
    Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const holidays = DB.Holidays.getAll_();
    return ok_(holidays);
  } catch (e) {
    logError_(e, 'Api_Holidays_list');
    return fail_('ERROR', e.message);
  }
}

function Api_Holidays_create(payload) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    if (!payload.date || !payload.name) {
      return fail_('VALIDATION_ERROR', 'Date and Holiday Name are required.');
    }
    const created = DB.Holidays.create_(payload);
    logAudit_(user.empId, 'HOLIDAY_CREATE', 'Holidays', created.holidayId, payload.requestId, {}, created);
    return ok_(created);
  } catch (e) {
    logError_(e, 'Api_Holidays_create');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Holidays_delete(holidayId) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    const success = DB.Holidays.delete_(holidayId);
    if (!success) return fail_('NOT_FOUND', 'Holiday not found.');
    logAudit_(user.empId, 'HOLIDAY_DELETE', 'Holidays', holidayId, '', {}, {});
    return ok_({ deleted: true });
  } catch (e) {
    logError_(e, 'Api_Holidays_delete');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}
