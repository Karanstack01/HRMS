/**
 * StackDrove HRMS — Api_Directory.gs
 * Client-callable endpoints for Employee Directory and Org Chart.
 */

function Api_Directory_list() {
  try {
    const all = (typeof DB !== 'undefined' && DB.Directory) ? DB.Directory.getAll_() : [];
    return ok_(all);
  } catch (e) {
    logError_(e, 'Api_Directory_list');
    return fail_('ERROR', e.message || String(e));
  }
}

function Api_Directory_get(empId) {
  try {
    if (!empId) return fail_('VALIDATION_ERROR', 'Employee ID is required.');
    const emp = (typeof DB !== 'undefined' && DB.Directory) ? DB.Directory.getById_(empId) : null;
    if (!emp) return fail_('NOT_FOUND', 'Employee record not found');
    return ok_(emp);
  } catch (e) {
    logError_(e, 'Api_Directory_get');
    return fail_('ERROR', e.message || String(e));
  }
}

function Api_Directory_save(payload) {
  try {
    let user = null;
    try {
      if (typeof Auth !== 'undefined' && Auth.getCurrentUser_) {
        user = Auth.getCurrentUser_();
      }
    } catch (_) {}

    if (!payload || !payload.fullName || !payload.email) {
      return fail_('VALIDATION_ERROR', 'Full name and email are required.');
    }

    let result;
    if (payload.empId) {
      const existing = DB.Directory.getById_(payload.empId);
      result = DB.Directory.update_(payload.empId, payload);
      try {
        if (user && typeof logAudit_ === 'function') {
          logAudit_(user.empId, 'DIRECTORY_UPDATE', 'Directory', payload.empId, payload.requestId || '', existing, result);
        }
      } catch (_) {}
    } else {
      const existingEmail = DB.Directory.getByEmail_(payload.email);
      if (existingEmail) {
        return fail_('DUPLICATE_EMAIL', 'An employee with email ' + payload.email + ' already exists (' + existingEmail.empId + ').');
      }
      result = DB.Directory.create_(payload);
      try {
        if (user && typeof logAudit_ === 'function') {
          logAudit_(user.empId, 'DIRECTORY_CREATE', 'Directory', result.empId, payload.requestId || '', {}, result);
        }
      } catch (_) {}

      // Non-blocking welcome email
      try {
        if (typeof MailQueue !== 'undefined' && MailQueue.enqueue) {
          const mgr = result.managerId ? DB.Directory.getById_(result.managerId) : null;
          MailQueue.enqueue(1, result.email, 'WELCOME_ONBOARD', {
            employeeName: result.fullName,
            startDate: result.dateOfJoining,
            managerName: mgr ? mgr.fullName : 'HR Team',
            empId: result.empId,
            appUrl: (typeof MailDispatcher !== 'undefined' && MailDispatcher.buildAppUrl_) ? MailDispatcher.buildAppUrl_() : ''
          });
        }
      } catch (mailErr) {
        console.warn('Welcome onboarding email notice (non-fatal):', mailErr);
      }
    }

    return ok_(result);
  } catch (e) {
    logError_(e, 'Api_Directory_save');
    return fail_('ERROR', e.message || String(e));
  }
}

function Api_Directory_getOrgChart() {
  try {
    const all = (typeof DB !== 'undefined' && DB.Directory) 
      ? DB.Directory.getAll_().filter(e => (e.status || 'active').toLowerCase() === 'active')
      : [];
    
    if (!all.length) {
      return ok_([]);
    }

    // Build map
    const map = {};
    all.forEach(e => {
      map[e.empId] = {
        empId: e.empId,
        name: e.fullName,
        title: e.designation || 'Staff',
        dept: e.department || 'General',
        photo: e.photoUrl || '',
        managerId: e.managerId || '',
        children: []
      };
    });

    const roots = [];
    all.forEach(e => {
      const node = map[e.empId];
      if (e.managerId && e.managerId !== e.empId && map[e.managerId]) {
        map[e.managerId].children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Fallback if no root was found
    if (roots.length === 0 && all.length > 0) {
      roots.push(map[all[0].empId]);
    }

    return ok_(roots);
  } catch (e) {
    logError_(e, 'Api_Directory_getOrgChart');
    return fail_('ERROR', e.message || String(e));
  }
}
