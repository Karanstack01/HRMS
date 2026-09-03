/**
 * StackDrove HRMS — Sheet_Directory.gs
 * Data access layer for Employee Master table.
 * Supports dynamic header mapping, case-insensitive sheet discovery, and robust CRUD.
 */

var DB = DB || {};

DB.Directory = (function() {
  const STANDARD_HEADERS = [
    'empId', 'fullName', 'email', 'phone', 'photoUrl', 'department', 'designation',
    'role', 'managerId', 'dateOfJoining', 'dateOfBirth', 'employmentType', 'status',
    'location', 'reportingLocation', 'ctcAnnual', 'emergencyContact', 'address',
    'bloodGroup', 'dateOfExit', 'createdAt', 'updatedAt'
  ];

  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Directory');
    if (!s) {
      // Find case-insensitively or by common aliases
      const allSheets = ss.getSheets();
      for (let i = 0; i < allSheets.length; i++) {
        const name = allSheets[i].getName().trim().toLowerCase();
        if (name === 'directory' || name === 'employees' || name === 'employee directory' || name === 'staff') {
          s = allSheets[i];
          break;
        }
      }
    }
    if (!s) {
      s = ss.insertSheet('Directory');
      s.appendRow(STANDARD_HEADERS);
      s.setFrozenRows(1);
    }
    return s;
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    const lastCol = s.getLastColumn();
    if (lastRow <= 1 || lastCol < 1) return [];

    // Read headers dynamically from Row 1
    const rawHeaders = s.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerMap = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      const h = String(rawHeaders[c] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (h) headerMap[h] = c;
    }

    function findCol(aliases, defaultIdx) {
      for (let i = 0; i < aliases.length; i++) {
        const key = aliases[i].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (headerMap[key] !== undefined) return headerMap[key];
      }
      return (defaultIdx !== undefined && defaultIdx < lastCol) ? defaultIdx : -1;
    }

    const idxEmpId = findCol(['empId', 'employeeId', 'id', 'emp_id', 'code', 'empcode', 'staffid', 'slno', 'serialno'], 0);
    const idxName = findCol(['fullName', 'name', 'employeeName', 'empName', 'full_name', 'personname'], 1);
    const idxEmail = findCol(['email', 'workEmail', 'emailAddress', 'mail', 'emailid'], 2);
    const idxPhone = findCol(['phone', 'mobile', 'contact', 'phoneNumber', 'telephone', 'mobilephone'], 3);
    const idxPhoto = findCol(['photoUrl', 'photo', 'avatar', 'imageUrl', 'image', 'picture'], 4);
    const idxDept = findCol(['department', 'dept', 'division', 'team', 'businessunit'], 5);
    const idxDesig = findCol(['designation', 'title', 'roleTitle', 'position', 'jobTitle', 'designationtitle'], 6);
    const idxRole = findCol(['role', 'roleTier', 'accessRole', 'tier', 'userRole'], 7);
    const idxManagerId = findCol(['managerId', 'manager', 'reportingManager', 'reportsTo', 'managerEmpId'], 8);
    const idxDoj = findCol(['dateOfJoining', 'doj', 'joiningDate', 'startDate', 'hireDate', 'datejoined'], 9);
    const idxDob = findCol(['dateOfBirth', 'dob', 'birthDate', 'birthday'], 10);
    const idxEmpType = findCol(['employmentType', 'empType', 'type', 'contractType'], 11);
    const idxStatus = findCol(['status', 'employmentStatus', 'state', 'active'], 12);
    const idxLocation = findCol(['location', 'officeLocation', 'office', 'branch', 'city'], 13);
    const idxReportingLoc = findCol(['reportingLocation', 'workMode', 'mode', 'workType'], 14);
    const idxCtc = findCol(['ctcAnnual', 'ctc', 'annualCtc', 'salary', 'grossPay', 'package'], 15);
    const idxEmergency = findCol(['emergencyContact', 'emergencyPhone', 'emergency'], 16);
    const idxAddress = findCol(['address', 'permanentAddress', 'residence'], 17);
    const idxBlood = findCol(['bloodGroup', 'blood', 'bg'], 18);
    const idxExit = findCol(['dateOfExit', 'doe', 'exitDate', 'lastWorkingDay'], 19);

    const values = s.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const result = [];

    for (let r = 0; r < values.length; r++) {
      const row = values[r];
      // Skip empty row
      const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
      if (!hasData) continue;

      const nameVal = idxName !== -1 ? String(row[idxName] || '').trim() : '';
      const emailVal = idxEmail !== -1 ? String(row[idxEmail] || '').trim().toLowerCase() : '';
      let idVal = idxEmpId !== -1 ? String(row[idxEmpId] || '').trim() : '';

      // Fallback ID if missing
      if (!idVal) {
        if (!nameVal && !emailVal) continue;
        idVal = 'SD-' + String(1000 + r + 1).padStart(4, '0');
      }

      result.push({
        empId: idVal,
        fullName: nameVal || idVal,
        email: emailVal || (idVal.toLowerCase() + '@stackdrove.com'),
        phone: idxPhone !== -1 ? String(row[idxPhone] || '') : '',
        photoUrl: idxPhoto !== -1 ? String(row[idxPhoto] || '') : '',
        department: idxDept !== -1 ? String(row[idxDept] || 'General') : 'General',
        designation: idxDesig !== -1 ? String(row[idxDesig] || 'Staff') : 'Staff',
        role: idxRole !== -1 ? String(row[idxRole] || 'employee').toLowerCase().trim() : 'employee',
        managerId: idxManagerId !== -1 ? String(row[idxManagerId] || '') : '',
        dateOfJoining: idxDoj !== -1 && row[idxDoj] ? (typeof formatDate_ === 'function' ? formatDate_(row[idxDoj], 'yyyy-MM-dd') : String(row[idxDoj])) : '',
        dateOfBirth: idxDob !== -1 && row[idxDob] ? (typeof formatDate_ === 'function' ? formatDate_(row[idxDob], 'yyyy-MM-dd') : String(row[idxDob])) : '',
        employmentType: idxEmpType !== -1 ? String(row[idxEmpType] || 'full-time') : 'full-time',
        status: idxStatus !== -1 ? String(row[idxStatus] || 'active').trim().toLowerCase() : 'active',
        location: idxLocation !== -1 ? String(row[idxLocation] || 'Headquarters') : 'Headquarters',
        reportingLocation: idxReportingLoc !== -1 ? String(row[idxReportingLoc] || 'onsite').trim().toLowerCase() : 'onsite',
        ctcAnnual: idxCtc !== -1 ? Number(row[idxCtc]) || 0 : 0,
        emergencyContact: idxEmergency !== -1 ? String(row[idxEmergency] || '') : '',
        address: idxAddress !== -1 ? String(row[idxAddress] || '') : '',
        bloodGroup: idxBlood !== -1 ? String(row[idxBlood] || '') : '',
        dateOfExit: idxExit !== -1 && row[idxExit] ? (typeof formatDate_ === 'function' ? formatDate_(row[idxExit], 'yyyy-MM-dd') : String(row[idxExit])) : '',
        rowNumber: r + 2
      });
    }

    return result;
  }

  function getById_(empId) {
    if (!empId) return null;
    const all = getAll_();
    const target = String(empId).trim().toLowerCase();
    return all.find(e => String(e.empId).trim().toLowerCase() === target) || null;
  }

  function getByEmail_(email) {
    if (!email) return null;
    const all = getAll_();
    const target = String(email).trim().toLowerCase();
    return all.find(e => String(e.email).trim().toLowerCase() === target) || null;
  }

  function create_(payload) {
    return withLock_(() => {
      const s = _sheet();
      const empId = payload.empId || (typeof generateSequentialId_ === 'function' ? generateSequentialId_('SD-', 'COUNTER_EMPID', 4) : ('SD-' + Date.now().toString().slice(-4)));
      const now = new Date();

      const lastCol = Math.max(1, s.getLastColumn());
      const rawHeaders = s.getRange(1, 1, 1, lastCol).getValues()[0];
      const headerMap = {};
      rawHeaders.forEach((h, idx) => {
        const key = String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (key) headerMap[key] = idx;
      });

      const row = new Array(lastCol).fill('');

      function setVal(aliases, val) {
        for (let i = 0; i < aliases.length; i++) {
          const key = aliases[i].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (headerMap[key] !== undefined) {
            row[headerMap[key]] = val;
            return;
          }
        }
      }

      setVal(['empId', 'id', 'employeeId'], empId);
      setVal(['fullName', 'name', 'employeeName'], payload.fullName || '');
      setVal(['email', 'workEmail'], (payload.email || '').toLowerCase().trim());
      setVal(['phone', 'mobile'], payload.phone || '');
      setVal(['photoUrl', 'photo'], payload.photoUrl || '');
      setVal(['department', 'dept'], payload.department || '');
      setVal(['designation', 'title'], payload.designation || '');
      setVal(['role', 'roleTier'], (payload.role || 'employee').toLowerCase());
      setVal(['managerId', 'manager'], payload.managerId || '');
      setVal(['dateOfJoining', 'doj'], payload.dateOfJoining || (typeof todayStr_ === 'function' ? todayStr_() : new Date().toISOString().split('T')[0]));
      setVal(['dateOfBirth', 'dob'], payload.dateOfBirth || '');
      setVal(['employmentType'], payload.employmentType || 'full-time');
      setVal(['status'], payload.status || 'active');
      setVal(['location'], payload.location || 'Headquarters (Bangalore)');
      setVal(['reportingLocation', 'workMode'], payload.reportingLocation || 'onsite');
      setVal(['ctcAnnual', 'ctc'], Number(payload.ctcAnnual) || 0);
      setVal(['emergencyContact'], payload.emergencyContact || '');
      setVal(['createdAt'], now);
      setVal(['updatedAt'], now);

      if (!row[0]) row[0] = empId;
      if (!row[1] && payload.fullName) row[1] = payload.fullName;
      if (!row[2] && payload.email) row[2] = payload.email;

      s.appendRow(row);

      // Initialize Leave balances if service exists
      try {
        if (typeof DB !== 'undefined' && DB.LeaveBalances && DB.LeaveBalances.setInitial_) {
          const currentYear = new Date().getFullYear();
          ['Casual', 'Sick', 'Earned'].forEach(t => {
            const opening = t === 'Casual' ? 15 : (t === 'Sick' ? 12 : 21);
            DB.LeaveBalances.setInitial_(empId, t, opening, currentYear);
          });
        }
      } catch (balErr) {
        console.warn('Initial balances notice:', balErr);
      }

      return getById_(empId) || { empId: empId, fullName: payload.fullName, email: payload.email, department: payload.department, designation: payload.designation, status: 'active' };
    });
  }

  function update_(empId, updates) {
    return withLock_(() => {
      const s = _sheet();
      const all = getAll_();
      const target = all.find(e => String(e.empId).trim().toLowerCase() === String(empId).trim().toLowerCase());
      if (!target || !target.rowNumber) return null;

      const lastCol = Math.max(1, s.getLastColumn());
      const rawHeaders = s.getRange(1, 1, 1, lastCol).getValues()[0];
      const headerMap = {};
      rawHeaders.forEach((h, idx) => {
        const key = String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (key) headerMap[key] = idx;
      });

      const rowValues = s.getRange(target.rowNumber, 1, 1, lastCol).getValues()[0];

      function updateCell(aliases, val) {
        if (val === undefined) return;
        for (let i = 0; i < aliases.length; i++) {
          const key = aliases[i].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (headerMap[key] !== undefined) {
            rowValues[headerMap[key]] = val;
            return;
          }
        }
      }

      updateCell(['fullName', 'name'], updates.fullName);
      updateCell(['email', 'workEmail'], updates.email ? String(updates.email).toLowerCase().trim() : undefined);
      updateCell(['phone', 'mobile'], updates.phone);
      updateCell(['photoUrl', 'photo'], updates.photoUrl);
      updateCell(['department', 'dept'], updates.department);
      updateCell(['designation', 'title'], updates.designation);
      updateCell(['role', 'roleTier'], updates.role ? String(updates.role).toLowerCase() : undefined);
      updateCell(['managerId', 'manager'], updates.managerId);
      updateCell(['dateOfJoining', 'doj'], updates.dateOfJoining);
      updateCell(['dateOfBirth', 'dob'], updates.dateOfBirth);
      updateCell(['employmentType'], updates.employmentType);
      updateCell(['status'], updates.status);
      updateCell(['location'], updates.location);
      updateCell(['reportingLocation', 'workMode'], updates.reportingLocation);
      updateCell(['ctcAnnual', 'ctc'], updates.ctcAnnual !== undefined ? Number(updates.ctcAnnual) : undefined);
      updateCell(['emergencyContact'], updates.emergencyContact);
      updateCell(['updatedAt'], new Date());

      s.getRange(target.rowNumber, 1, 1, lastCol).setValues([rowValues]);
      return getById_(empId);
    });
  }

  function getDirectReports_(managerEmpId) {
    if (!managerEmpId) return [];
    return getAll_().filter(e => e.managerId === managerEmpId && e.status === 'active');
  }

  function getAllManagers_() {
    const all = getAll_().filter(e => e.status === 'active');
    const managerIds = new Set(all.map(e => e.managerId).filter(Boolean));
    return all.filter(e => managerIds.has(e.empId) || e.role === 'manager' || e.role === 'admin');
  }

  function getAllHrAndAdmins_() {
    return getAll_().filter(e => (e.role === 'hr' || e.role === 'admin' || e.role === 'executive' || e.role === 'superadmin') && e.status === 'active');
  }

  function getManagerId_(empId) {
    const emp = getById_(empId);
    return emp ? emp.managerId : '';
  }

  function getEmail_(empId) {
    const emp = getById_(empId);
    return emp ? emp.email : '';
  }

  return {
    getAll_: getAll_,
    getById_: getById_,
    getByEmail_: getByEmail_,
    create_: create_,
    update_: update_,
    getDirectReports_: getDirectReports_,
    getAllManagers_: getAllManagers_,
    getAllHrAndAdmins_: getAllHrAndAdmins_,
    getManagerId_: getManagerId_,
    getEmail_: getEmail_
  };
})();
