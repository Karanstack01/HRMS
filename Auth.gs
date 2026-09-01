/**
 * StackDrove HRMS — Auth.gs
 * 4-tier Role-Based Access Control, Session Resolution, and Navigation Definitions.
 */

var Auth = (function() {
  const ROLES = {
    EMPLOYEE: 'employee',
    MANAGER: 'manager',
    HR: 'hr',
    ADMIN: 'admin'
  };

  const ROLE_HIERARCHY = {
    employee: 1,
    manager: 2,
    hr: 3,
    admin: 4
  };

  function getCurrentUser_() {
    let email = '';
    try {
      email = Session.getActiveUser().getEmail();
    } catch (_) {}

    if (!email) {
      try {
        email = Session.getEffectiveUser().getEmail();
      } catch (_) {}
    }

    // Default to admin email if in test environment or email not detected
    if (!email) {
      email = Config.get('ADMIN_EMAIL') || 'admin@stackdrove.com';
    }

    let emp = null;
    try {
      if (typeof DB !== 'undefined' && DB.Directory) {
        emp = DB.Directory.getByEmail_(email);
      }
    } catch (_) {}

    if (!emp) {
      // Return temporary admin context during initial setup
      return {
        empId: 'SD-0001',
        email: email,
        fullName: 'System Administrator',
        role: ROLES.ADMIN,
        department: 'Executive',
        designation: 'Super Admin',
        managerId: '',
        status: 'active',
        photoUrl: '',
        location: 'Headquarters'
      };
    }

    return emp;
  }

  function hasRole_(user, requiredRole) {
    if (!user || !user.role) return false;
    const userRank = ROLE_HIERARCHY[user.role.toLowerCase()] || 0;
    const reqRank = ROLE_HIERARCHY[requiredRole.toLowerCase()] || 99;
    return userRank >= reqRank;
  }

  function requireRole_(allowedRoles) {
    const user = getCurrentUser_();
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    const isAuthorized = rolesArray.some(r => {
      if (r === 'any') return true;
      return user.role.toLowerCase() === r.toLowerCase() || hasRole_(user, r);
    });

    if (!isAuthorized) {
      throw new Error('FORBIDDEN: User ' + user.email + ' with role [' + user.role + '] is not authorized.');
    }
    return user;
  }

  function getNavForRole_(role) {
    const r = (role || 'employee').toLowerCase();
    const isManager = (r === 'manager' || r === 'hr' || r === 'admin');
    const isHrOrAdmin = (r === 'hr' || r === 'admin');
    const isAdmin = (r === 'admin');

    const nav = [
      { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', module: 'dashboard' },
      { id: 'directory', label: 'Directory', icon: 'users', module: 'directory' },
      { id: 'attendance', label: 'Attendance', icon: 'clock', module: 'attendance' },
      { id: 'leave', label: 'Leave & Time Off', icon: 'calendar-days', module: 'leave' },
      { id: 'holidays', label: 'Holidays', icon: 'calendar', module: 'holidays' },
      { id: 'policies', label: 'Policies', icon: 'book-open', module: 'policies' },
      { id: 'assets', label: 'Assets', icon: 'laptop', module: 'assets' },
      { id: 'rewards', label: 'Rewards & Wall', icon: 'award', module: 'rewards' },
      { id: 'appraisals', label: 'Appraisals', icon: 'trending-up', module: 'appraisals' },
      { id: 'travel', label: 'Travel & Expenses', icon: 'plane', module: 'travel' },
      { id: 'letters', label: 'Letters & Docs', icon: 'file-text', module: 'letters' },
      { id: 'payroll', label: 'Payroll & Slips', icon: 'credit-card', module: 'payroll' },
      { id: 'resignation', label: 'Offboarding', icon: 'log-out', module: 'resignation' },
      { id: 'profile', label: 'My Profile', icon: 'user', module: 'profile' }
    ];

    if (isAdmin || isHrOrAdmin) {
      nav.push({ id: 'admin', label: 'Admin Console', icon: 'shield-alert', module: 'admin', isSpecial: true });
    }

    return nav;
  }

  function resolveUserForPunch_(empIdOverride, pin) {
    if (empIdOverride) {
      const emp = DB.Directory.getById_(empIdOverride);
      if (!emp) throw new Error('Employee ID not found: ' + empIdOverride);

      if (Config.get('ALLOW_PIN_PUNCH') === 'true') {
        const props = PropertiesService.getUserProperties();
        const storedPin = props.getProperty('PIN_' + empIdOverride) || (emp.phone ? String(emp.phone).slice(-4) : '1234');
        if (pin && String(pin) !== storedPin) {
          throw new Error('Invalid Security PIN for ' + empIdOverride);
        }
      }
      return emp;
    }
    return getCurrentUser_();
  }

  return {
    ROLES: ROLES,
    getCurrentUser_: getCurrentUser_,
    hasRole_: hasRole_,
    requireRole_: requireRole_,
    getNavForRole_: getNavForRole_,
    resolveUserForPunch_: resolveUserForPunch_
  };
})();
