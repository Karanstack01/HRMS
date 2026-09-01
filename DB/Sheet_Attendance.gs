/**
 * StackDrove HRMS — Sheet_Attendance.gs
 * Data access layer for Year-Partitioned Attendance records and punches.
 */

var DB = DB || {};

DB.Attendance = (function() {
  const COL = {
    RECORD_ID: 1,
    EMP_ID: 2,
    DATE: 3,
    PUNCH_IN_TIME: 4,
    PUNCH_OUT_TIME: 5,
    PUNCH_IN_LOC: 6,
    PUNCH_OUT_LOC: 7,
    WORKED_HOURS: 8,
    STATUS: 9,
    LATE_BY: 10,
    EARLY_LEAVE_BY: 11,
    REG_REQUESTED: 12,
    REG_REASON: 13,
    APPROVED_BY: 14,
    SOURCE: 15,
    REMARKS: 16
  };

  function _getYearSheet(year) {
    const yr = year || new Date().getFullYear();
    const sheetName = 'Attendance_' + yr;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName(sheetName);
    if (!s) {
      s = ss.insertSheet(sheetName);
      s.appendRow([
        'recordId', 'empId', 'date', 'punchInTime', 'punchOutTime', 'punchInLoc',
        'punchOutLoc', 'workedHours', 'status', 'lateBy', 'earlyLeaveBy',
        'regularizationRequested', 'regularizationReason', 'approvedBy', 'source', 'remarks'
      ]);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _rowToObj(r) {
    if (!r || !r[0]) return null;
    return {
      recordId: String(r[0]),
      empId: String(r[1]),
      date: r[2] ? formatDate_(r[2], 'yyyy-MM-dd') : '',
      punchInTime: r[3] ? formatDate_(r[3], "yyyy-MM-dd'T'HH:mm:ss") : null,
      punchOutTime: r[4] ? formatDate_(r[4], "yyyy-MM-dd'T'HH:mm:ss") : null,
      punchInLoc: String(r[5] || ''),
      punchOutLoc: String(r[6] || ''),
      workedHours: Number(r[7]) || 0,
      status: String(r[8] || 'Pending'),
      lateBy: Number(r[9]) || 0,
      earlyLeaveBy: Number(r[10]) || 0,
      regularizationRequested: Boolean(r[11]),
      regularizationReason: String(r[12] || ''),
      approvedBy: String(r[13] || ''),
      source: String(r[14] || 'Web'),
      remarks: String(r[15] || '')
    };
  }

  function findByEmpAndDate_(empId, dateStr) {
    const yr = parseInt(dateStr.split('-')[0], 10);
    const s = _getYearSheet(yr);
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return null;

    const values = s.getRange(2, 1, lastRow - 1, 16).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const rEmp = String(r[COL.EMP_ID - 1]);
      const rDate = formatDate_(r[COL.DATE - 1], 'yyyy-MM-dd');
      if (rEmp.toLowerCase() === empId.toLowerCase() && rDate === dateStr) {
        const obj = _rowToObj(r);
        obj.rowIdx = i + 2;
        return obj;
      }
    }
    return null;
  }

  function upsertPunch_(empId, dateStr, data) {
    return withLock_(() => {
      const yr = parseInt(dateStr.split('-')[0], 10);
      const s = _getYearSheet(yr);
      let record = findByEmpAndDate_(empId, dateStr);

      if (!record) {
        // Create new attendance row for today
        const recordId = generateUuid_();
        const punchIn = data.punchInTime || new Date();
        const source = data.source || 'Web';
        const loc = data.punchInLoc || '';

        // Calculate late minutes
        const stdCheckIn = Config.get('STANDARD_CHECKIN_TIME') || '09:30';
        const [stdH, stdM] = stdCheckIn.split(':').map(Number);
        const checkInLimit = new Date(punchIn.getTime());
        checkInLimit.setHours(stdH, stdM, 0, 0);
        const lateMinutes = punchIn > checkInLimit ? Math.round((punchIn - checkInLimit) / 60000) : 0;

        s.appendRow([
          recordId,
          empId,
          dateStr,
          punchIn,
          '',
          loc,
          '',
          0,
          'Present',
          lateMinutes,
          0,
          false,
          '',
          '',
          source,
          ''
        ]);
        return findByEmpAndDate_(empId, dateStr);
      } else {
        // Update existing row (e.g. Punch Out)
        const rowIdx = record.rowIdx;
        if (data.punchOutTime) {
          const punchOut = data.punchOutTime;
          const punchInDate = new Date(record.punchInTime);
          const diffMs = punchOut.getTime() - punchInDate.getTime();
          const hoursWorked = Math.max(0, Math.round((diffMs / 3600000) * 10) / 10);

          s.getRange(rowIdx, COL.PUNCH_OUT_TIME).setValue(punchOut);
          s.getRange(rowIdx, COL.PUNCH_OUT_LOC).setValue(data.punchOutLoc || '');
          s.getRange(rowIdx, COL.WORKED_HOURS).setValue(hoursWorked);
          
          const halfDayHours = Number(Config.get('HALF_DAY_HOURS')) || 4;
          if (hoursWorked < halfDayHours) {
            s.getRange(rowIdx, COL.STATUS).setValue('Half-Day');
          } else {
            s.getRange(rowIdx, COL.STATUS).setValue('Present');
          }
        }
        return findByEmpAndDate_(empId, dateStr);
      }
    });
  }

  function getByEmpAndMonth_(empId, year, month) {
    const s = _getYearSheet(year);
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];

    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const values = s.getRange(2, 1, lastRow - 1, 16).getValues();
    return values
      .filter(r => String(r[COL.EMP_ID - 1]).toLowerCase() === empId.toLowerCase() && formatDate_(r[COL.DATE - 1], 'yyyy-MM-dd').startsWith(prefix))
      .map(_rowToObj);
  }

  function getTeamForDate_(directReportEmpIds, dateStr) {
    if (!directReportEmpIds.length) return [];
    const yr = parseInt(dateStr.split('-')[0], 10);
    const s = _getYearSheet(yr);
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];

    const values = s.getRange(2, 1, lastRow - 1, 16).getValues();
    const map = {};
    values.forEach(r => {
      const eId = String(r[COL.EMP_ID - 1]);
      const d = formatDate_(r[COL.DATE - 1], 'yyyy-MM-dd');
      if (d === dateStr) {
        map[eId] = _rowToObj(r);
      }
    });

    return directReportEmpIds.map(id => {
      const emp = DB.Directory.getById_(id);
      return {
        empId: id,
        fullName: emp ? emp.fullName : id,
        department: emp ? emp.department : '',
        attendance: map[id] || { status: 'Absent', workedHours: 0, punchInTime: null, punchOutTime: null }
      };
    });
  }

  function requestRegularization_(recordId, empId, reason) {
    return withLock_(() => {
      const currentYear = new Date().getFullYear();
      const s = _getYearSheet(currentYear);
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return false;

      const values = s.getRange(2, 1, lastRow - 1, 16).getValues();
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][0]) === String(recordId)) {
          s.getRange(i + 2, COL.REG_REQUESTED).setValue(true);
          s.getRange(i + 2, COL.REG_REASON).setValue(reason || 'Missed Punch');
          return true;
        }
      }
      return false;
    });
  }

  function actionRegularization_(recordId, isApproved, approverEmpId, remarks) {
    return withLock_(() => {
      const currentYear = new Date().getFullYear();
      const s = _getYearSheet(currentYear);
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return false;

      const values = s.getRange(2, 1, lastRow - 1, 16).getValues();
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][0]) === String(recordId)) {
          s.getRange(i + 2, COL.REG_REQUESTED).setValue(false);
          s.getRange(i + 2, COL.APPROVED_BY).setValue(approverEmpId);
          s.getRange(i + 2, COL.REMARKS).setValue(remarks || '');
          if (isApproved) {
            s.getRange(i + 2, COL.STATUS).setValue('Present');
            s.getRange(i + 2, COL.WORKED_HOURS).setValue(Number(Config.get('WORK_HOURS_PER_DAY')) || 8);
          }
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
    actionRegularization_: actionRegularization_
  };
})();
