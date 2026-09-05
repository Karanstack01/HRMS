/**
 * StackDrove HRMS — Sheet_Attendance.gs
 * Data access layer for Year-Partitioned Attendance records, Punches, and Regularizations.
 * Supports dynamic column mapping, case-insensitive sheet discovery, and robust CRUD.
 */

var DB = DB || {};

DB.Attendance = (function() {
  const STANDARD_HEADERS = [
    'recordId', 'empId', 'date', 'punchInTime', 'punchOutTime', 'punchInLoc',
    'punchOutLoc', 'workedHours', 'status', 'lateBy', 'earlyLeaveBy',
    'regularizationRequested', 'regularizationReason', 'approvedBy', 'source', 'remarks'
  ];

  function _getYearSheet(year) {
    const yr = year || new Date().getFullYear();
    const sheetName = 'Attendance_' + yr;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName(sheetName);
    if (!s) {
      // Find case-insensitively or by common aliases
      const allSheets = ss.getSheets();
      for (let i = 0; i < allSheets.length; i++) {
        const name = allSheets[i].getName().trim().toLowerCase();
        if (name === sheetName.toLowerCase() || name === 'attendance' || name === 'attendance master' || name === 'timesheet') {
          s = allSheets[i];
          break;
        }
      }
    }
    if (!s) {
      s = ss.insertSheet(sheetName);
      s.appendRow(STANDARD_HEADERS);
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
      recordId: findCol(['recordId', 'id', 'attendanceId'], 0),
      empId: findCol(['empId', 'employeeId', 'id', 'emp_id'], 1),
      date: findCol(['date', 'punchDate', 'attendanceDate'], 2),
      punchInTime: findCol(['punchInTime', 'punchIn', 'checkIn', 'inTime'], 3),
      punchOutTime: findCol(['punchOutTime', 'punchOut', 'checkOut', 'outTime'], 4),
      punchInLoc: findCol(['punchInLoc', 'inLocation', 'checkInLocation'], 5),
      punchOutLoc: findCol(['punchOutLoc', 'outLocation', 'checkOutLocation'], 6),
      workedHours: findCol(['workedHours', 'hours', 'totalHours', 'duration'], 7),
      status: findCol(['status', 'attendanceStatus', 'state'], 8),
      lateBy: findCol(['lateBy', 'lateMinutes', 'late'], 9),
      earlyLeaveBy: findCol(['earlyLeaveBy', 'earlyMinutes', 'earlyLeave'], 10),
      regularizationRequested: findCol(['regularizationRequested', 'isRegularized', 'regRequested'], 11),
      regularizationReason: findCol(['regularizationReason', 'regReason', 'reason'], 12),
      approvedBy: findCol(['approvedBy', 'approver', 'managerApproved'], 13),
      source: findCol(['source', 'device', 'method'], 14),
      remarks: findCol(['remarks', 'notes', 'comment'], 15),
      lastCol: lastCol
    };
  }

  function _normalizeDate(val) {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val.getTime())) {
      try {
        const tz = (typeof Session !== 'undefined' && Session.getScriptTimeZone) ? Session.getScriptTimeZone() : 'Asia/Kolkata';
        return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      } catch (_) {
        return Utilities.formatDate(val, 'Asia/Kolkata', 'yyyy-MM-dd');
      }
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.substring(0, 10);
    }
    const parts = s.split(/[\/\-\.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return typeof formatDate_ === 'function' ? formatDate_(val, 'yyyy-MM-dd') : s.split('T')[0];
  }

  function _rowToObj(r, colMap) {
    if (!r) return null;
    const getVal = (idx, defaultVal = '') => (idx !== -1 && r[idx] !== undefined && r[idx] !== null) ? r[idx] : defaultVal;

    const recordId = String(getVal(colMap.recordId, ''));
    const empId = String(getVal(colMap.empId, ''));
    if (!recordId && !empId) return null;

    const rawDate = getVal(colMap.date);
    const rawIn = getVal(colMap.punchInTime);
    const rawOut = getVal(colMap.punchOutTime);

    return {
      recordId: recordId || ('ATT-' + Date.now()),
      empId: empId,
      date: _normalizeDate(rawDate),
      punchInTime: rawIn ? (typeof formatDate_ === 'function' ? formatDate_(rawIn, "yyyy-MM-dd'T'HH:mm:ss") : String(rawIn)) : null,
      punchOutTime: rawOut ? (typeof formatDate_ === 'function' ? formatDate_(rawOut, "yyyy-MM-dd'T'HH:mm:ss") : String(rawOut)) : null,
      punchInLoc: String(getVal(colMap.punchInLoc, '')),
      punchOutLoc: String(getVal(colMap.punchOutLoc, '')),
      workedHours: Number(getVal(colMap.workedHours, 0)) || 0,
      status: String(getVal(colMap.status, 'Pending')),
      lateBy: Number(getVal(colMap.lateBy, 0)) || 0,
      earlyLeaveBy: Number(getVal(colMap.earlyLeaveBy, 0)) || 0,
      regularizationRequested: Boolean(getVal(colMap.regularizationRequested, false)),
      regularizationReason: String(getVal(colMap.regularizationReason, '')),
      approvedBy: String(getVal(colMap.approvedBy, '')),
      source: String(getVal(colMap.source, 'Web')),
      remarks: String(getVal(colMap.remarks, ''))
    };
  }

  function findByEmpAndDate_(empId, dateStr) {
    const yr = parseInt(dateStr.split('-')[0], 10) || new Date().getFullYear();
    const s = _getYearSheet(yr);
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return null;

    const colMap = _getColumnMap(s);
    const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const rEmp = colMap.empId !== -1 ? String(r[colMap.empId] || '') : '';
      const rDateVal = colMap.date !== -1 ? r[colMap.date] : '';
      const rDate = _normalizeDate(rDateVal);
      if (rEmp.toLowerCase() === empId.toLowerCase() && rDate === dateStr) {
        const obj = _rowToObj(r, colMap);
        if (obj) obj.rowIdx = i + 2;
        return obj;
      }
    }
    return null;
  }

  function upsertPunch_(empId, dateStr, data) {
    return withLock_(() => {
      const yr = parseInt(dateStr.split('-')[0], 10) || new Date().getFullYear();
      const s = _getYearSheet(yr);
      const colMap = _getColumnMap(s);
      let record = findByEmpAndDate_(empId, dateStr);

      if (!record) {
        // Create new punch record
        const recordId = typeof generateUuid_ === 'function' ? generateUuid_() : ('ATT-' + Date.now().toString(36).toUpperCase());
        const punchIn = (data.punchInTime instanceof Date) ? data.punchInTime : (data.punchInTime ? new Date(data.punchInTime) : new Date());
        const source = data.source || 'Web';
        const loc = data.punchInLoc || '';

        // Calculate late minutes if configured
        let lateMinutes = 0;
        try {
          const stdCheckIn = String((typeof Config !== 'undefined' && Config.get) ? (Config.get('STANDARD_CHECKIN_TIME') || '09:30') : '09:30');
          const parts = stdCheckIn.includes(':') ? stdCheckIn.split(':').map(Number) : [9, 30];
          const checkInLimit = new Date(punchIn.getTime());
          checkInLimit.setHours(parts[0] || 9, parts[1] || 30, 0, 0);
          if (punchIn > checkInLimit) {
            lateMinutes = Math.round((punchIn.getTime() - checkInLimit.getTime()) / 60000);
          }
        } catch (_) {}

        const row = new Array(Math.max(colMap.lastCol, 16)).fill('');
        if (colMap.recordId !== -1) row[colMap.recordId] = recordId;
        if (colMap.empId !== -1) row[colMap.empId] = empId;
        if (colMap.date !== -1) row[colMap.date] = dateStr;
        if (colMap.punchInTime !== -1) row[colMap.punchInTime] = punchIn;
        if (colMap.punchInLoc !== -1) row[colMap.punchInLoc] = loc;
        if (colMap.workedHours !== -1) row[colMap.workedHours] = 0;
        if (colMap.status !== -1) row[colMap.status] = 'Present';
        if (colMap.lateBy !== -1) row[colMap.lateBy] = lateMinutes;
        if (colMap.earlyLeaveBy !== -1) row[colMap.earlyLeaveBy] = 0;
        if (colMap.regularizationRequested !== -1) row[colMap.regularizationRequested] = false;
        if (colMap.source !== -1) row[colMap.source] = source;
        s.appendRow(row);

        const createdObj = _rowToObj(row, colMap) || {
          recordId: recordId,
          empId: empId,
          date: dateStr,
          punchInTime: (typeof formatDate_ === 'function' ? formatDate_(punchIn, "yyyy-MM-dd'T'HH:mm:ss") : String(punchIn)),
          punchOutTime: null,
          punchInLoc: loc,
          punchOutLoc: '',
          workedHours: 0,
          status: 'Present'
        };
        createdObj.rowIdx = s.getLastRow();
        return createdObj;
      } else {
        // Atomic update existing punch record
        const rowIdx = record.rowIdx;
        if (data.punchOutTime && rowIdx) {
          const punchOut = (data.punchOutTime instanceof Date) ? data.punchOutTime : new Date(data.punchOutTime);
          const punchInDate = record.punchInTime ? new Date(record.punchInTime) : new Date();
          const diffMs = Math.max(0, punchOut.getTime() - punchInDate.getTime());
          const hoursWorked = Math.max(0, Math.round((diffMs / 3600000) * 10) / 10);
          const halfDayHours = (typeof Config !== 'undefined' && Config.get) ? (Number(Config.get('HALF_DAY_HOURS')) || 4) : 4;
          const status = hoursWorked < halfDayHours ? 'Half-Day' : 'Present';

          // Atomic row write in a single batch
          const rowRange = s.getRange(rowIdx, 1, 1, colMap.lastCol);
          const rowVals = rowRange.getValues()[0];
          if (colMap.punchOutTime !== -1 && colMap.punchOutTime < rowVals.length) rowVals[colMap.punchOutTime] = punchOut;
          if (colMap.punchOutLoc !== -1 && colMap.punchOutLoc < rowVals.length) rowVals[colMap.punchOutLoc] = data.punchOutLoc || '';
          if (colMap.workedHours !== -1 && colMap.workedHours < rowVals.length) rowVals[colMap.workedHours] = hoursWorked;
          if (colMap.status !== -1 && colMap.status < rowVals.length) rowVals[colMap.status] = status;
          rowRange.setValues([rowVals]);

          const updatedObj = _rowToObj(rowVals, colMap);
          if (updatedObj) {
            updatedObj.rowIdx = rowIdx;
            return updatedObj;
          }
        }
        return findByEmpAndDate_(empId, dateStr) || record;
      }
    });
  }

  function getByEmpAndMonth_(empId, year, month) {
    const s = _getYearSheet(year);
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];

    const colMap = _getColumnMap(s);
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
    const results = [];

    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const rEmp = colMap.empId !== -1 ? String(r[colMap.empId] || '') : '';
      const rDateVal = colMap.date !== -1 ? r[colMap.date] : '';
      const rDate = _normalizeDate(rDateVal);
      if (rEmp.toLowerCase() === String(empId).toLowerCase() && rDate.startsWith(prefix)) {
        const obj = _rowToObj(r, colMap);
        if (obj) results.push(obj);
      }
    }
    return results;
  }

  function getTeamForDate_(directReportEmpIds, dateStr) {
    if (!directReportEmpIds || !directReportEmpIds.length) return [];
    const yr = parseInt(dateStr.split('-')[0], 10) || new Date().getFullYear();
    const s = _getYearSheet(yr);
    const lastRow = s.getLastRow();
    const colMap = _getColumnMap(s);
    const map = {};

    if (lastRow > 1) {
      const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
      values.forEach(r => {
        const eId = colMap.empId !== -1 ? String(r[colMap.empId] || '') : '';
        const dVal = colMap.date !== -1 ? r[colMap.date] : '';
        const d = _normalizeDate(dVal);
        if (d === dateStr) {
          map[eId.toLowerCase()] = _rowToObj(r, colMap);
        }
      });
    }

    return directReportEmpIds.map(id => {
      const emp = (typeof DB !== 'undefined' && DB.Directory) ? DB.Directory.getById_(id) : null;
      return {
        empId: id,
        fullName: emp ? emp.fullName : id,
        department: emp ? emp.department : 'General',
        designation: emp ? emp.designation : 'Staff',
        attendance: map[id.toLowerCase()] || { status: 'Absent', workedHours: 0, punchInTime: null, punchOutTime: null }
      };
    });
  }

  function requestRegularization_(recordIdOrDate, empId, reason) {
    return withLock_(() => {
      const currentYear = new Date().getFullYear();
      const s = _getYearSheet(currentYear);
      const lastRow = s.getLastRow();
      const colMap = _getColumnMap(s);

      if (lastRow > 1) {
        const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
        for (let i = 0; i < values.length; i++) {
          const r = values[i];
          const recId = colMap.recordId !== -1 ? String(r[colMap.recordId] || '') : '';
          const dVal = colMap.date !== -1 ? (typeof formatDate_ === 'function' ? formatDate_(r[colMap.date], 'yyyy-MM-dd') : String(r[colMap.date])) : '';
          const rEmp = colMap.empId !== -1 ? String(r[colMap.empId] || '') : '';

          if ((recId === String(recordIdOrDate) || dVal === String(recordIdOrDate)) && rEmp.toLowerCase() === String(empId).toLowerCase()) {
            const rowIdx = i + 2;
            if (colMap.regularizationRequested !== -1) s.getRange(rowIdx, colMap.regularizationRequested + 1).setValue(true);
            if (colMap.regularizationReason !== -1) s.getRange(rowIdx, colMap.regularizationReason + 1).setValue(reason);
            return true;
          }
        }
      }

      // If no row exists yet for this date, create a regularization placeholder row
      const newRecId = typeof generateUuid_ === 'function' ? generateUuid_() : ('ATT-REG-' + Date.now());
      const row = new Array(colMap.lastCol).fill('');
      if (colMap.recordId !== -1) row[colMap.recordId] = newRecId;
      if (colMap.empId !== -1) row[colMap.empId] = empId;
      if (colMap.date !== -1) row[colMap.date] = recordIdOrDate;
      if (colMap.status !== -1) row[colMap.status] = 'Absent';
      if (colMap.regularizationRequested !== -1) row[colMap.regularizationRequested] = true;
      if (colMap.regularizationReason !== -1) row[colMap.regularizationReason] = reason;
      s.appendRow(row);
      return true;
    });
  }

  function getPendingRegularizations_() {
    const currentYear = new Date().getFullYear();
    const s = _getYearSheet(currentYear);
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];

    const colMap = _getColumnMap(s);
    const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
    const list = [];

    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const isReg = colMap.regularizationRequested !== -1 ? Boolean(r[colMap.regularizationRequested]) : false;
      if (isReg) {
        const obj = _rowToObj(r, colMap);
        if (obj) {
          const emp = (typeof DB !== 'undefined' && DB.Directory) ? DB.Directory.getById_(obj.empId) : null;
          obj.employeeName = emp ? emp.fullName : obj.empId;
          obj.department = emp ? emp.department : 'General';
          list.push(obj);
        }
      }
    }
    return list;
  }

  function resolveRegularization_(recordId, approverEmpId, action) {
    return withLock_(() => {
      const currentYear = new Date().getFullYear();
      const s = _getYearSheet(currentYear);
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return false;

      const colMap = _getColumnMap(s);
      const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();

      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const recId = colMap.recordId !== -1 ? String(r[colMap.recordId] || '') : '';
        if (recId === String(recordId)) {
          const rowIdx = i + 2;
          if (action === 'APPROVE') {
            if (colMap.status !== -1) s.getRange(rowIdx, colMap.status + 1).setValue('Present');
            if (colMap.workedHours !== -1 && (!r[colMap.workedHours] || Number(r[colMap.workedHours]) === 0)) {
              s.getRange(rowIdx, colMap.workedHours + 1).setValue(8.5);
            }
            if (colMap.remarks !== -1) s.getRange(rowIdx, colMap.remarks + 1).setValue('Regularization Approved by ' + approverEmpId);
          } else {
            if (colMap.remarks !== -1) s.getRange(rowIdx, colMap.remarks + 1).setValue('Regularization Rejected by ' + approverEmpId);
          }
          if (colMap.regularizationRequested !== -1) s.getRange(rowIdx, colMap.regularizationRequested + 1).setValue(false);
          if (colMap.approvedBy !== -1) s.getRange(rowIdx, colMap.approvedBy + 1).setValue(approverEmpId);
          return true;
        }
      }
      return false;
    });
  }

  return {
    findByEmpAndDate_: findByEmpAndDate_,
    upsertPunch_: upsertPunch_,
    getByEmpAndMonth_: getByEmpAndMonth_,
    getTeamForDate_: getTeamForDate_,
    requestRegularization_: requestRegularization_,
    getPendingRegularizations_: getPendingRegularizations_,
    resolveRegularization_: resolveRegularization_
  };
})();
