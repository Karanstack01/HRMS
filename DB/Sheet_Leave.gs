/**
 * StackDrove HRMS — Sheet_Leave.gs
 * Data access layer for Leave Requests, Balance calculations, and State Machine.
 */

var DB = DB || {};

DB.Leave = (function() {
  const COL = {
    LEAVE_ID: 1,
    EMP_ID: 2,
    TYPE: 3,
    FROM_DATE: 4,
    TO_DATE: 5,
    DAY_COUNT: 6,
    IS_HALF_DAY: 7,
    HALF_SESSION: 8,
    REASON: 9,
    STATUS: 10,
    APPLIED_ON: 11,
    APPROVER_ID: 12,
    ACTIONED_ON: 13,
    ACTION_REMARKS: 14,
    ATTACHMENT_URL: 15,
    ROW_VERSION: 16
  };

  function _reqSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('LeaveRequests');
    if (!s) {
      s = ss.insertSheet('LeaveRequests');
      s.appendRow([
        'leaveId', 'empId', 'leaveType', 'fromDate', 'toDate', 'dayCount', 'isHalfDay',
        'halfSession', 'reason', 'status', 'appliedOn', 'approverEmpId', 'actionedOn',
        'actionRemarks', 'attachmentUrl', 'rowVersion'
      ]);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _rowToObj(r) {
    if (!r || !r[0]) return null;
    return {
      leaveId: String(r[0]),
      empId: String(r[1]),
      leaveType: String(r[2]),
      fromDate: r[3] ? formatDate_(r[3], 'yyyy-MM-dd') : '',
      toDate: r[4] ? formatDate_(r[4], 'yyyy-MM-dd') : '',
      dayCount: Number(r[5]) || 0,
      isHalfDay: Boolean(r[6]),
      halfSession: String(r[7] || ''),
      reason: String(r[8] || ''),
      status: String(r[9] || 'Pending'),
      appliedOn: r[10] ? formatDate_(r[10], "yyyy-MM-dd'T'HH:mm:ss") : '',
      approverEmpId: String(r[11] || ''),
      actionedOn: r[12] ? formatDate_(r[12], "yyyy-MM-dd'T'HH:mm:ss") : '',
      actionRemarks: String(r[13] || ''),
      attachmentUrl: String(r[14] || ''),
      rowVersion: r[15]
    };
  }

  function getById_(leaveId) {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return null;
    const values = s.getRange(2, 1, lastRow - 1, 16).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(leaveId)) {
        const obj = _rowToObj(values[i]);
        obj.rowIdx = i + 2;
        return obj;
      }
    }
    return null;
  }

  function getByEmp_(empId) {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 16).getValues();
    return values
      .filter(r => String(r[COL.EMP_ID - 1]).toLowerCase() === empId.toLowerCase())
      .map(_rowToObj)
      .reverse();
  }

  function getPendingForApprover_(approverEmpId) {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 16).getValues();
    return values
      .filter(r => String(r[COL.STATUS - 1]) === 'Pending' && (String(r[COL.APPROVER_ID - 1]) === approverEmpId || approverEmpId === 'ALL'))
      .map(_rowToObj);
  }

  function create_(payload) {
    return withLock_(() => {
      const s = _reqSheet();
      const id = payload.leaveId || generateUuid_();
      const now = new Date();

      s.appendRow([
        id,
        payload.empId,
        payload.leaveType,
        payload.fromDate,
        payload.toDate,
        payload.dayCount,
        Boolean(payload.isHalfDay),
        payload.halfSession || '',
        payload.reason || '',
        'Pending',
        now,
        payload.approverEmpId || '',
        '',
        '',
        payload.attachmentUrl || '',
        now.getTime()
      ]);

      return getById_(id);
    });
  }

  function updateStatus_(leaveId, newStatus, remarks, actionedByEmpId) {
    return withLock_(() => {
      const s = _reqSheet();
      const leave = getById_(leaveId);
      if (!leave) return null;

      const rowIdx = leave.rowIdx;
      s.getRange(rowIdx, COL.STATUS).setValue(newStatus);
      s.getRange(rowIdx, COL.ACTIONED_ON).setValue(new Date());
      s.getRange(rowIdx, COL.ACTION_REMARKS).setValue(remarks || '');
      s.getRange(rowIdx, COL.ROW_VERSION).setValue(new Date().getTime());

      // If approved, deduct leave balance
      if (newStatus === 'Approved' && DB.LeaveBalances) {
        DB.LeaveBalances.deduct_(leave.empId, leave.leaveType, leave.dayCount);
      } else if (newStatus === 'Cancelled' && leave.status === 'Approved' && DB.LeaveBalances) {
        // Reverse balance deduction if cancelled after approval
        DB.LeaveBalances.restore_(leave.empId, leave.leaveType, leave.dayCount);
      }

      return getById_(leaveId);
    });
  }

  return {
    getById_: getById_,
    getByEmp_: getByEmp_,
    getPendingForApprover_: getPendingForApprover_,
    create_: create_,
    updateStatus_: updateStatus_
  };
})();

