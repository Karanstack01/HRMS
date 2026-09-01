/**
 * StackDrove HRMS — Sheet_AuditLog.gs
 * Data access layer for AuditLog and ErrorLog sheets.
 */

var DB = DB || {};

DB.AuditLog = (function() {
  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('AuditLog');
    if (!s) {
      s = ss.insertSheet('AuditLog');
      s.appendRow(['logId', 'timestamp', 'actorEmpId', 'action', 'module', 'recordId', 'requestId', 'oldValue', 'newValue']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function append_(actorEmpId, action, module, recordId, requestId, oldVal, newVal) {
    const s = _sheet();
    s.appendRow([
      generateUuid_(),
      new Date(),
      actorEmpId || 'SYSTEM',
      action || '',
      module || '',
      recordId || '',
      requestId || '',
      typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal || ''),
      typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal || '')
    ]);
  }

  function getRecent_(limit) {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const max = limit || 100;
    const startRow = Math.max(2, lastRow - max + 1);
    const numRows = lastRow - startRow + 1;
    const values = s.getRange(startRow, 1, numRows, 9).getValues();
    return values.reverse().map(r => ({
      logId: r[0],
      timestamp: r[1],
      actorEmpId: r[2],
      action: r[3],
      module: r[4],
      recordId: r[5],
      requestId: r[6],
      oldValue: r[7],
      newValue: r[8]
    }));
  }

  return {
    append_: append_,
    getRecent_: getRecent_
  };
})();
