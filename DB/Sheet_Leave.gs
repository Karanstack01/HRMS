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
      const all = ss.getSheets();
      for (let i = 0; i < all.length; i++) {
        const name = all[i].getName().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (name === 'leaverequests' || name === 'leave' || name === 'leaverequest') {
          s = all[i];
          break;
        }
      }
    }
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

  function _getColumnMap(s) {
    const lastCol = Math.max(1, s.getLastColumn());
    const rawHeaders = s.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = {};
    rawHeaders.forEach((h, idx) => {
      const key = String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key) map[key] = idx;
    });

    function findCol(aliases, defaultIdx) {
      for (let i = 0; i < aliases.length; i++) {
        const key = aliases[i].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (map[key] !== undefined) return map[key];
      }
      return (defaultIdx !== undefined && defaultIdx < lastCol) ? defaultIdx : -1;
    }

    return {
      leaveId: findCol(['leaveId', 'id', 'requestId'], 0),
      empId: findCol(['empId', 'employeeId', 'id', 'emp_id'], 1),
      leaveType: findCol(['leaveType', 'type', 'category'], 2),
      fromDate: findCol(['fromDate', 'start', 'from'], 3),
      toDate: findCol(['toDate', 'end', 'to'], 4),
      dayCount: findCol(['dayCount', 'days', 'duration'], 5),
      isHalfDay: findCol(['isHalfDay', 'halfDay'], 6),
      halfSession: findCol(['halfSession', 'session'], 7),
      reason: findCol(['reason', 'remarks', 'note'], 8),
      status: findCol(['status', 'state'], 9),
      appliedOn: findCol(['appliedOn', 'createdOn', 'timestamp', 'date'], 10),
      approverEmpId: findCol(['approverEmpId', 'approverId', 'managerId'], 11),
      actionedOn: findCol(['actionedOn', 'approvedOn'], 12),
      actionRemarks: findCol(['actionRemarks', 'approverRemarks', 'comments'], 13),
      attachmentUrl: findCol(['attachmentUrl', 'attachment'], 14),
      rowVersion: findCol(['rowVersion', 'version'], 15),
      lastCol: lastCol
    };
  }

  function _rowToObj(r, colMap) {
    if (!r) return null;
    const getVal = (idx, defaultVal = '') => (idx !== -1 && idx < r.length && r[idx] !== undefined && r[idx] !== null) ? r[idx] : defaultVal;

    const leaveId = String(getVal(colMap.leaveId, ''));
    if (!leaveId) return null;

    const rawFrom = getVal(colMap.fromDate);
    const rawTo = getVal(colMap.toDate);
    const rawApplied = getVal(colMap.appliedOn);
    const rawActioned = getVal(colMap.actionedOn);

    const normDate = (v) => {
      if (!v) return '';
      if (v instanceof Date && !isNaN(v.getTime())) {
        try {
          return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
        } catch (_) {
          return Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd');
        }
      }
      return String(v).split('T')[0];
    };

    return {
      leaveId: leaveId,
      empId: String(getVal(colMap.empId, '')),
      leaveType: String(getVal(colMap.leaveType, 'Casual')),
      fromDate: normDate(rawFrom),
      toDate: normDate(rawTo),
      dayCount: Number(getVal(colMap.dayCount, 0)) || 0,
      isHalfDay: Boolean(getVal(colMap.isHalfDay, false)),
      halfSession: String(getVal(colMap.halfSession, '')),
      reason: String(getVal(colMap.reason, '')),
      status: String(getVal(colMap.status, 'Pending')),
      appliedOn: rawApplied ? (typeof formatDate_ === 'function' ? formatDate_(rawApplied, "yyyy-MM-dd'T'HH:mm:ss") : String(rawApplied)) : '',
      approverEmpId: String(getVal(colMap.approverEmpId, '')),
      actionedOn: rawActioned ? (typeof formatDate_ === 'function' ? formatDate_(rawActioned, "yyyy-MM-dd'T'HH:mm:ss") : String(rawActioned)) : '',
      actionRemarks: String(getVal(colMap.actionRemarks, '')),
      attachmentUrl: String(getVal(colMap.attachmentUrl, '')),
      rowVersion: getVal(colMap.rowVersion, '')
    };
  }

  function getById_(leaveId) {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return null;
    const colMap = _getColumnMap(s);
    const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const rId = colMap.leaveId !== -1 ? String(r[colMap.leaveId] || '') : '';
      if (rId.toLowerCase() === String(leaveId).toLowerCase()) {
        const obj = _rowToObj(r, colMap);
        if (obj) {
          obj.rowIdx = i + 2;
          return obj;
        }
      }
    }
    return null;
  }

  function getByEmp_(empId) {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const colMap = _getColumnMap(s);
    const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
    const results = [];
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const rEmp = colMap.empId !== -1 ? String(r[colMap.empId] || '') : '';
      if (rEmp.toLowerCase() === String(empId).toLowerCase()) {
        const obj = _rowToObj(r, colMap);
        if (obj) {
          obj.rowIdx = i + 2;
          results.push(obj);
        }
      }
    }
    return results.reverse();
  }

  function getPendingForApprover_(approverEmpId) {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const colMap = _getColumnMap(s);
    const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
    const results = [];
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const rStatus = colMap.status !== -1 ? String(r[colMap.status] || '').trim().toLowerCase() : '';
      const rApprover = colMap.approverEmpId !== -1 ? String(r[colMap.approverEmpId] || '').trim().toLowerCase() : '';
      
      const isPending = (rStatus === 'pending');
      const isMatch = (approverEmpId === 'ALL' || !rApprover || rApprover === String(approverEmpId).toLowerCase());

      if (isPending && isMatch) {
        const obj = _rowToObj(r, colMap);
        if (obj) {
          obj.rowIdx = i + 2;
          results.push(obj);
        }
      }
    }
    return results;
  }

  function create_(payload) {
    return withLock_(() => {
      const s = _reqSheet();
      const colMap = _getColumnMap(s);
      const id = payload.leaveId || (typeof generateUuid_ === 'function' ? generateUuid_() : ('LEV-' + Date.now().toString(36).toUpperCase()));
      const now = new Date();

      const row = new Array(Math.max(colMap.lastCol, 16)).fill('');
      if (colMap.leaveId !== -1) row[colMap.leaveId] = id;
      if (colMap.empId !== -1) row[colMap.empId] = payload.empId;
      if (colMap.leaveType !== -1) row[colMap.leaveType] = payload.leaveType;
      if (colMap.fromDate !== -1) row[colMap.fromDate] = payload.fromDate;
      if (colMap.toDate !== -1) row[colMap.toDate] = payload.toDate;
      if (colMap.dayCount !== -1) row[colMap.dayCount] = payload.dayCount;
      if (colMap.isHalfDay !== -1) row[colMap.isHalfDay] = Boolean(payload.isHalfDay);
      if (colMap.halfSession !== -1) row[colMap.halfSession] = payload.halfSession || '';
      if (colMap.reason !== -1) row[colMap.reason] = payload.reason || '';
      if (colMap.status !== -1) row[colMap.status] = 'Pending';
      if (colMap.appliedOn !== -1) row[colMap.appliedOn] = now;
      if (colMap.approverEmpId !== -1) row[colMap.approverEmpId] = payload.approverEmpId || '';
      if (colMap.attachmentUrl !== -1) row[colMap.attachmentUrl] = payload.attachmentUrl || '';
      if (colMap.rowVersion !== -1) row[colMap.rowVersion] = now.getTime();

      s.appendRow(row);
      return getById_(id) || _rowToObj(row, colMap);
    });
  }

  function updateStatus_(leaveId, newStatus, remarks, actionedByEmpId) {
    return withLock_(() => {
      const s = _reqSheet();
      const colMap = _getColumnMap(s);
      const leave = getById_(leaveId);
      if (!leave || !leave.rowIdx) return null;

      const rowIdx = leave.rowIdx;
      const rowRange = s.getRange(rowIdx, 1, 1, colMap.lastCol);
      const rowVals = rowRange.getValues()[0];

      if (colMap.status !== -1 && colMap.status < rowVals.length) rowVals[colMap.status] = newStatus;
      if (colMap.actionedOn !== -1 && colMap.actionedOn < rowVals.length) rowVals[colMap.actionedOn] = new Date();
      if (colMap.actionRemarks !== -1 && colMap.actionRemarks < rowVals.length) rowVals[colMap.actionRemarks] = remarks || '';
      if (colMap.rowVersion !== -1 && colMap.rowVersion < rowVals.length) rowVals[colMap.rowVersion] = new Date().getTime();

      rowRange.setValues([rowVals]);

      // If approved, deduct leave balance
      if (newStatus === 'Approved' && DB.LeaveBalances) {
        DB.LeaveBalances.deduct_(leave.empId, leave.leaveType, leave.dayCount);
      } else if (newStatus === 'Cancelled' && leave.status === 'Approved' && DB.LeaveBalances) {
        // Reverse balance deduction if cancelled after approval
        DB.LeaveBalances.restore_(leave.empId, leave.leaveType, leave.dayCount);
      }

      return _rowToObj(rowVals, colMap);
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
      const all = ss.getSheets();
      for (let i = 0; i < all.length; i++) {
        const name = all[i].getName().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (name === 'leavebalances' || name === 'leavebalance' || name === 'balances') {
          s = all[i];
          break;
        }
      }
    }
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
    const results = [];

    if (lastRow > 1) {
      const values = s.getRange(2, 1, lastRow - 1, 8).getValues();
      values.forEach(r => {
        if (String(r[0]).toLowerCase() === String(empId).toLowerCase() && Number(r[7]) === yr) {
          results.push({
            empId: String(r[0]),
            leaveType: String(r[1]),
            opening: Number(r[2]) || 0,
            accrued: Number(r[3]) || 0,
            used: Number(r[4]) || 0,
            adjusted: Number(r[5]) || 0,
            balance: Number(r[6]) || 0,
            year: Number(r[7])
          });
        }
      });
    }

    // If employee has no leave balances initialized for this year, generate standard defaults
    if (!results.length) {
      const defaults = [
        { type: 'Casual', opening: 12 },
        { type: 'Sick', opening: 10 },
        { type: 'Earned', opening: 15 }
      ];
      defaults.forEach(d => {
        try {
          s.appendRow([empId, d.type, d.opening, 0, 0, 0, d.opening, yr]);
          results.push({
            empId: empId,
            leaveType: d.type,
            opening: d.opening,
            accrued: 0,
            used: 0,
            adjusted: 0,
            balance: d.opening,
            year: yr
          });
        } catch (_) {}
      });
    }

    return results;
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