DB.LeaveBalances = (function() {
  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('LeaveBalances');
    if (!s) {
      s = ss.insertSheet('LeaveBalances');
      s.appendRow(['empId', 'leaveType', 'opening', 'accrued', 'used', 'adjusted', 'balance', 'year']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function getByEmp_(empId, year) {
    const s = _sheet();
    const lastRow = s.getLastRow();
    const yr = year || new Date().getFullYear();
    if (lastRow <= 1) return [];

    const values = s.getRange(2, 1, lastRow - 1, 8).getValues();
    return values
      .filter(r => String(r[0]).toLowerCase() === empId.toLowerCase() && Number(r[7]) === yr)
      .map(r => ({
        empId: String(r[0]),
        leaveType: String(r[1]),
        opening: Number(r[2]) || 0,
        accrued: Number(r[3]) || 0,
        used: Number(r[4]) || 0,
        adjusted: Number(r[5]) || 0,
        balance: Number(r[6]) || 0,
        year: Number(r[7])
      }));
  }

  function setInitial_(empId, leaveType, opening, year) {
    const s = _sheet();
    const yr = year || new Date().getFullYear();
    s.appendRow([empId, leaveType, opening, 0, 0, 0, opening, yr]);
  }

  function deduct_(empId, leaveType, days) {
    if (leaveType === 'Unpaid') return true;
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return false;
    const yr = new Date().getFullYear();

    const values = s.getRange(2, 1, lastRow - 1, 8).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      if (String(r[0]).toLowerCase() === empId.toLowerCase() && String(r[1]) === leaveType && Number(r[7]) === yr) {
        const used = (Number(r[4]) || 0) + days;
        const balance = Math.max(0, (Number(r[2]) || 0) + (Number(r[3]) || 0) + (Number(r[5]) || 0) - used);
        s.getRange(i + 2, 5).setValue(used);
        s.getRange(i + 2, 7).setValue(balance);
        return true;
      }
    }
    return false;
  }

  function restore_(empId, leaveType, days) {
    if (leaveType === 'Unpaid') return true;
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return false;
    const yr = new Date().getFullYear();

    const values = s.getRange(2, 1, lastRow - 1, 8).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      if (String(r[0]).toLowerCase() === empId.toLowerCase() && String(r[1]) === leaveType && Number(r[7]) === yr) {
        const used = Math.max(0, (Number(r[4]) || 0) - days);
        const balance = (Number(r[2]) || 0) + (Number(r[3]) || 0) + (Number(r[5]) || 0) - used;
        s.getRange(i + 2, 5).setValue(used);
        s.getRange(i + 2, 7).setValue(balance);
        return true;
      }
    }
    return false;
  }

  return {
    getByEmp_: getByEmp_,
    setInitial_: setInitial_,
    deduct_: deduct_,
    restore_: restore_
  };
})();
