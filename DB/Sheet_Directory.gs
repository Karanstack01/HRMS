/**
 * StackDrove HRMS — Sheet_Directory.gs
 * Data access layer for Employee Master table.
 */

var DB = DB || {};

DB.Directory = (function() {
  const COL = {
    EMP_ID: 1,
    FULL_NAME: 2,
    EMAIL: 3,
    PHONE: 4,
    PHOTO_URL: 5,
    DEPARTMENT: 6,
    DESIGNATION: 7,
    ROLE: 8,
    MANAGER_ID: 9,
    DOJ: 10,
    DOB: 11,
    EMP_TYPE: 12,
    STATUS: 13,
    LOCATION: 14,
    REPORTING_LOC: 15,
    CTC: 16,
    EMERGENCY_CONTACT: 17,
    ADDRESS: 18,
    BLOOD_GROUP: 19,
    DOE: 20,
    CREATED_AT: 21,
    UPDATED_AT: 22
  };

  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Directory');
    if (!s) {
      s = ss.insertSheet('Directory');
      s.appendRow([
        'empId', 'fullName', 'email', 'phone', 'photoUrl', 'department', 'designation',
        'role', 'managerId', 'dateOfJoining', 'dateOfBirth', 'employmentType', 'status',
        'location', 'reportingLocation', 'ctcAnnual', 'emergencyContact', 'address',
        'bloodGroup', 'dateOfExit', 'createdAt', 'updatedAt'
      ]);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _rowToObj(r) {
    if (!r || !r[0]) return null;
    return {
      empId: String(r[0]),
      fullName: String(r[1] || ''),
      email: String(r[2] || '').toLowerCase(),
      phone: String(r[3] || ''),
      photoUrl: String(r[4] || ''),
      department: String(r[5] || ''),
      designation: String(r[6] || ''),
      role: String(r[7] || 'employee').toLowerCase(),
      managerId: String(r[8] || ''),
      dateOfJoining: r[9] ? formatDate_(r[9], 'yyyy-MM-dd') : '',
      dateOfBirth: r[10] ? formatDate_(r[10], 'yyyy-MM-dd') : '',
      employmentType: String(r[11] || 'full-time'),
      status: String(r[12] || 'active'),
      location: String(r[13] || ''),
      reportingLocation: String(r[14] || 'onsite'),
      ctcAnnual: Number(r[15]) || 0,
      emergencyContact: String(r[16] || ''),
      address: String(r[17] || ''),
      bloodGroup: String(r[18] || ''),
      dateOfExit: r[19] ? formatDate_(r[19], 'yyyy-MM-dd') : '',
      createdAt: r[20],
      updatedAt: r[21]
    };
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 22).getValues();
    return values.map(_rowToObj).filter(Boolean);
  }

  function getById_(empId) {
    if (!empId) return null;
    const all = getAll_();
    return all.find(e => e.empId.toLowerCase() === String(empId).toLowerCase()) || null;
  }

  function getByEmail_(email) {
    if (!email) return null;
    const all = getAll_();
    return all.find(e => e.email.toLowerCase() === String(email).trim().toLowerCase()) || null;
  }

  function create_(payload) {
    return withLock_(() => {
      const s = _sheet();
      const empId = payload.empId || generateSequentialId_('SD-', 'COUNTER_EMPID', 4);
      const now = new Date();
      
      const newRow = [
        empId,
        payload.fullName || '',
        (payload.email || '').toLowerCase().trim(),
        payload.phone || '',
        payload.photoUrl || '',
        payload.department || '',
        payload.designation || '',
        (payload.role || 'employee').toLowerCase(),
        payload.managerId || '',
        payload.dateOfJoining || todayStr_(),
        payload.dateOfBirth || '',
        payload.employmentType || 'full-time',
        payload.status || 'active',
        payload.location || 'Headquarters (Bangalore)',
        payload.reportingLocation || 'onsite',
        Number(payload.ctcAnnual) || 0,
        payload.emergencyContact || '',
        payload.address || '',
        payload.bloodGroup || '',
        '',
        now,
        now
      ];

      s.appendRow(newRow);

      // Initialize Leave balances for the new employee
      try {
        if (DB.LeaveBalances) {
          const currentYear = new Date().getFullYear();
          const types = ['Casual', 'Sick', 'Earned'];
          types.forEach(t => {
            const opening = t === 'Casual' ? 15 : (t === 'Sick' ? 12 : 21);
            DB.LeaveBalances.setInitial_(empId, t, opening, currentYear);
          });
        }
      } catch (e) {
        logError_(e, 'Directory.create_ initialize balances');
      }

      return getById_(empId);
    });
  }

  function update_(empId, updates) {
    return withLock_(() => {
      const s = _sheet();
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return null;
      const ids = s.getRange(2, COL.EMP_ID, lastRow - 1, 1).getValues();

      let targetRow = -1;
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).toLowerCase() === String(empId).toLowerCase()) {
          targetRow = i + 2;
          break;
        }
      }

      if (targetRow === -1) return null;

      const current = s.getRange(targetRow, 1, 1, 22).getValues()[0];
      const merged = [
        current[0], // ID never changes
        updates.fullName !== undefined ? updates.fullName : current[1],
        updates.email !== undefined ? String(updates.email).toLowerCase().trim() : current[2],
        updates.phone !== undefined ? updates.phone : current[3],
        updates.photoUrl !== undefined ? updates.photoUrl : current[4],
        updates.department !== undefined ? updates.department : current[5],
        updates.designation !== undefined ? updates.designation : current[6],
        updates.role !== undefined ? String(updates.role).toLowerCase() : current[7],
        updates.managerId !== undefined ? updates.managerId : current[8],
        updates.dateOfJoining !== undefined ? updates.dateOfJoining : current[9],
        updates.dateOfBirth !== undefined ? updates.dateOfBirth : current[10],
        updates.employmentType !== undefined ? updates.employmentType : current[11],
        updates.status !== undefined ? updates.status : current[12],
        updates.location !== undefined ? updates.location : current[13],
        updates.reportingLocation !== undefined ? updates.reportingLocation : current[14],
        updates.ctcAnnual !== undefined ? Number(updates.ctcAnnual) : current[15],
        updates.emergencyContact !== undefined ? updates.emergencyContact : current[16],
        updates.address !== undefined ? updates.address : current[17],
        updates.bloodGroup !== undefined ? updates.bloodGroup : current[18],
        updates.dateOfExit !== undefined ? updates.dateOfExit : current[19],
        current[20],
        new Date() // updatedAt
      ];

      s.getRange(targetRow, 1, 1, 22).setValues([merged]);
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
    return getAll_().filter(e => (e.role === 'hr' || e.role === 'admin') && e.status === 'active');
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
