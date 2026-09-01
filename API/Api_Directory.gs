/**
 * StackDrove HRMS — Api_Directory.gs
 * Client-callable endpoints for Employee Directory and Org Chart.
 */

function Api_Directory_list() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const all = DB.Directory.getAll_();

    // Field masking based on role
    const sanitized = all.map(emp => {
      const isSelf = (emp.empId === user.empId);
      const isPrivileged = (user.role === 'admin' || user.role === 'hr');
      const isDirectReport = (user.role === 'manager' && emp.managerId === user.empId);

      if (isSelf || isPrivileged || isDirectReport) {
        return emp;
      }

      // Mask sensitive fields for general colleagues
      return {
        empId: emp.empId,
        fullName: emp.fullName,
        email: emp.email,
        phone: maskString_(emp.phone, 3),
        photoUrl: emp.photoUrl,
        department: emp.department,
        designation: emp.designation,
        role: emp.role,
        managerId: emp.managerId,
        location: emp.location,
        reportingLocation: emp.reportingLocation,
        employmentType: emp.employmentType,
        status: emp.status,
        dateOfJoining: emp.dateOfJoining
      };
    });

    return ok_(sanitized);
  } catch (e) {
    logError_(e, 'Api_Directory_list');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Directory_get(empId) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const emp = DB.Directory.getById_(empId);
    if (!emp) return fail_('NOT_FOUND', 'Employee record not found');

    const isSelf = (emp.empId === user.empId);
    const isPrivileged = (user.role === 'admin' || user.role === 'hr');
    const isDirectReport = (user.role === 'manager' && emp.managerId === user.empId);

    if (isSelf || isPrivileged || isDirectReport) {
      return ok_(emp);
    }

    return ok_({
      empId: emp.empId,
      fullName: emp.fullName,
      email: emp.email,
      phone: maskString_(emp.phone, 3),
      photoUrl: emp.photoUrl,
      department: emp.department,
      designation: emp.designation,
      role: emp.role,
      managerId: emp.managerId,
      location: emp.location,
      reportingLocation: emp.reportingLocation,
      employmentType: emp.employmentType,
      status: emp.status,
      dateOfJoining: emp.dateOfJoining
    });
  } catch (e) {
    logError_(e, 'Api_Directory_get');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Directory_save(payload) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    if (!payload || !payload.fullName || !payload.email) {
      return fail_('VALIDATION_ERROR', 'Full name and email are required.');
    }

    let result;
    if (payload.empId) {
      const existing = DB.Directory.getById_(payload.empId);
      if (!existing) return fail_('NOT_FOUND', 'Employee does not exist.');
      result = DB.Directory.update_(payload.empId, payload);
      logAudit_(user.empId, 'DIRECTORY_UPDATE', 'Directory', payload.empId, payload.requestId, existing, result);
    } else {
      const existingEmail = DB.Directory.getByEmail_(payload.email);
      if (existingEmail) return fail_('DUPLICATE_EMAIL', 'An employee with this email already exists.');
      result = DB.Directory.create_(payload);
      logAudit_(user.empId, 'DIRECTORY_CREATE', 'Directory', result.empId, payload.requestId, {}, result);

      // Trigger Onboarding Welcome Email
      MailQueue.enqueue(1, result.email, 'WELCOME_ONBOARD', {
        employeeName: result.fullName,
        startDate: result.dateOfJoining,
        managerName: DB.Directory.getById_(result.managerId)?.fullName || 'HR Team',
        empId: result.empId,
        appUrl: MailDispatcher.buildAppUrl_()
      });
    }

    return ok_(result);
  } catch (e) {
    logError_(e, 'Api_Directory_save');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Directory_getOrgChart() {
  try {
    Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const all = DB.Directory.getAll_().filter(e => e.status === 'active');
    
    // Build tree
    const map = {};
    all.forEach(e => {
      map[e.empId] = {
        empId: e.empId,
        name: e.fullName,
        title: e.designation,
        dept: e.department,
        photo: e.photoUrl,
        managerId: e.managerId,
        children: []
      };
    });

    const roots = [];
    all.forEach(e => {
      if (e.managerId && map[e.managerId]) {
        map[e.managerId].children.push(map[e.empId]);
      } else {
        roots.push(map[e.empId]);
      }
    });

    return ok_(roots);
  } catch (e) {
    logError_(e, 'Api_Directory_getOrgChart');
    return fail_('ERROR', e.message);
  }
}
